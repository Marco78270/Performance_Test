package com.gatlingweb.service;

import com.gatlingweb.entity.TestRun;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.mock;

class ThresholdServiceLogicTest {

    private ThresholdService service;

    @BeforeEach
    void setUp() {
        service = new ThresholdService(
                mock(com.gatlingweb.repository.ThresholdProfileRepository.class),
                mock(com.gatlingweb.repository.TestRunRepository.class),
                new com.fasterxml.jackson.databind.ObjectMapper()
        );
    }

    // --- evaluate() tests ---

    @ParameterizedTest
    @CsvSource({
            "LT,  100.0, 200.0, true",
            "LT,  200.0, 100.0, false",
            "LT,  100.0, 100.0, false",
            "LTE, 100.0, 100.0, true",
            "LTE, 100.1, 100.0, false",
            "GT,  200.0, 100.0, true",
            "GT,  100.0, 100.0, false",
            "GTE, 100.0, 100.0, true",
            "GTE, 99.9,  100.0, false"
    })
    void evaluate_allOperators(String operator, double actual, double threshold, boolean expected) {
        assertThat(service.evaluate(actual, operator, threshold)).isEqualTo(expected);
    }

    @Test
    void evaluate_unknownOperator_returnsFalse() {
        assertThat(service.evaluate(100.0, "INVALID", 200.0)).isFalse();
    }

    // --- getMetricValue() tests ---

    @Test
    void getMetricValue_meanResponseTime() {
        TestRun run = new TestRun();
        run.setMeanResponseTime(250.5);
        assertThat(service.getMetricValue(run, "meanResponseTime")).isEqualTo(250.5);
    }

    @Test
    void getMetricValue_allPercentiles() {
        TestRun run = new TestRun();
        run.setP50ResponseTime(100.0);
        run.setP75ResponseTime(200.0);
        run.setP95ResponseTime(300.0);
        run.setP99ResponseTime(400.0);

        assertThat(service.getMetricValue(run, "p50ResponseTime")).isEqualTo(100.0);
        assertThat(service.getMetricValue(run, "p75ResponseTime")).isEqualTo(200.0);
        assertThat(service.getMetricValue(run, "p95ResponseTime")).isEqualTo(300.0);
        assertThat(service.getMetricValue(run, "p99ResponseTime")).isEqualTo(400.0);
    }

    @Test
    void getMetricValue_errorRate_calculatesCorrectly() {
        TestRun run = new TestRun();
        run.setTotalRequests(200L);
        run.setTotalErrors(10L);
        assertThat(service.getMetricValue(run, "errorRate")).isEqualTo(5.0);
    }

    @Test
    void getMetricValue_errorRate_zeroRequests_returnsZero() {
        TestRun run = new TestRun();
        run.setTotalRequests(0L);
        run.setTotalErrors(0L);
        assertThat(service.getMetricValue(run, "errorRate")).isEqualTo(0.0);
    }

    @Test
    void getMetricValue_nullMetrics_returnZero() {
        TestRun run = new TestRun();
        // All fields are null by default
        assertThat(service.getMetricValue(run, "meanResponseTime")).isEqualTo(0.0);
        assertThat(service.getMetricValue(run, "p50ResponseTime")).isEqualTo(0.0);
        assertThat(service.getMetricValue(run, "p95ResponseTime")).isEqualTo(0.0);
    }

    @Test
    void getMetricValue_unknownMetric_returnsZero() {
        TestRun run = new TestRun();
        run.setMeanResponseTime(100.0);
        assertThat(service.getMetricValue(run, "nonExistentMetric")).isEqualTo(0.0);
    }
}
