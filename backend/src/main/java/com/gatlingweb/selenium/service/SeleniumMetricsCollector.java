package com.gatlingweb.selenium.service;

import com.gatlingweb.selenium.dto.SeleniumMetricsSnapshot;
import com.gatlingweb.selenium.entity.SeleniumMetricsPoint;
import com.gatlingweb.selenium.repository.SeleniumMetricsPointRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.lang.management.ManagementFactory;
import java.lang.management.OperatingSystemMXBean;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

@Service
public class SeleniumMetricsCollector {

    private static final Logger log = LoggerFactory.getLogger(SeleniumMetricsCollector.class);
    private static final int DB_FLUSH_INTERVAL = 5;

    private final SimpMessagingTemplate messaging;
    private final SeleniumMetricsPointRepository metricsRepository;

    // Accumulators (thread-safe)
    private final ConcurrentLinkedQueue<Long> windowStepDurations = new ConcurrentLinkedQueue<>();
    private final AtomicLong windowIterations = new AtomicLong(0);
    private final AtomicLong windowErrors = new AtomicLong(0);
    private final AtomicLong totalIterations = new AtomicLong(0);
    private final AtomicLong totalErrors = new AtomicLong(0);
    private final AtomicInteger activeBrowsers = new AtomicInteger(0);
    private final AtomicLong allStepDurationsSum = new AtomicLong(0);
    private final AtomicLong allStepDurationsCount = new AtomicLong(0);

    private volatile Long currentTestRunId;
    private ScheduledExecutorService scheduler;
    private final List<SeleniumMetricsPoint> dbBuffer = new ArrayList<>();

    public SeleniumMetricsCollector(SimpMessagingTemplate messaging,
                                    SeleniumMetricsPointRepository metricsRepository) {
        this.messaging = messaging;
        this.metricsRepository = metricsRepository;
    }

    public void start(Long testRunId) {
        this.currentTestRunId = testRunId;
        windowStepDurations.clear();
        windowIterations.set(0);
        windowErrors.set(0);
        totalIterations.set(0);
        totalErrors.set(0);
        activeBrowsers.set(0);
        allStepDurationsSum.set(0);
        allStepDurationsCount.set(0);
        dbBuffer.clear();

        scheduler = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "sel-metrics-" + testRunId);
            t.setDaemon(true);
            return t;
        });
        scheduler.scheduleAtFixedRate(this::pushSnapshot, 1, 1, TimeUnit.SECONDS);
    }

    public void stop() {
        if (scheduler != null) {
            scheduler.shutdownNow();
            scheduler = null;
        }
        // Flush remaining buffer
        flushToDb();
        currentTestRunId = null;
    }

    // --- Called by browser threads ---

    public void browserStarted() {
        activeBrowsers.incrementAndGet();
    }

    public void browserFinished() {
        activeBrowsers.decrementAndGet();
    }

    public void recordStepDuration(long durationMs) {
        windowStepDurations.add(durationMs);
        allStepDurationsSum.addAndGet(durationMs);
        allStepDurationsCount.incrementAndGet();
    }

    public void recordIterationComplete() {
        windowIterations.incrementAndGet();
        totalIterations.incrementAndGet();
    }

    public void recordIterationFailed() {
        windowErrors.incrementAndGet();
        totalErrors.incrementAndGet();
        // Also count as iteration
        totalIterations.incrementAndGet();
    }

    // --- Scheduled push ---

    private void pushSnapshot() {
        try {
            Long testRunId = currentTestRunId;
            if (testRunId == null) return;

            // 1. Drain step durations
            List<Long> durations = new ArrayList<>();
            Long d;
            while ((d = windowStepDurations.poll()) != null) {
                durations.add(d);
            }

            // 2. Calculate percentiles
            double meanStep = 0, p50 = 0, p75 = 0, p95 = 0, p99 = 0;
            if (!durations.isEmpty()) {
                Collections.sort(durations);
                meanStep = durations.stream().mapToLong(Long::longValue).average().orElse(0);
                p50 = percentile(durations, 50);
                p75 = percentile(durations, 75);
                p95 = percentile(durations, 95);
                p99 = percentile(durations, 99);
            }

            // 3. Window counters
            long iters = windowIterations.getAndSet(0);
            long errs = windowErrors.getAndSet(0);

            // 4. System metrics
            Double cpuPercent = getCpuPercent();
            Double memoryPercent = getMemoryPercent();

            // 5. Build snapshot
            SeleniumMetricsSnapshot snapshot = new SeleniumMetricsSnapshot(
                System.currentTimeMillis(),
                iters,           // iterations per second (1s window)
                errs,            // errors per second (1s window)
                meanStep,
                p50, p75, p95, p99,
                activeBrowsers.get(),
                totalIterations.get(),
                totalErrors.get(),
                cpuPercent,
                memoryPercent
            );

            // 6. Send via WebSocket
            messaging.convertAndSend("/topic/selenium-metrics/" + testRunId, snapshot);

            // 7. Buffer for DB
            dbBuffer.add(SeleniumMetricsPoint.from(testRunId, snapshot));
            if (dbBuffer.size() >= DB_FLUSH_INTERVAL) {
                flushToDb();
            }

        } catch (Exception e) {
            log.debug("Error pushing selenium metrics snapshot", e);
        }
    }

    private synchronized void flushToDb() {
        if (dbBuffer.isEmpty()) return;
        try {
            metricsRepository.saveAll(new ArrayList<>(dbBuffer));
            dbBuffer.clear();
        } catch (Exception e) {
            log.warn("Failed to flush selenium metrics to DB", e);
        }
    }

    private double percentile(List<Long> sorted, int pct) {
        if (sorted.isEmpty()) return 0;
        int index = (int) Math.ceil(pct / 100.0 * sorted.size()) - 1;
        return sorted.get(Math.max(0, Math.min(index, sorted.size() - 1)));
    }

    private Double getCpuPercent() {
        try {
            OperatingSystemMXBean osBean = ManagementFactory.getOperatingSystemMXBean();
            if (osBean instanceof com.sun.management.OperatingSystemMXBean sunBean) {
                double load = sunBean.getCpuLoad();
                if (load >= 0) return Math.round(load * 10000.0) / 100.0;
            }
        } catch (Exception ignored) {}
        return null;
    }

    private Double getMemoryPercent() {
        try {
            Runtime rt = Runtime.getRuntime();
            long total = rt.totalMemory();
            long free = rt.freeMemory();
            long max = rt.maxMemory();
            long used = total - free;
            return Math.round(used * 10000.0 / max) / 100.0;
        } catch (Exception ignored) {}
        return null;
    }

    public Double getOverallMeanStepDuration() {
        long count = allStepDurationsCount.get();
        if (count == 0) return null;
        return (double) allStepDurationsSum.get() / count;
    }

    // --- Query API ---

    public List<SeleniumMetricsSnapshot> getMetrics(Long testRunId) {
        return metricsRepository.findByTestRunIdOrderByTimestampAsc(testRunId)
            .stream()
            .map(SeleniumMetricsPoint::toSnapshot)
            .toList();
    }

    @Transactional
    public void deleteMetrics(Long testRunId) {
        metricsRepository.deleteByTestRunId(testRunId);
    }
}
