package com.gatlingweb.selenium.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.gatlingweb.entity.TestStatus;
import com.gatlingweb.selenium.dto.SeleniumLaunchRequest;
import com.gatlingweb.selenium.entity.SeleniumBrowserResult;
import com.gatlingweb.selenium.entity.SeleniumTestRun;
import com.gatlingweb.selenium.repository.SeleniumBrowserResultRepository;
import com.gatlingweb.selenium.repository.SeleniumTestRunRepository;
import com.gatlingweb.service.InfraMetricsScraperService;
import jakarta.annotation.PreDestroy;
import org.openqa.selenium.OutputType;
import org.openqa.selenium.TakesScreenshot;
import org.openqa.selenium.WebDriver;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import javax.imageio.ImageIO;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.net.URL;
import java.net.URLClassLoader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

@Service
public class SeleniumExecutionService {

    private static final Logger log = LoggerFactory.getLogger(SeleniumExecutionService.class);

    private final SeleniumTestRunRepository testRunRepository;
    private final SeleniumBrowserResultRepository resultRepository;
    private final SeleniumGridService gridService;
    private final SeleniumCompilerService compilerService;
    private final SeleniumMetricsCollector metricsCollector;
    private final InfraMetricsScraperService infraScraper;
    private final SimpMessagingTemplate messaging;
    private final ObjectMapper objectMapper;
    private final Path screenshotsDir;

    private volatile Long currentTestRunId;
    private volatile boolean cancelled = false;
    private volatile boolean currentHeadless = false;

    public SeleniumExecutionService(
            SeleniumTestRunRepository testRunRepository,
            SeleniumBrowserResultRepository resultRepository,
            SeleniumGridService gridService,
            SeleniumCompilerService compilerService,
            SeleniumMetricsCollector metricsCollector,
            InfraMetricsScraperService infraScraper,
            SimpMessagingTemplate messaging,
            ObjectMapper objectMapper,
            @Value("${selenium.screenshots-dir:../selenium-workspace/screenshots}") String screenshotsDir) {
        this.testRunRepository = testRunRepository;
        this.resultRepository = resultRepository;
        this.gridService = gridService;
        this.compilerService = compilerService;
        this.metricsCollector = metricsCollector;
        this.infraScraper = infraScraper;
        this.messaging = messaging;
        this.objectMapper = objectMapper;
        this.screenshotsDir = Path.of(screenshotsDir).toAbsolutePath().normalize();
    }

    public SeleniumTestRun launch(SeleniumLaunchRequest request) {
        SeleniumTestRun run = new SeleniumTestRun();
        run.setScriptClass(request.scriptClass());
        run.setBrowser(request.browser());
        run.setInstances(request.instances());
        run.setVersion(request.version());
        run.setLoops(request.loops());
        run.setRampUpSeconds(request.rampUpSeconds());
        run.setStatus(TestStatus.QUEUED);
        run.setTotalInstances(request.instances());
        run.setTotalIterations(request.instances() * request.loops());
        run.setHeadless(request.headless());
        run.setGridUrl(gridService.getGridUrl());
        return testRunRepository.save(run);
    }

