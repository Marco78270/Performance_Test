package com.gatlingweb.dto;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.gatlingweb.entity.TestRun;
import com.gatlingweb.entity.TestStatus;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;

public record TestRunDto(
    Long id,
    String simulationClass,
    String version,
    TestStatus status,
    LocalDateTime startTime,
    LocalDateTime endTime,
    String reportPath,
    Long totalRequests,
    Long totalErrors,
    Double meanResponseTime,
    Double p50ResponseTime,
    Double p75ResponseTime,
    Double p95ResponseTime,
    Double p99ResponseTime,
    List<String> labels,
    String thresholdVerdict,
    Long thresholdProfileId,
    List<ThresholdEvaluationResult> thresholdDetails,
    Integer bandwidthLimitMbps
) {
    private static final ObjectMapper MAPPER = new ObjectMapper();

    public static TestRunDto from(TestRun run) {
        List<String> labelList = run.getLabels() == null || run.getLabels().isBlank()
            ? List.of()
            : Arrays.stream(run.getLabels().split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();

        List<ThresholdEvaluationResult> details = null;
        if (run.getThresholdDetails() != null && !run.getThresholdDetails().isBlank()) {
            try {
                details = MAPPER.readValue(run.getThresholdDetails(), new TypeReference<>() {});
            } catch (Exception e) {
                details = List.of();
            }
        }

        return new TestRunDto(
            run.getId(), run.getSimulationClass(), run.getVersion(),
            run.getStatus(), run.getStartTime(), run.getEndTime(),
            run.getReportPath(), run.getTotalRequests(), run.getTotalErrors(),
            run.getMeanResponseTime(), run.getP50ResponseTime(),
            run.getP75ResponseTime(), run.getP95ResponseTime(), run.getP99ResponseTime(),
            labelList,
            run.getThresholdVerdict() != null ? run.getThresholdVerdict().name() : null,
            run.getThresholdProfileId(),
            details,
            run.getBandwidthLimitMbps()
        );
    }
}
