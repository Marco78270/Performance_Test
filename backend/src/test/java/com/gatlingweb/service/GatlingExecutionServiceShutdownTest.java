package com.gatlingweb.service;

import com.gatlingweb.entity.TestRun;
import com.gatlingweb.entity.TestStatus;
import com.gatlingweb.repository.TestRunRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class GatlingExecutionServiceShutdownTest {

    @Test
    void shutdown_withNoProcess_completesCleanly() {
        TestRunRepository repository = mock(TestRunRepository.class);
        GatlingExecutionService service = new GatlingExecutionService(
                repository,
                mock(SimulationLogParser.class),
                mock(MetricsPersistenceService.class),
                mock(SimpMessagingTemplate.class),
                mock(InfraMetricsScraperService.class),
                mock(ThresholdService.class),
                mock(BandwidthLimiterService.class),
                System.getProperty("java.io.tmpdir"),
                1
        );

        // Should complete without exception when no process is running
        assertThatCode(service::shutdown).doesNotThrowAnyException();
    }

    @Test
    void shutdown_marksRunningTestAsFailed() {
        TestRunRepository repository = mock(TestRunRepository.class);
        GatlingExecutionService service = new GatlingExecutionService(
                repository,
                mock(SimulationLogParser.class),
                mock(MetricsPersistenceService.class),
                mock(SimpMessagingTemplate.class),
                mock(InfraMetricsScraperService.class),
                mock(ThresholdService.class),
                mock(BandwidthLimiterService.class),
                System.getProperty("java.io.tmpdir"),
                1
        );

        // Simulate a running test by launching one
        TestRun run = new TestRun();
        run.setId(1L);
        run.setStatus(TestStatus.RUNNING);
        run.setSimulationClass("com.example.Sim");
        when(repository.save(any(TestRun.class))).thenReturn(run);
        when(repository.findById(1L)).thenReturn(Optional.of(run));

        // Launch creates the test and sets currentTestRunId
        service.launch("com.example.Sim", "v1");

        // Now shutdown should mark it as FAILED
        service.shutdown();

        assertThat(run.getStatus()).isEqualTo(TestStatus.FAILED);
        assertThat(run.getEndTime()).isNotNull();
    }
}
