package com.gatlingweb.service;

import com.gatlingweb.dto.MetricsSnapshot;
import com.gatlingweb.entity.TestRun;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.RandomAccessFile;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.stream.Stream;

@Service
public class SimulationLogParser {

    private static final Logger log = LoggerFactory.getLogger(SimulationLogParser.class);
    private static final int RESERVOIR_SIZE = 10000;

    private final SimpMessagingTemplate messaging;
    private final MetricsPersistenceService metricsPersistence;
    private final AtomicBoolean running = new AtomicBoolean(false);
    private Thread parserThread;
    private volatile Long currentTestRunId;

    // Reservoir sampling for memory-efficient percentile calculation
    private final List<Long> reservoir = new ArrayList<>(RESERVOIR_SIZE);
    private final Random random = new Random();
    private long sampleCount = 0;

    // Aggregation state
    private long totalRequests = 0;
    private long totalErrors = 0;
    private long totalResponseTimeSum = 0;
    private int activeUsers = 0;

    // Per-second window
    private final List<Long> windowResponseTimes = new ArrayList<>();
    private long windowRequests = 0;
    private long windowErrors = 0;

    public SimulationLogParser(SimpMessagingTemplate messaging, MetricsPersistenceService metricsPersistence) {
        this.messaging = messaging;
        this.metricsPersistence = metricsPersistence;
    }

    public void startParsing(Long testRunId, Path gatlingDir, Set<String> existingDirs) {
        resetState();
        currentTestRunId = testRunId;
        running.set(true);

        parserThread = new Thread(() -> {
            try {
                Path logFile = waitForSimulationLog(gatlingDir, existingDirs);
                if (logFile == null) {
                    log.warn("Could not find simulation.log for test {}", testRunId);
                    return;
                }

                log.info("Tailing simulation.log: {}", logFile);
                tailAndParse(testRunId, logFile);
            } catch (Exception e) {
                if (running.get()) {
                    log.error("Error parsing simulation log for test {}", testRunId, e);
                }
            }
        }, "log-parser-" + testRunId);
        parserThread.setDaemon(true);
        parserThread.start();
    }

