package com.gatlingweb.service;

import com.gatlingweb.dto.MetricsSnapshot;
import com.gatlingweb.repository.InfraMetricsPointRepository;
import com.gatlingweb.repository.MetricsPointRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MetricsPersistenceServiceTest {

    @Mock
    private MetricsPointRepository metricsRepo;
    @Mock
    private InfraMetricsPointRepository infraRepo;

    private MetricsPersistenceService service;

    @BeforeEach
    void setUp() {
        service = new MetricsPersistenceService(metricsRepo, infraRepo);
    }

    @Test
    void buffer_belowBatchSize_doesNotFlush() {
        for (int i = 0; i < 4; i++) {
            service.buffer(1L, createSnapshot());
        }
        verify(metricsRepo, never()).saveAll(anyList());
    }

    @Test
    void buffer_atBatchSize_flushes() {
        for (int i = 0; i < 5; i++) {
            service.buffer(1L, createSnapshot());
        }
        verify(metricsRepo, times(1)).saveAll(anyList());
    }

    @Test
    void buffer_multipleBatches_flushesEachTime() {
        for (int i = 0; i < 12; i++) {
            service.buffer(1L, createSnapshot());
        }
        verify(metricsRepo, times(2)).saveAll(anyList());
    }

    @Test
    void flush_manualFlush_savesRemainingBuffer() {
        // Add 3 (less than batch size)
        for (int i = 0; i < 3; i++) {
            service.buffer(1L, createSnapshot());
        }
        verify(metricsRepo, never()).saveAll(anyList());

        service.flush();
        verify(metricsRepo, times(1)).saveAll(anyList());
    }

    @Test
    void flush_emptyBuffer_doesNotCallSaveAll() {
        service.flush();
        verify(metricsRepo, never()).saveAll(anyList());
        verify(infraRepo, never()).saveAll(anyList());
    }

    private MetricsSnapshot createSnapshot() {
        return new MetricsSnapshot(
                System.currentTimeMillis(), 10.0, 0.0, 150.0,
                100.0, 120.0, 200.0, 300.0, 5, 100L, 0L
        );
    }
}