    @Async("seleniumExecutor")
    public void executeAsync(Long testRunId, boolean headless) {
        currentTestRunId = testRunId;
        currentHeadless = headless;
        cancelled = false;

        SeleniumTestRun run = testRunRepository.findById(testRunId).orElse(null);
        if (run == null) return;

        try {
            // 1. Mark as running & setup drivers
            run.setStatus(TestStatus.RUNNING);
            run.setStartTime(System.currentTimeMillis());
            testRunRepository.save(run);
            messaging.convertAndSend("/topic/selenium-status/" + testRunId, "RUNNING");

            gridService.ensureRunning();

            // 2. Compile
            SeleniumCompilerService.CompileResult compileResult = compilerService.compile();
            if (!compileResult.success()) {
                run.setStatus(TestStatus.FAILED);
                run.setEndTime(System.currentTimeMillis());
                testRunRepository.save(run);
                Map<String, Object> errorMsg = Map.of(
                    "type", "COMPILE_ERROR",
                    "errors", compileResult.output()
                );
                messaging.convertAndSend("/topic/selenium-status/" + testRunId,
                    "FAILED:" + objectMapper.writeValueAsString(errorMsg));
                return;
            }

            // 3. Load class
            Path classesDir = compilerService.getClassesDir();
            URLClassLoader classLoader = new URLClassLoader(
                new URL[]{classesDir.toUri().toURL()},
                getClass().getClassLoader()
            );

            final Class<?> scriptClazz = classLoader.loadClass("scripts." + run.getScriptClass());
            final String browserName = run.getBrowser();
            final int loops = run.getLoops();
            final int rampUpSeconds = run.getRampUpSeconds();

            // 4. Start metrics collector + infra scraper
            metricsCollector.start(testRunId);
            infraScraper.startScraping(testRunId);

            // 5. Execute in parallel with optional ramp-up
            int instanceCount = run.getInstances();
            ExecutorService pool = Executors.newFixedThreadPool(
                Math.min(instanceCount, 10)
            );

            AtomicInteger passedIterations = new AtomicInteger(0);
            AtomicInteger failedIterations = new AtomicInteger(0);
            AtomicInteger passedInstances = new AtomicInteger(0);
            AtomicInteger failedInstances = new AtomicInteger(0);

            CountDownLatch latch = new CountDownLatch(instanceCount);

            if (rampUpSeconds > 0 && instanceCount > 1) {
                // Ramp-up: schedule browser starts progressively
                long intervalMs = (long) rampUpSeconds * 1000 / (instanceCount - 1);
                ScheduledExecutorService rampScheduler = Executors.newSingleThreadScheduledExecutor(r -> {
                    Thread t = new Thread(r, "ramp-" + testRunId);
                    t.setDaemon(true);
                    return t;
                });

                for (int i = 0; i < instanceCount; i++) {
                    final int browserIndex = i;
                    long delay = (long) i * intervalMs;
                    rampScheduler.schedule(() -> {
                        pool.submit(() -> {
                            try {
                                if (cancelled) return;
                                boolean allPassed = executeSingleBrowser(testRunId, browserName,
                                    scriptClazz, browserIndex, loops, passedIterations, failedIterations);
                                if (allPassed) passedInstances.incrementAndGet();
                                else failedInstances.incrementAndGet();
                            } finally {
                                latch.countDown();
                            }
                        });
                    }, delay, TimeUnit.MILLISECONDS);
                }

                rampScheduler.shutdown();
            } else {
                // Immediate start (existing behavior)
                for (int i = 0; i < instanceCount; i++) {
                    final int browserIndex = i;
                    pool.submit(() -> {
                        try {
                            if (cancelled) return;
                            boolean allPassed = executeSingleBrowser(testRunId, browserName,
                                scriptClazz, browserIndex, loops, passedIterations, failedIterations);
                            if (allPassed) passedInstances.incrementAndGet();
                            else failedInstances.incrementAndGet();
                        } finally {
                            latch.countDown();
                        }
                    });
                }
            }

            // Wait for all browsers to finish
            latch.await(30, TimeUnit.MINUTES);
            pool.shutdown();

            // 6. Stop metrics + infra scraper
            metricsCollector.stop();
            infraScraper.stopScraping();

            // 7. Update final status
            run = testRunRepository.findById(testRunId).orElse(run);
            run.setPassedInstances(passedInstances.get());
            run.setFailedInstances(failedInstances.get());
            run.setPassedIterations(passedIterations.get());
            run.setFailedIterations(failedIterations.get());
            run.setMeanStepDuration(metricsCollector.getOverallMeanIterationDuration());
            run.setEndTime(System.currentTimeMillis());
            run.setStatus(cancelled ? TestStatus.CANCELLED :
                (failedInstances.get() == 0 ? TestStatus.COMPLETED : TestStatus.FAILED));
            testRunRepository.save(run);

            messaging.convertAndSend("/topic/selenium-status/" + testRunId,
                run.getStatus().name());

        } catch (Exception e) {
            log.error("Error executing selenium test {}", testRunId, e);
            metricsCollector.stop();
            infraScraper.stopScraping();
            run.setStatus(TestStatus.FAILED);
            run.setEndTime(System.currentTimeMillis());
            testRunRepository.save(run);
            messaging.convertAndSend("/topic/selenium-status/" + testRunId, "FAILED");
        } finally {
            currentTestRunId = null;
        }
    }

