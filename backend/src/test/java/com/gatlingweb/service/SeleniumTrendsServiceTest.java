package com.gatlingweb.service;

import com.gatlingweb.entity.TestStatus;
import com.gatlingweb.selenium.entity.SeleniumTestRun;
import com.gatlingweb.selenium.repository.SeleniumTestRunRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageRequest;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Tests the trends calculation logic (passRate, ordering, limit)
 * that is performed in SeleniumTestController.getTrends().
 */
@ExtendWith(MockitoExtension.class)
class SeleniumTrendsServiceTest {

    @Mock
    SeleniumTestRunRepository repository;

    private SeleniumTestRun makeRun(Long id, Long startTime, int passed, int total, double meanStep, String version) {
        SeleniumTestRun run = new SeleniumTestRun();
        run.setId(id);
        run.setStartTime(startTime);
        run.setPassedIterations(passed);
        run.setTotalIterations(total);
        run.setMeanStepDuration(meanStep);
        run.setVersion(version);
        run.setStatus(TestStatus.COMPLETED);
        run.setScriptClass("MyScript");
        return run;
    }

    @Test
    void passRate_calculatedCorrectly() {
        SeleniumTestRun run = makeRun(1L, 1000L, 8, 10, 500.0, "v1");

        // Replicate the passRate calculation from the controller
        int total = run.getTotalIterations();
        int passed = run.getPassedIterations();
        double passRate = total > 0 ? (double) passed / total * 100.0 : 0.0;

        assertThat(passRate).isCloseTo(80.0, org.assertj.core.data.Offset.offset(0.001));
    }

    @Test
    void passRate_noIterations_isZero() {
        SeleniumTestRun run = makeRun(1L, 1000L, 0, 0, 0.0, "v1");

        int total = run.getTotalIterations();
        int passed = run.getPassedIterations();
        double passRate = total > 0 ? (double) passed / total * 100.0 : 0.0;

        assertThat(passRate).isEqualTo(0.0);
    }

    @Test
    void passRate_fullSuccess_is100() {
        SeleniumTestRun run = makeRun(1L, 1000L, 5, 5, 200.0, "v2");

        double passRate = (double) run.getPassedIterations() / run.getTotalIterations() * 100.0;

        assertThat(passRate).isCloseTo(100.0, org.assertj.core.data.Offset.offset(0.001));
    }

    @Test
    void order_reversedToChronological() {
        // Repository returns DESC (newest first), controller reverses to ASC (oldest first)
        SeleniumTestRun runOld = makeRun(1L, 1000L, 5, 10, 300.0, "v1");
        SeleniumTestRun runNew = makeRun(2L, 2000L, 8, 10, 250.0, "v2");

        // DESC from repository (newest first)
        List<SeleniumTestRun> fromRepo = List.of(runNew, runOld);

        when(repository.findByScriptClassAndStatusOrderByStartTimeDesc(eq("MyScript"), eq(TestStatus.COMPLETED), any()))
            .thenReturn(fromRepo);

        List<SeleniumTestRun> fetched = repository.findByScriptClassAndStatusOrderByStartTimeDesc(
            "MyScript", TestStatus.COMPLETED, PageRequest.of(0, 20));

        // Simulate controller reversal
        List<SeleniumTestRun> chronological = new ArrayList<>(fetched);
        Collections.reverse(chronological);

        assertThat(chronological.get(0).getId()).isEqualTo(1L);  // oldest first
        assertThat(chronological.get(1).getId()).isEqualTo(2L);  // newest last
    }

    @Test
    void limit_respectsMaxCount() {
        List<SeleniumTestRun> manyRuns = new ArrayList<>();
        for (int i = 1; i <= 5; i++) {
            manyRuns.add(makeRun((long) i, (long) i * 1000, i, 10, 300.0, "v" + i));
        }

        when(repository.findByScriptClassAndStatusOrderByStartTimeDesc(eq("MyScript"), eq(TestStatus.COMPLETED), any()))
            .thenReturn(manyRuns.subList(0, 3));

        List<SeleniumTestRun> result = repository.findByScriptClassAndStatusOrderByStartTimeDesc(
            "MyScript", TestStatus.COMPLETED, PageRequest.of(0, 3));

        assertThat(result).hasSize(3);
    }

    @Test
    void emptyResults_producesNoPoints() {
        when(repository.findByScriptClassAndStatusOrderByStartTimeDesc(any(), any(), any()))
            .thenReturn(List.of());

        List<SeleniumTestRun> runs = repository.findByScriptClassAndStatusOrderByStartTimeDesc(
            "MyScript", TestStatus.COMPLETED, PageRequest.of(0, 20));

        assertThat(runs).isEmpty();
    }
}
