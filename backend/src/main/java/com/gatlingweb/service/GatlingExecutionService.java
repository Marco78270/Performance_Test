package com.gatlingweb.service;

import com.gatlingweb.dto.LaunchRequest;
import com.gatlingweb.entity.TestRun;
import com.gatlingweb.entity.TestStatus;
import com.gatlingweb.repository.TestRunRepository;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.file.*;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.locks.ReentrantLock;
import java.util.stream.Stream;

@Service
public class GatlingExecutionService {

    private static final Logger log = LoggerFactory.getLogger(GatlingExecutionService.class);

    private final TestRunRepository repository;
    private final SimulationLogParser logParser;
    private final SimpMessagingTemplate messaging;
    private final InfraMetricsScraperService infraScraper;
    private final ThresholdService thresholdService;
    private final BandwidthLimiterService bandwidthLimiter;
    private final Path workspacePath;
    private final long timeoutMinutes;
    private final ReentrantLock executionLock = new ReentrantLock();

    private volatile Process currentProcess;
    private volatile Long currentTestRunId;
    private volatile ScheduledFuture<?> timeoutFuture;
    private final ScheduledExecutorService timeoutScheduler = Executors.newSingleThreadScheduledExecutor();
    private volatile Runnable onTestComplete;

    public GatlingExecutionService(
            TestRunRepository repository,
            SimulationLogParser logParser,
            SimpMessagingTemplate messaging,
            InfraMetricsScraperService infraScraper,
            ThresholdService thresholdService,
            BandwidthLimiterService bandwidthLimiter,
            @Value("${gatling.workspace}") String workspace,
            @Value("${gatling.timeout-minutes:30}") long timeoutMinutes) {
        this.repository = repository;
        this.logParser = logParser;
        this.messaging = messaging;
        this.infraScraper = infraScraper;
        this.thresholdService = thresholdService;
        this.bandwidthLimiter = bandwidthLimiter;
        this.workspacePath = Path.of(workspace).toAbsolutePath().normalize();
        this.timeoutMinutes = timeoutMinutes;
    }