    /**
     * Execute a single browser instance with N loops.
     * Returns true if ALL iterations passed, false if any failed.
     */
    private boolean executeSingleBrowser(Long testRunId, String browser, Class<?> scriptClazz,
                                          int browserIndex, int loops,
                                          AtomicInteger passedIterations, AtomicInteger failedIterations) {

        metricsCollector.browserStarted();
        WebDriver driver = null;
        ScheduledExecutorService screenshotScheduler = null;
        boolean anyFailed = false;

        try {
            // Create driver (reused across all iterations)
            driver = gridService.createDriver(browser, currentHeadless);

            // Start screenshot streaming
            final WebDriver driverRef = driver;
            screenshotScheduler = Executors.newSingleThreadScheduledExecutor(r -> {
                Thread t = new Thread(r, "screenshot-" + testRunId + "-" + browserIndex);
                t.setDaemon(true);
                return t;
            });
            screenshotScheduler.scheduleAtFixedRate(() -> {
                try {
                    String base64 = captureAndResizeScreenshot(driverRef);
                    if (base64 != null) {
                        sendScreenshot(testRunId, browserIndex, base64);
                    }
                } catch (Exception e) {
                    // Driver busy or closed, skip this frame
                }
            }, 500, 1500, TimeUnit.MILLISECONDS);

            // Execute N iterations
            for (int iteration = 0; iteration < loops; iteration++) {
                if (cancelled) break;

                // Create result for this iteration
                SeleniumBrowserResult result = new SeleniumBrowserResult();
                result.setTestRunId(testRunId);
                result.setBrowserIndex(browserIndex);
                result.setIteration(iteration);
                result.setStatus("RUNNING");
                result.setStartTime(System.currentTimeMillis());
                result = resultRepository.save(result);
                sendBrowserUpdate(testRunId, result);

                try {
                    // Fresh script instance per iteration
                    Object scriptInstance = scriptClazz.getDeclaredConstructor().newInstance();
                    var setDriverMethod = scriptClazz.getMethod("setDriver", WebDriver.class);
                    setDriverMethod.invoke(scriptInstance, driverRef);

                    try {
                        var executeMethod = scriptClazz.getMethod("execute");
                        executeMethod.invoke(scriptInstance);
                    } finally {
                        // Always retrieve steps, even on failure
                        try {
                            var getStepsMethod = scriptClazz.getMethod("getSteps");
                            List<?> steps = (List<?>) getStepsMethod.invoke(scriptInstance);
                            result.setStepsJson(objectMapper.writeValueAsString(steps));
                        } catch (Exception ignored) {}
                    }

                    result.setStatus("PASSED");
                    result.setEndTime(System.currentTimeMillis());
                    result.setDurationMs(result.getEndTime() - result.getStartTime());
                    passedIterations.incrementAndGet();
                    metricsCollector.recordIterationDuration(result.getDurationMs());
                    metricsCollector.recordIterationComplete();

                } catch (Exception e) {
                    String errorMsg = e.getCause() != null ? e.getCause().getMessage() : e.getMessage();
                    result.setStatus("FAILED");
                    result.setErrorMessage(errorMsg);
                    result.setEndTime(System.currentTimeMillis());
                    result.setDurationMs(result.getEndTime() - result.getStartTime());
                    failedIterations.incrementAndGet();
                    metricsCollector.recordIterationDuration(result.getDurationMs());
                    metricsCollector.recordIterationFailed();
                    anyFailed = true;

                    // Try to capture screenshot on failure
                    if (driverRef instanceof TakesScreenshot ts) {
                        try {
                            File screenshot = ts.getScreenshotAs(OutputType.FILE);
                            Path screenshotDest = screenshotsDir.resolve(
                                testRunId + "_browser_" + browserIndex + "_iter_" + iteration + ".png");
                            Files.createDirectories(screenshotsDir);
                            Files.copy(screenshot.toPath(), screenshotDest, StandardCopyOption.REPLACE_EXISTING);
                            result.setScreenshotPath(screenshotDest.toString());
                        } catch (Exception ignored) {
                            log.debug("Could not capture screenshot for browser {} iteration {}", browserIndex, iteration);
                        }
                    }

                    // Continue to next iteration on failure
                }

                resultRepository.save(result);
                sendBrowserUpdate(testRunId, result);
            }

        } catch (Exception e) {
            log.error("Fatal error in browser {} for test {}", browserIndex, testRunId, e);
            anyFailed = true;
        } finally {
            metricsCollector.browserFinished();

            // Stop screenshot streaming
            if (screenshotScheduler != null) {
                screenshotScheduler.shutdownNow();
            }
            // Send one final screenshot before quitting
            if (driver != null) {
                try {
                    String finalScreen = captureAndResizeScreenshot(driver);
                    if (finalScreen != null) {
                        sendScreenshot(testRunId, browserIndex, finalScreen);
                    }
                } catch (Exception ignored) {}
            }
            if (driver != null) {
                try { driver.quit(); } catch (Exception ignored) {}
            }
        }

        return !anyFailed;
    }

