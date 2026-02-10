package com.gatlingweb.service;

import com.gatlingweb.dto.InfraMetricsSnapshot;
import com.gatlingweb.entity.MonitoredServer;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.concurrent.*;

@Service
public class InfraMetricsScraperService {

    private static final Logger log = LoggerFactory.getLogger(InfraMetricsScraperService.class);
    private static final int SCRAPE_INTERVAL_SECONDS = 2;
    private static final int HTTP_TIMEOUT_SECONDS = 5;

    private final MonitoredServerService serverService;
    private final PrometheusMetricsParser parser;
    private final SimpMessagingTemplate messaging;
    private final MetricsPersistenceService metricsPersistence;
    private final HttpClient httpClient;

    private volatile ScheduledExecutorService scheduler;
    private volatile Long currentTestRunId;
    private final ConcurrentHashMap<Long, ServerMetricsState> serverStates = new ConcurrentHashMap<>();

    public InfraMetricsScraperService(
            MonitoredServerService serverService,
            PrometheusMetricsParser parser,
            SimpMessagingTemplate messaging,
            MetricsPersistenceService metricsPersistence) {
        this.serverService = serverService;
        this.parser = parser;
        this.messaging = messaging;
        this.metricsPersistence = metricsPersistence;
        this.httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(HTTP_TIMEOUT_SECONDS))
            .build();
    }

    public synchronized void startScraping(Long testRunId) {
        if (scheduler != null && !scheduler.isShutdown()) {
            log.warn("Scraper already running, stopping previous instance");
            stopScraping();
        }

        currentTestRunId = testRunId;
        serverStates.clear();
        scheduler = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "infra-metrics-scraper");
            t.setDaemon(true);
            return t;
        });

        scheduler.scheduleAtFixedRate(
            this::scrapeAllServers,
            0,
            SCRAPE_INTERVAL_SECONDS,
            TimeUnit.SECONDS
        );

        log.info("Started infrastructure metrics scraping for test run {}", testRunId);
    }

    public synchronized void stopScraping() {
        if (scheduler != null) {
            scheduler.shutdownNow();
            try {
                scheduler.awaitTermination(2, TimeUnit.SECONDS);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
            scheduler = null;
        }
        currentTestRunId = null;
        serverStates.clear();
        log.info("Stopped infrastructure metrics scraping");
    }

    @PreDestroy
    void shutdown() {
        log.info("InfraMetricsScraperService shutting down...");
        stopScraping();
        log.info("InfraMetricsScraperService shutdown complete");
    }

    private void scrapeAllServers() {
        if (currentTestRunId == null) return;

        List<MonitoredServer> servers = serverService.findEnabled();
        for (MonitoredServer server : servers) {
            try {
                InfraMetricsSnapshot snapshot = scrapeServer(server);
                messaging.convertAndSend("/topic/infra-metrics/" + currentTestRunId, snapshot);
                metricsPersistence.bufferInfra(currentTestRunId, snapshot);
                serverService.updateStatus(server.getId(), LocalDateTime.now(), null);
            } catch (Exception e) {
                log.debug("Failed to scrape server {}: {}", server.getName(), e.getMessage());
                InfraMetricsSnapshot errorSnapshot = InfraMetricsSnapshot.error(
                    server.getId(),
                    server.getName(),
                    server.getServerType(),
                    e.getMessage()
                );
                messaging.convertAndSend("/topic/infra-metrics/" + currentTestRunId, errorSnapshot);
                serverService.updateStatus(server.getId(), null, e.getMessage());
            }
        }
    }

    private InfraMetricsSnapshot scrapeServer(MonitoredServer server) throws Exception {
        String url = server.getUrl();
        if (!url.endsWith("/metrics")) {
            url = url.endsWith("/") ? url + "metrics" : url + "/metrics";
        }

        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(url))
            .timeout(Duration.ofSeconds(HTTP_TIMEOUT_SECONDS))
            .GET()
            .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() != 200) {
            throw new RuntimeException("HTTP " + response.statusCode());
        }

        Map<String, Map<String, Double>> metrics = parser.parse(response.body());
        long now = System.currentTimeMillis();

        ServerMetricsState state = serverStates.computeIfAbsent(server.getId(), k -> new ServerMetricsState());
        ServerMetricsState.Snapshot previous = state.previous;

        // CPU calculation (rate-based)
        Double cpuPercent = null;
        Double cpuIdleTotal = parser.getCpuIdleTotal(metrics);
        Double cpuTotal = parser.getCpuTotal(metrics);
        if (cpuIdleTotal != null && cpuTotal != null && previous != null) {
            double idleDelta = cpuIdleTotal - previous.cpuIdleTotal;
            double totalDelta = cpuTotal - previous.cpuTotal;
            if (totalDelta > 0) {
                cpuPercent = 100.0 * (1.0 - idleDelta / totalDelta);
            }
        }

        // Memory
        Long memoryTotal = parser.getPhysicalMemoryBytes(metrics);
        Long memoryFree = parser.getFreeMemoryBytes(metrics);
        Long memoryUsed = (memoryTotal != null && memoryFree != null) ? memoryTotal - memoryFree : null;
        Double memoryPercent = (memoryUsed != null && memoryTotal != null && memoryTotal > 0)
            ? 100.0 * memoryUsed / memoryTotal : null;

        if (memoryPercent == null) {
            log.debug("Memory metrics incomplete for {}: total={}, free={}",
                server.getName(), memoryTotal, memoryFree);
        }

        // Disk I/O (rate-based)
        Double diskReadTotal = parser.getDiskReadBytesTotal(metrics);
        Double diskWriteTotal = parser.getDiskWriteBytesTotal(metrics);
        Double diskReadPerSec = null;
        Double diskWritePerSec = null;
        if (previous != null && previous.timestamp > 0) {
            double timeDelta = (now - previous.timestamp) / 1000.0;
            if (timeDelta > 0) {
                if (diskReadTotal != null && previous.diskReadTotal != null) {
                    diskReadPerSec = (diskReadTotal - previous.diskReadTotal) / timeDelta;
                }
                if (diskWriteTotal != null && previous.diskWriteTotal != null) {
                    diskWritePerSec = (diskWriteTotal - previous.diskWriteTotal) / timeDelta;
                }
            }
        }

        // Network I/O (rate-based)
        Double netRecvTotal = parser.getNetworkRecvBytesTotal(metrics);
        Double netSentTotal = parser.getNetworkSentBytesTotal(metrics);
        Double netRecvPerSec = null;
        Double netSentPerSec = null;
        if (previous != null && previous.timestamp > 0) {
            double timeDelta = (now - previous.timestamp) / 1000.0;
            if (timeDelta > 0) {
                if (netRecvTotal != null && previous.netRecvTotal != null) {
                    netRecvPerSec = (netRecvTotal - previous.netRecvTotal) / timeDelta;
                }
                if (netSentTotal != null && previous.netSentTotal != null) {
                    netSentPerSec = (netSentTotal - previous.netSentTotal) / timeDelta;
                }
            }
        }

        // SQL Batch/s (rate-based)
        Double sqlBatchTotal = parser.getSqlBatchRequestsTotal(metrics);
        Double sqlBatchPerSec = null;
        if (previous != null && previous.timestamp > 0 && sqlBatchTotal != null && previous.sqlBatchTotal != null) {
            double timeDelta = (now - previous.timestamp) / 1000.0;
            if (timeDelta > 0) {
                sqlBatchPerSec = (sqlBatchTotal - previous.sqlBatchTotal) / timeDelta;
            }
        }

        // Save current state for next iteration
        state.previous = new ServerMetricsState.Snapshot(
            now,
            cpuIdleTotal != null ? cpuIdleTotal : 0,
            cpuTotal != null ? cpuTotal : 0,
            diskReadTotal,
            diskWriteTotal,
            netRecvTotal,
            netSentTotal,
            sqlBatchTotal
        );

        return new InfraMetricsSnapshot(
            now,
            server.getId(),
            server.getName(),
            server.getServerType(),
            cpuPercent,
            memoryUsed,
            memoryTotal,
            memoryPercent,
            diskReadPerSec,
            diskWritePerSec,
            netRecvPerSec,
            netSentPerSec,
            sqlBatchPerSec,
            null
        );
    }

    private static class ServerMetricsState {
        Snapshot previous;

        static class Snapshot {
            final long timestamp;
            final double cpuIdleTotal;
            final double cpuTotal;
            final Double diskReadTotal;
            final Double diskWriteTotal;
            final Double netRecvTotal;
            final Double netSentTotal;
            final Double sqlBatchTotal;

            Snapshot(long timestamp, double cpuIdleTotal, double cpuTotal,
                     Double diskReadTotal, Double diskWriteTotal,
                     Double netRecvTotal, Double netSentTotal, Double sqlBatchTotal) {
                this.timestamp = timestamp;
                this.cpuIdleTotal = cpuIdleTotal;
                this.cpuTotal = cpuTotal;
                this.diskReadTotal = diskReadTotal;
                this.diskWriteTotal = diskWriteTotal;
                this.netRecvTotal = netRecvTotal;
                this.netSentTotal = netSentTotal;
                this.sqlBatchTotal = sqlBatchTotal;
            }
        }
    }
}
