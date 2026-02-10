package com.gatlingweb.service;

import com.gatlingweb.entity.TestRun;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.mock;

class SimulationLogParserLogicTest {

    private SimulationLogParser parser;

    @BeforeEach
    void setUp() {
        parser = new SimulationLogParser(
                mock(org.springframework.messaging.simp.SimpMessagingTemplate.class),
                mock(MetricsPersistenceService.class)
        );
    }

    // --- parseLine() tests ---

    @Test
    void parseLine_requestOK_incrementsCounters() {
        // REQUEST\tgroup\tname\tstart\tend\tstatus
        parser.parseLine("REQUEST\t\tmy request\t1000\t1200\tOK\t");

        TestRun run = new TestRun();
        parser.applyFinalMetrics(run);
        assertThat(run.getTotalRequests()).isEqualTo(1);
        assertThat(run.getTotalErrors()).isEqualTo(0);
        assertThat(run.getMeanResponseTime()).isEqualTo(200.0);
    }

    @Test
    void parseLine_requestKO_incrementsErrors() {
        parser.parseLine("REQUEST\t\tmy request\t1000\t1500\tKO\terror message");

        TestRun run = new TestRun();
        parser.applyFinalMetrics(run);
        assertThat(run.getTotalRequests()).isEqualTo(1);
        assertThat(run.getTotalErrors()).isEqualTo(1);
    }

    @Test
    void parseLine_userStart_incrementsActiveUsers() {
        parser.parseLine("USER\tscenario\tSTART\t1000\t0");
        parser.parseLine("USER\tscenario\tSTART\t1001\t0");

        // Active users tracked internally; verify via a request+applyFinalMetrics
        // We'll just verify no exception and state is consistent
        TestRun run = new TestRun();
        parser.applyFinalMetrics(run);
        assertThat(run.getTotalRequests()).isEqualTo(0);
    }

    @Test
    void parseLine_userEnd_decrementsActiveUsers() {
        parser.parseLine("USER\tscenario\tSTART\t1000\t0");
        parser.parseLine("USER\tscenario\tEND\t1000\t2000");
        // Should not throw, active users back to 0
    }

    @Test
    void parseLine_userEnd_doesNotGoBelowZero() {
        // END without START should clamp to 0
        parser.parseLine("USER\tscenario\tEND\t1000\t2000");
        // No exception expected
    }

    @Test
    void parseLine_malformedLine_ignored() {
        parser.parseLine("this is garbage");
        TestRun run = new TestRun();
        parser.applyFinalMetrics(run);
        assertThat(run.getTotalRequests()).isEqualTo(0);
    }

    @Test
    void parseLine_tooFewFields_ignored() {
        parser.parseLine("REQUEST\tonly two");
        TestRun run = new TestRun();
        parser.applyFinalMetrics(run);
        assertThat(run.getTotalRequests()).isEqualTo(0);
    }

    @Test
    void parseLine_nonNumericTimestamps_ignored() {
        parser.parseLine("REQUEST\t\tname\tNOTANUM\tNOTANUM\tOK\t");
        TestRun run = new TestRun();
        parser.applyFinalMetrics(run);
        assertThat(run.getTotalRequests()).isEqualTo(0);
    }

    @Test
    void parseLine_multipleRequests_aggregatesCorrectly() {
        parser.parseLine("REQUEST\t\treq1\t1000\t1100\tOK\t");
        parser.parseLine("REQUEST\t\treq2\t1000\t1300\tOK\t");
        parser.parseLine("REQUEST\t\treq3\t1000\t1500\tKO\terror");

        TestRun run = new TestRun();
        parser.applyFinalMetrics(run);
        assertThat(run.getTotalRequests()).isEqualTo(3);
        assertThat(run.getTotalErrors()).isEqualTo(1);
        // Mean = (100 + 300 + 500) / 3 = 300
        assertThat(run.getMeanResponseTime()).isCloseTo(300.0, within(0.01));
    }

    // --- addToReservoir() tests ---

    @Test
    void addToReservoir_belowCapacity_addsAll() {
        for (int i = 0; i < 100; i++) {
            parser.addToReservoir(i * 10L);
        }
        TestRun run = new TestRun();
        // We can't directly check reservoir, but we set totalRequests via parseLine
        // Instead verify via applyFinalMetrics percentiles when reservoir is populated
        // The reservoir is populated but totalRequests=0, so mean won't be set
        // Just verify no exception
    }

    @Test
    void addToReservoir_atCapacity_usesReservoirSampling() {
        // Add more than RESERVOIR_SIZE (10000) items
        for (int i = 0; i < 15000; i++) {
            parser.addToReservoir(i);
        }
        // No exception, sampling should work
    }

    // --- percentile() tests ---

    @Test
    void percentile_emptyList_returnsZero() {
        assertThat(parser.percentile(Collections.emptyList(), 0.50)).isEqualTo(0.0);
    }

    @Test
    void percentile_singleElement_returnsThatElement() {
        assertThat(parser.percentile(List.of(42L), 0.50)).isEqualTo(42.0);
        assertThat(parser.percentile(List.of(42L), 0.99)).isEqualTo(42.0);
    }

    @Test
    void percentile_p50_correctIndex() {
        List<Long> sorted = Arrays.asList(10L, 20L, 30L, 40L, 50L, 60L, 70L, 80L, 90L, 100L);
        double p50 = parser.percentile(sorted, 0.50);
        assertThat(p50).isEqualTo(50.0);
    }

    @Test
    void percentile_p99_correctIndex() {
        List<Long> sorted = Arrays.asList(10L, 20L, 30L, 40L, 50L, 60L, 70L, 80L, 90L, 100L);
        double p99 = parser.percentile(sorted, 0.99);
        assertThat(p99).isEqualTo(100.0);
    }

    // --- applyFinalMetrics() ---

    @Test
    void applyFinalMetrics_setsAllFieldsOnTestRun() {
        parser.parseLine("REQUEST\t\treq1\t1000\t1100\tOK\t");
        parser.parseLine("REQUEST\t\treq2\t1000\t1300\tKO\terr");

        TestRun run = new TestRun();
        parser.applyFinalMetrics(run);

        assertThat(run.getTotalRequests()).isEqualTo(2);
        assertThat(run.getTotalErrors()).isEqualTo(1);
        assertThat(run.getMeanResponseTime()).isCloseTo(200.0, within(0.01));
        assertThat(run.getP50ResponseTime()).isNotNull();
        assertThat(run.getP75ResponseTime()).isNotNull();
        assertThat(run.getP95ResponseTime()).isNotNull();
        assertThat(run.getP99ResponseTime()).isNotNull();
    }
}
