package com.gatlingweb.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.gatlingweb.entity.TestRun;
import com.gatlingweb.entity.TestStatus;
import com.gatlingweb.entity.ThresholdProfile;
import com.gatlingweb.entity.ThresholdVerdict;
import com.gatlingweb.repository.TestRunRepository;
import com.gatlingweb.repository.ThresholdProfileRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ThresholdServiceTest {

    @Mock
    private ThresholdProfileRepository profileRepository;
    @Mock
    private TestRunRepository testRunRepository;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private ThresholdService service;

    @BeforeEach
    void setUp() {
        service = new ThresholdService(profileRepository, testRunRepository, objectMapper);
    }

    @Test
    void evaluateThresholds_noProfile_doesNothing() {
        TestRun run = createTestRun();
        when(profileRepository.findBySimulationClass("com.example.Sim")).thenReturn(Optional.empty());

        service.evaluateThresholds(run);

        assertThat(run.getThresholdVerdict()).isNull();
        verify(testRunRepository, never()).save(any());
    }

    @Test
    void evaluateThresholds_allRulesPass_setsPassedVerdict() {
        TestRun run = createTestRun();
        run.setMeanResponseTime(100.0);
        run.setP95ResponseTime(200.0);

        ThresholdProfile profile = createProfile(
                "[{\"metric\":\"meanResponseTime\",\"operator\":\"LT\",\"value\":500}," +
                        "{\"metric\":\"p95ResponseTime\",\"operator\":\"LT\",\"value\":1000}]"
        );
        when(profileRepository.findBySimulationClass("com.example.Sim")).thenReturn(Optional.of(profile));

        service.evaluateThresholds(run);

        assertThat(run.getThresholdVerdict()).isEqualTo(ThresholdVerdict.PASSED);
        verify(testRunRepository).save(run);
    }

    @Test
    void evaluateThresholds_oneRuleFails_setsFailedVerdict() {
        TestRun run = createTestRun();
        run.setMeanResponseTime(600.0); // > 500 threshold
        run.setP95ResponseTime(200.0);

        ThresholdProfile profile = createProfile(
                "[{\"metric\":\"meanResponseTime\",\"operator\":\"LT\",\"value\":500}," +
                        "{\"metric\":\"p95ResponseTime\",\"operator\":\"LT\",\"value\":1000}]"
        );
        when(profileRepository.findBySimulationClass("com.example.Sim")).thenReturn(Optional.of(profile));

        service.evaluateThresholds(run);

        assertThat(run.getThresholdVerdict()).isEqualTo(ThresholdVerdict.FAILED);
        verify(testRunRepository).save(run);
    }

    @Test
    void evaluateThresholds_malformedRulesJson_returnsWithoutCrash() {
        TestRun run = createTestRun();

        ThresholdProfile profile = createProfile("this is not valid json");
        when(profileRepository.findBySimulationClass("com.example.Sim")).thenReturn(Optional.of(profile));

        service.evaluateThresholds(run);

        assertThat(run.getThresholdVerdict()).isNull();
        verify(testRunRepository, never()).save(any());
    }

    @Test
    void evaluateThresholds_savesDetailsAsJson() {
        TestRun run = createTestRun();
        run.setMeanResponseTime(100.0);

        ThresholdProfile profile = createProfile(
                "[{\"metric\":\"meanResponseTime\",\"operator\":\"LT\",\"value\":500}]"
        );
        when(profileRepository.findBySimulationClass("com.example.Sim")).thenReturn(Optional.of(profile));

        service.evaluateThresholds(run);

        assertThat(run.getThresholdDetails()).isNotNull();
        assertThat(run.getThresholdDetails()).contains("meanResponseTime");
        assertThat(run.getThresholdDetails()).contains("true"); // passed
    }

    private TestRun createTestRun() {
        TestRun run = new TestRun();
        run.setId(1L);
        run.setSimulationClass("com.example.Sim");
        run.setStatus(TestStatus.COMPLETED);
        run.setTotalRequests(1000L);
        run.setTotalErrors(0L);
        return run;
    }

    private ThresholdProfile createProfile(String rulesJson) {
        ThresholdProfile profile = new ThresholdProfile();
        profile.setId(1L);
        profile.setName("Test Profile");
        profile.setSimulationClass("com.example.Sim");
        profile.setRules(rulesJson);
        return profile;
    }
}