    public void stopParsing() {
        running.set(false);
        if (parserThread != null) {
            parserThread.interrupt();
            try {
                parserThread.join(5000);
                if (parserThread.isAlive()) {
                    log.warn("Parser thread did not terminate within 5 seconds");
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                log.warn("Interrupted while waiting for parser thread to finish");
            }
        }
    }

    private void resetState() {
        reservoir.clear();
        sampleCount = 0;
        totalRequests = 0;
        totalErrors = 0;
        totalResponseTimeSum = 0;
        activeUsers = 0;
        windowResponseTimes.clear();
        windowRequests = 0;
        windowErrors = 0;
    }

    private Path waitForSimulationLog(Path gatlingDir, Set<String> existingDirs) throws InterruptedException {
        for (int i = 0; i < 120 && running.get(); i++) {
            if (Files.exists(gatlingDir)) {
                try (Stream<Path> dirs = Files.list(gatlingDir)) {
                    Optional<Path> newDir = dirs
                        .filter(Files::isDirectory)
                        .filter(p -> !existingDirs.contains(p.getFileName().toString()))
                        .findFirst();
                    if (newDir.isPresent()) {
                        Path logFile = newDir.get().resolve("simulation.log");
                        if (Files.exists(logFile)) {
                            return logFile;
                        }
                    }
                } catch (IOException ignored) {}
            }
            Thread.sleep(1000);
        }
        return null;
    }

    private void tailAndParse(Long testRunId, Path logFile) throws IOException, InterruptedException {
        long lastPushTime = System.currentTimeMillis();
        boolean firstSnapshotPushed = false;

        try (RandomAccessFile raf = new RandomAccessFile(logFile.toFile(), "r")) {
            while (running.get()) {
                String line = raf.readLine();
                if (line != null) {
                    parseLine(line);
                    // Push first snapshot immediately when we get first request data
                    if (!firstSnapshotPushed && totalRequests > 0) {
                        pushSnapshot(testRunId);
                        lastPushTime = System.currentTimeMillis();
                        firstSnapshotPushed = true;
                    }
                } else {
                    long now = System.currentTimeMillis();
                    if (now - lastPushTime >= 1000) {
                        pushSnapshot(testRunId);
                        lastPushTime = now;
                    }
                    Thread.sleep(100);
                }
            }
            // Read any remaining lines in buffer after stop signal
            String line;
            while ((line = raf.readLine()) != null) {
                parseLine(line);
            }
            // Push final snapshot with accurate totals
            pushSnapshot(testRunId);
            metricsPersistence.flush();
            log.info("Final metrics - Total requests: {}, Total errors: {}", totalRequests, totalErrors);
        }
    }

    void parseLine(String line) {
        // Gatling 3.10 simulation.log format (tab-separated):
        // REQUEST\t<group>\t<name>\t<start>\t<end>\t<status>\t<message>
        // USER\t<scenario>\t<action>\t<start>\t<end>
        String[] parts = line.split("\t", -1); // -1 to keep empty strings
        if (parts.length < 3) return;

        String type = parts[0].trim();

        if ("REQUEST".equals(type) && parts.length >= 6) {
            try {
                // parts[1] = group (often empty), parts[2] = name
                long start = Long.parseLong(parts[3].trim());
                long end = Long.parseLong(parts[4].trim());
                String status = parts[5].trim();
                long responseTime = end - start;

                totalRequests++;
                totalResponseTimeSum += responseTime;
                windowRequests++;
                windowResponseTimes.add(responseTime);

                // Reservoir sampling: maintain a fixed-size sample
                addToReservoir(responseTime);

                if ("KO".equals(status)) {
                    totalErrors++;
                    windowErrors++;
                }
            } catch (NumberFormatException ignored) {}
        } else if ("USER".equals(type) && parts.length >= 4) {
            String action = parts[2].trim();
            if ("START".equals(action)) {
                activeUsers++;
            } else if ("END".equals(action)) {
                activeUsers = Math.max(0, activeUsers - 1);
            }
        }
    }

    void addToReservoir(long responseTime) {
        sampleCount++;
        if (reservoir.size() < RESERVOIR_SIZE) {
            reservoir.add(responseTime);
        } else {
            int j = random.nextInt((int) sampleCount);
            if (j < RESERVOIR_SIZE) {
                reservoir.set(j, responseTime);
            }
        }
    }

    private void pushSnapshot(Long testRunId) {
        double rps = windowRequests;
        double eps = windowErrors;
        double meanRt = windowResponseTimes.isEmpty() ? 0 :
                windowResponseTimes.stream().mapToLong(Long::longValue).average().orElse(0);

        List<Long> sorted = new ArrayList<>(windowResponseTimes);
        Collections.sort(sorted);

        MetricsSnapshot snapshot = new MetricsSnapshot(
            System.currentTimeMillis(),
            rps,
            eps,
            meanRt,
            percentile(sorted, 0.50),
            percentile(sorted, 0.75),
            percentile(sorted, 0.95),
            percentile(sorted, 0.99),
            activeUsers,
            totalRequests,
            totalErrors
        );

        messaging.convertAndSend("/topic/metrics/" + testRunId, snapshot);
        metricsPersistence.buffer(testRunId, snapshot);

        windowResponseTimes.clear();
        windowRequests = 0;
        windowErrors = 0;
    }

    double percentile(List<Long> sorted, double p) {
        if (sorted.isEmpty()) return 0;
        int index = (int) Math.ceil(p * sorted.size()) - 1;
        return sorted.get(Math.max(0, index));
    }

    public void applyFinalMetrics(TestRun run) {
        run.setTotalRequests(totalRequests);
        run.setTotalErrors(totalErrors);

        if (totalRequests > 0) {
            run.setMeanResponseTime((double) totalResponseTimeSum / totalRequests);
        }

        if (!reservoir.isEmpty()) {
            List<Long> sorted = new ArrayList<>(reservoir);
            Collections.sort(sorted);
            run.setP50ResponseTime(percentile(sorted, 0.50));
            run.setP75ResponseTime(percentile(sorted, 0.75));
            run.setP95ResponseTime(percentile(sorted, 0.95));
            run.setP99ResponseTime(percentile(sorted, 0.99));
        }
    }
}