    @PostConstruct
    void validateEnvironment() {
        if (!Files.isDirectory(workspacePath)) {
            throw new IllegalStateException("Gatling workspace not found: " + workspacePath
                    + " — set gatling.workspace or GATLING_WORKSPACE env variable");
        }
        Path pom = workspacePath.resolve("pom.xml");
        if (!Files.exists(pom)) {
            throw new IllegalStateException("No pom.xml in workspace: " + workspacePath
                    + " — the workspace must be a valid Maven/Gatling project");
        }
        // Check mvn is available
        boolean isWindows = System.getProperty("os.name", "").toLowerCase().contains("win");
        String mvnCmd = isWindows ? "mvn.cmd" : "mvn";
        try {
            Process p = new ProcessBuilder(mvnCmd, "--version").redirectErrorStream(true).start();
            boolean finished = p.waitFor(5, TimeUnit.SECONDS);
            if (!finished || p.exitValue() != 0) {
                throw new IllegalStateException("Maven (mvn) returned an error — ensure Maven is installed and in PATH");
            }
            log.info("Gatling environment OK: workspace={}, Maven found", workspacePath);
        } catch (IOException e) {
            throw new IllegalStateException("Maven (mvn) not found in PATH — install Maven or add it to PATH", e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    public void setOnTestComplete(Runnable callback) {
        this.onTestComplete = callback;
    }

    public TestRun launch(String simulationClass, String version) {
        if (!executionLock.tryLock()) {
            throw new IllegalStateException("A test is already running");
        }
        try {
            TestRun run = new TestRun();
            run.setSimulationClass(simulationClass);
            run.setVersion(version);
            run.setStatus(TestStatus.RUNNING);
            run.setStartTime(LocalDateTime.now());
            run = repository.save(run);
            currentTestRunId = run.getId();
            return run;
        } finally {
            executionLock.unlock();
        }
    }

    public void launchExisting(TestRun run) {
        run.setStatus(TestStatus.RUNNING);
        run.setStartTime(LocalDateTime.now());
        repository.save(run);
        currentTestRunId = run.getId();
    }

    @Async("gatlingExecutor")
    public void executeAsync(Long testRunId, LaunchRequest request) {
        if (!executionLock.tryLock()) {
            log.warn("Execution lock not available for test {}", testRunId);
            return;
        }
        try {
            if (request.bandwidthLimitMbps() != null && request.bandwidthLimitMbps() > 0) {
                try {
                    bandwidthLimiter.applyLimit(request.bandwidthLimitMbps());
                } catch (Exception e) {
                    log.error("Failed to apply bandwidth limit for test {}", testRunId, e);
                    messaging.convertAndSend("/topic/logs/" + testRunId,
                        "[WARN] Failed to apply bandwidth limit: " + e.getMessage());
                }
            }
            scheduleTimeout(testRunId);
            infraScraper.startScraping(testRunId);
            doExecute(testRunId, request);
        } finally {
            infraScraper.stopScraping();
            bandwidthLimiter.removeLimit();
            cancelTimeout();
            currentProcess = null;
            currentTestRunId = null;
            executionLock.unlock();
            if (onTestComplete != null) {
                try {
                    onTestComplete.run();
                } catch (Exception e) {
                    log.error("Error in onTestComplete callback", e);
                }
            }
        }
    }

    private void scheduleTimeout(Long testRunId) {
        timeoutFuture = timeoutScheduler.schedule(() -> {
            log.warn("Test {} timed out after {} minutes", testRunId, timeoutMinutes);
            cancel(testRunId);
            repository.findById(testRunId).ifPresent(run -> {
                if (run.getStatus() == TestStatus.RUNNING) {
                    run.setStatus(TestStatus.FAILED);
                    run.setEndTime(LocalDateTime.now());
                    repository.save(run);
                    messaging.convertAndSend("/topic/test-status/" + testRunId, "FAILED");
                    messaging.convertAndSend("/topic/logs/" + testRunId, "[TIMEOUT] Test exceeded " + timeoutMinutes + " minutes limit");
                }
            });
        }, timeoutMinutes, TimeUnit.MINUTES);
    }

    private void cancelTimeout() {
        if (timeoutFuture != null && !timeoutFuture.isDone()) {
            timeoutFuture.cancel(false);
        }
    }

    private void doExecute(Long testRunId, LaunchRequest request) {
        Path gatlingDir = workspacePath.resolve("target/gatling");

        Set<String> existingDirs = new HashSet<>();
        if (Files.exists(gatlingDir)) {
            try (Stream<Path> dirs = Files.list(gatlingDir)) {
                dirs.filter(Files::isDirectory)
                    .forEach(p -> existingDirs.add(p.getFileName().toString()));
            } catch (IOException e) {
                log.warn("Could not list existing gatling dirs", e);
            }
        }

        try {
            String mvnCmd = System.getProperty("os.name").toLowerCase().contains("win")
                    ? "mvn.cmd" : "mvn";

            List<String> command = new ArrayList<>();
            command.add(mvnCmd);
            command.add("gatling:test");
            command.add("-Dgatling.simulationClass=" + request.simulationClass());
            if (request.users() != null) {
                command.add("-Dgatling.users=" + request.users());
            }
            if (request.rampUp() != null) {
                command.add("-Dgatling.rampUp=" + request.rampUp());
            }
            if (request.rampUpDuration() != null) {
                command.add("-Dgatling.rampUpDuration=" + request.rampUpDuration());
            }
            if (request.duration() != null) {
                command.add("-Dgatling.duration=" + request.duration());
            }
            if (request.loop() != null) {
                command.add("-Dgatling.loop=" + request.loop());
            }

            ProcessBuilder pb = new ProcessBuilder(command);
            pb.directory(workspacePath.toFile());
            pb.redirectErrorStream(true);

            currentProcess = pb.start();
            log.info("Started Gatling process for test {} (simulation: {})", testRunId, request.simulationClass());

            logParser.startParsing(testRunId, gatlingDir, existingDirs);

            // Stream process output to WebSocket
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(currentProcess.getInputStream()))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    log.debug("[gatling] {}", line);
                    messaging.convertAndSend("/topic/logs/" + testRunId, line);
                }
            }

            int exitCode = currentProcess.waitFor();
            logParser.stopParsing();

            TestRun run = repository.findById(testRunId).orElseThrow();

            if (run.getStatus() == TestStatus.CANCELLED) {
                // Already cancelled, don't overwrite
            } else if (exitCode == 0) {
                run.setStatus(TestStatus.COMPLETED);
            } else {
                run.setStatus(TestStatus.FAILED);
            }
            run.setEndTime(LocalDateTime.now());

            String reportDir = detectNewResultDir(gatlingDir, existingDirs);
            if (reportDir != null) {
                run.setReportPath(reportDir);
            }

            logParser.applyFinalMetrics(run);
            repository.save(run);

            if (run.getStatus() == TestStatus.COMPLETED) {
                thresholdService.evaluateThresholds(run);
            }

            messaging.convertAndSend("/topic/test-status/" + testRunId, run.getStatus().name());
            if (run.getThresholdVerdict() != null) {
                messaging.convertAndSend("/topic/test-status/" + testRunId,
                    "VERDICT:" + run.getThresholdVerdict().name());
            }
            log.info("Test {} finished with status {} verdict {}", testRunId, run.getStatus(), run.getThresholdVerdict());

        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            markFailed(testRunId);
        } catch (Exception e) {
            log.error("Error executing Gatling test {}", testRunId, e);
            markFailed(testRunId);
        }
    }

