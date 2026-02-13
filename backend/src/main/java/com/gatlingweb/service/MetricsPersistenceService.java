package com.gatlingweb.service;

import com.gatlingweb.dto.InfraMetricsSnapshot;
import com.gatlingweb.dto.MetricsSnapshot;
import com.gatlingweb.entity.InfraMetricsPoint;
import com.gatlingweb.entity.MetricsPoint;
import com.gatlingweb.repository.InfraMetricsPointRepository;
import com.gatlingweb.repository.MetricsPointRepository;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

@Service
public class MetricsPersistenceService {

    private static final Logger log = LoggerFactory.getLogger(MetricsPersistenceService.class);
    private static final int BATCH_SIZE = 5;

    private final MetricsPointRepository metricsRepo;
    private final InfraMetricsPointRepository infraRepo;
    private final List<MetricsPoint> metricsBuffer = new ArrayList<>();
    private final List<InfraMetricsPoint> infraBuffer = new ArrayList<>();

    public MetricsPersistenceService(MetricsPointRepository metricsRepo, InfraMetricsPointRepository infraRepo) {
        this.metricsRepo = metricsRepo;
        this.infraRepo = infraRepo;
    }

    public synchronized void buffer(Long testRunId, MetricsSnapshot snapshot) {
        metricsBuffer.add(MetricsPoint.from(testRunId, snapshot));
        if (metricsBuffer.size() >= BATCH_SIZE) {
            flushMetrics();
        }
    }

    public synchronized void bufferInfra(Long testRunId, InfraMetricsSnapshot snapshot) {
        if (snapshot.error() != null) return; // Don't persist error snapshots
        infraBuffer.add(InfraMetricsPoint.from(testRunId, snapshot));
        if (infraBuffer.size() >= BATCH_SIZE) {
            flushInfra();
        }
    }

    @PreDestroy
    void shutdown() {
        log.info("MetricsPersistenceService shutting down, flushing remaining metrics...");
        flush();
        log.info("MetricsPersistenceService shutdown complete");
    }

    @Transactional
    public synchronized void flush() {
        flushMetrics();
        flushInfra();
    }

    private void flushMetrics() {
        if (!metricsBuffer.isEmpty()) {
            metricsRepo.saveAll(new ArrayList<>(metricsBuffer));
            metricsBuffer.clear();
        }
    }

    private void flushInfra() {
        if (!infraBuffer.isEmpty()) {
            infraRepo.saveAll(new ArrayList<>(infraBuffer));
            infraBuffer.clear();
        }
    }

    @Transactional
    public void deleteMetricsForTest(Long testRunId) {
        metricsRepo.deleteByTestRunId(testRunId);
        infraRepo.deleteByTestRunId(testRunId);
    }

    public List<MetricsSnapshot> getMetrics(Long testRunId) {
        return metricsRepo.findByTestRunIdOrderByTimestampAsc(testRunId)
                .stream()
                .map(MetricsPoint::toSnapshot)
                .toList();
    }

    public List<InfraMetricsSnapshot> getInfraMetrics(Long testRunId) {
        return infraRepo.findByTestRunIdOrderByTimestampAsc(testRunId)
                .stream()
                .map(InfraMetricsPoint::toSnapshot)
                .toList();
    }
}
