package com.gatlingweb.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.gatlingweb.dto.*;
import com.gatlingweb.entity.TestRun;
import com.gatlingweb.entity.ThresholdProfile;
import com.gatlingweb.entity.ThresholdVerdict;
import com.gatlingweb.repository.TestRunRepository;
import com.gatlingweb.repository.ThresholdProfileRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
public class ThresholdService {

    private static final Logger log = LoggerFactory.getLogger(ThresholdService.class);

    private final ThresholdProfileRepository profileRepository;
    private final TestRunRepository testRunRepository;
    private final ObjectMapper objectMapper;

    public ThresholdService(ThresholdProfileRepository profileRepository,
                           TestRunRepository testRunRepository,
                           ObjectMapper objectMapper) {
        this.profileRepository = profileRepository;
        this.testRunRepository = testRunRepository;
        this.objectMapper = objectMapper;
    }

    public List<ThresholdProfileDto> findAll() {
        return profileRepository.findAllByOrderByNameAsc().stream()
            .map(ThresholdProfileDto::from)
            .toList();
    }

    public ThresholdProfileDto findById(Long id) {
        return profileRepository.findById(id)
            .map(ThresholdProfileDto::from)
            .orElseThrow(() -> new IllegalArgumentException("Profile not found: " + id));
    }

    @Transactional
    public ThresholdProfileDto create(CreateThresholdProfileRequest request) {
        // Check uniqueness
        profileRepository.findBySimulationClass(request.simulationClass()).ifPresent(existing -> {
            throw new IllegalStateException("A profile already exists for simulation: " + request.simulationClass());
        });

        ThresholdProfile profile = new ThresholdProfile();
        profile.setName(request.name());
        profile.setSimulationClass(request.simulationClass());
        profile.setRules(serializeRules(request.rules()));
        profile.setCreatedAt(System.currentTimeMillis());
        profile.setUpdatedAt(System.currentTimeMillis());
        return ThresholdProfileDto.from(profileRepository.save(profile));
    }

    @Transactional
    public ThresholdProfileDto update(Long id, CreateThresholdProfileRequest request) {
        ThresholdProfile profile = profileRepository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Profile not found: " + id));

        // Check if simulationClass changed and the new one already has a profile
        if (!profile.getSimulationClass().equals(request.simulationClass())) {
            profileRepository.findBySimulationClass(request.simulationClass()).ifPresent(existing -> {
                throw new IllegalStateException("A profile already exists for simulation: " + request.simulationClass());
            });
        }

        profile.setName(request.name());
        profile.setSimulationClass(request.simulationClass());
        profile.setRules(serializeRules(request.rules()));
        profile.setUpdatedAt(System.currentTimeMillis());
        return ThresholdProfileDto.from(profileRepository.save(profile));
    }

    @Transactional
    public void delete(Long id) {
        if (!profileRepository.existsById(id)) {
            throw new IllegalArgumentException("Profile not found: " + id);
        }
        profileRepository.deleteById(id);
    }

    public void evaluateThresholds(TestRun run) {
        Optional<ThresholdProfile> profileOpt = profileRepository
            .findBySimulationClass(run.getSimulationClass());
        if (profileOpt.isEmpty()) return;

        ThresholdProfile profile = profileOpt.get();
        List<ThresholdRuleDto> rules;
        try {
            rules = objectMapper.readValue(profile.getRules(), new TypeReference<>() {});
        } catch (Exception e) {
            log.error("Failed to parse threshold rules for profile {}", profile.getId(), e);
            return;
        }

        List<ThresholdEvaluationResult> results = new ArrayList<>();
        boolean allPassed = true;

        for (ThresholdRuleDto rule : rules) {
            double actual = getMetricValue(run, rule.metric());
            boolean passed = evaluate(actual, rule.operator(), rule.value());
            results.add(new ThresholdEvaluationResult(
                rule.metric(), rule.operator(), rule.value(), actual, passed
            ));
            if (!passed) allPassed = false;
        }

        run.setThresholdVerdict(allPassed ? ThresholdVerdict.PASSED : ThresholdVerdict.FAILED);
        run.setThresholdProfileId(profile.getId());
        try {
            run.setThresholdDetails(objectMapper.writeValueAsString(results));
        } catch (Exception e) {
            log.error("Failed to serialize threshold results", e);
        }
        testRunRepository.save(run);
        log.info("Threshold evaluation for test {}: {}", run.getId(), run.getThresholdVerdict());
    }

    double getMetricValue(TestRun run, String metric) {
        return switch (metric) {
            case "meanResponseTime" -> run.getMeanResponseTime() != null ? run.getMeanResponseTime() : 0;
            case "p50ResponseTime" -> run.getP50ResponseTime() != null ? run.getP50ResponseTime() : 0;
            case "p75ResponseTime" -> run.getP75ResponseTime() != null ? run.getP75ResponseTime() : 0;
            case "p95ResponseTime" -> run.getP95ResponseTime() != null ? run.getP95ResponseTime() : 0;
            case "p99ResponseTime" -> run.getP99ResponseTime() != null ? run.getP99ResponseTime() : 0;
            case "errorRate" -> {
                long total = run.getTotalRequests() != null ? run.getTotalRequests() : 0;
                long errors = run.getTotalErrors() != null ? run.getTotalErrors() : 0;
                yield total > 0 ? (double) errors / total * 100 : 0;
            }
            default -> 0;
        };
    }

    boolean evaluate(double actual, String operator, double threshold) {
        return switch (operator) {
            case "LT" -> actual < threshold;
            case "LTE" -> actual <= threshold;
            case "GT" -> actual > threshold;
            case "GTE" -> actual >= threshold;
            default -> false;
        };
    }

    private String serializeRules(List<ThresholdRuleDto> rules) {
        try {
            return objectMapper.writeValueAsString(rules);
        } catch (Exception e) {
            throw new RuntimeException("Failed to serialize rules", e);
        }
    }
}