    private String detectNewResultDir(Path gatlingDir, Set<String> existingDirs) {
        if (!Files.exists(gatlingDir)) return null;
        try (Stream<Path> dirs = Files.list(gatlingDir)) {
            return dirs.filter(Files::isDirectory)
                .map(p -> p.getFileName().toString())
                .filter(name -> !existingDirs.contains(name))
                .findFirst()
                .orElse(null);
        } catch (IOException e) {
            log.warn("Could not detect result dir", e);
            return null;
        }
    }

    private void markFailed(Long testRunId) {
        repository.findById(testRunId).ifPresent(run -> {
            run.setStatus(TestStatus.FAILED);
            run.setEndTime(LocalDateTime.now());
            repository.save(run);
            messaging.convertAndSend("/topic/test-status/" + testRunId, "FAILED");
        });
    }

    public void cancel(Long testRunId) {
        if (currentProcess != null && Objects.equals(currentTestRunId, testRunId)) {
            // Graceful shutdown: try destroy() first, then forcibly after 5 seconds
            currentProcess.destroy();
            try {
                boolean exited = currentProcess.waitFor(5, TimeUnit.SECONDS);
                if (!exited) {
                    log.warn("Process did not exit gracefully, forcing termination");
                    currentProcess.destroyForcibly();
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                currentProcess.destroyForcibly();
            }

            logParser.stopParsing();
            repository.findById(testRunId).ifPresent(run -> {
                run.setStatus(TestStatus.CANCELLED);
                run.setEndTime(LocalDateTime.now());
                repository.save(run);
                messaging.convertAndSend("/topic/test-status/" + testRunId, "CANCELLED");
            });
        }
    }

    @PreDestroy
    void shutdown() {
        log.info("GatlingExecutionService shutting down...");

        // 1. Kill running Gatling process
        if (currentProcess != null && currentProcess.isAlive()) {
            log.info("Destroying running Gatling process for test {}", currentTestRunId);
            currentProcess.destroy();
            try {
                if (!currentProcess.waitFor(5, TimeUnit.SECONDS)) {
                    currentProcess.destroyForcibly();
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                currentProcess.destroyForcibly();
            }
        }

        // 2. Mark current RUNNING test as FAILED in DB
        if (currentTestRunId != null) {
            repository.findById(currentTestRunId).ifPresent(run -> {
                if (run.getStatus() == TestStatus.RUNNING) {
                    run.setStatus(TestStatus.FAILED);
                    run.setEndTime(LocalDateTime.now());
                    repository.save(run);
                    log.info("Marked test #{} as FAILED due to shutdown", currentTestRunId);
                }
            });
        }

        // 3. Stop log parser
        logParser.stopParsing();

        // 4. Shutdown timeout scheduler
        timeoutScheduler.shutdownNow();
        try {
            timeoutScheduler.awaitTermination(2, TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }

        // 5. Release lock if held by current thread
        if (executionLock.isHeldByCurrentThread()) {
            executionLock.unlock();
        }

        log.info("GatlingExecutionService shutdown complete");
    }

    public boolean isRunning() {
        return currentProcess != null && currentProcess.isAlive();
    }

    public Long getCurrentTestRunId() {
        return currentTestRunId;
    }
}