    private String captureAndResizeScreenshot(WebDriver driver) {
        if (!(driver instanceof TakesScreenshot ts)) return null;
        try {
            byte[] png = ts.getScreenshotAs(OutputType.BYTES);
            BufferedImage original = ImageIO.read(new ByteArrayInputStream(png));
            if (original == null) return null;

            // Resize to 480x270 (16:9) for efficient WebSocket transfer
            int tw = 480, th = 270;
            BufferedImage resized = new BufferedImage(tw, th, BufferedImage.TYPE_INT_RGB);
            Graphics2D g = resized.createGraphics();
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            g.drawImage(original, 0, 0, tw, th, null);
            g.dispose();

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            ImageIO.write(resized, "jpg", baos);
            return Base64.getEncoder().encodeToString(baos.toByteArray());
        } catch (Exception e) {
            return null;
        }
    }

    private void sendScreenshot(Long testRunId, int browserIndex, String base64Jpg) {
        try {
            String payload = "{\"bi\":" + browserIndex + ",\"img\":\"data:image/jpeg;base64," + base64Jpg + "\"}";
            messaging.convertAndSend("/topic/selenium/screen/" + testRunId, payload);
        } catch (Exception e) {
            log.debug("Failed to send screenshot for browser {}", browserIndex);
        }
    }

    private void sendBrowserUpdate(Long testRunId, SeleniumBrowserResult result) {
        try {
            messaging.convertAndSend("/topic/selenium/" + testRunId,
                objectMapper.writeValueAsString(result));
        } catch (Exception e) {
            log.warn("Failed to send browser update for test {}", testRunId, e);
        }
    }

    public void cancel(Long testRunId) {
        if (Objects.equals(currentTestRunId, testRunId)) {
            cancelled = true;
            testRunRepository.findById(testRunId).ifPresent(run -> {
                run.setStatus(TestStatus.CANCELLED);
                run.setEndTime(System.currentTimeMillis());
                testRunRepository.save(run);
                messaging.convertAndSend("/topic/selenium-status/" + testRunId, "CANCELLED");
            });
        }
    }

    public boolean isRunning() {
        return currentTestRunId != null;
    }

    public Long getCurrentTestRunId() {
        return currentTestRunId;
    }

    @PreDestroy
    void shutdown() {
        if (currentTestRunId != null) {
            cancel(currentTestRunId);
        }
    }
}
