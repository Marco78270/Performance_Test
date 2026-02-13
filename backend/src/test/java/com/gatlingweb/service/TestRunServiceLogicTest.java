package com.gatlingweb.service;

import com.gatlingweb.entity.TestRun;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.mock;

class TestRunServiceLogicTest {

    private TestRunService service;

    @BeforeEach
    void setUp() {
        service = new TestRunService(
                mock(com.gatlingweb.repository.TestRunRepository.class),
                mock(GatlingExecutionService.class),
                mock(MetricsPersistenceService.class),
                new com.fasterxml.jackson.databind.ObjectMapper(),
                mock(org.springframework.messaging.simp.SimpMessagingTemplate.class)
        );
    }

    // --- calcDiff() tests ---

    @Test
    void calcDiff_normalCase_returnsPercentageDifference() {
        // a=100, b=150 => ((150-100)/100)*100 = 50.0%
        assertThat(service.calcDiff(100.0, 150.0)).isEqualTo(50.0);
    }

    @Test
    void calcDiff_aIsNull_returnsNull() {
        assertThat(service.calcDiff(null, 150.0)).isNull();
    }

    @Test
    void calcDiff_bIsNull_returnsNull() {
        assertThat(service.calcDiff(100.0, null)).isNull();
    }

    @Test
    void calcDiff_aIsZero_returnsNull() {
        assertThat(service.calcDiff(0.0, 150.0)).isNull();
    }

    @Test
    void calcDiff_negativeChange_returnsNegativePercentage() {
        // a=200, b=100 => ((100-200)/200)*100 = -50.0%
        assertThat(service.calcDiff(200.0, 100.0)).isEqualTo(-50.0);
    }

    @Test
    void calcDiff_sameValues_returnsZero() {
        assertThat(service.calcDiff(100.0, 100.0)).isEqualTo(0.0);
    }

    // --- errorRate() tests ---

    @Test
    void errorRate_noRequests_returnsZero() {
        TestRun run = new TestRun();
        run.setTotalRequests(0L);
        run.setTotalErrors(0L);
        assertThat(service.errorRate(run)).isEqualTo(0.0);
    }

    @Test
    void errorRate_noErrors_returnsZero() {
        TestRun run = new TestRun();
        run.setTotalRequests(100L);
        run.setTotalErrors(0L);
        assertThat(service.errorRate(run)).isEqualTo(0.0);
    }

    @Test
    void errorRate_allErrors_returns100() {
        TestRun run = new TestRun();
        run.setTotalRequests(100L);
        run.setTotalErrors(100L);
        assertThat(service.errorRate(run)).isEqualTo(100.0);
    }

    @Test
    void errorRate_halfErrors_returns50() {
        TestRun run = new TestRun();
        run.setTotalRequests(200L);
        run.setTotalErrors(100L);
        assertThat(service.errorRate(run)).isEqualTo(50.0);
    }

    @Test
    void errorRate_nullFields_treatedAsZero() {
        TestRun run = new TestRun();
        // Both fields null by default
        assertThat(service.errorRate(run)).isEqualTo(0.0);
    }
}
