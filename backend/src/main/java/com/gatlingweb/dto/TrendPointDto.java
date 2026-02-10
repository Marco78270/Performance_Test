package com.gatlingweb.dto;

public record TrendPointDto(
    Long testRunId,
    String startTime,
    String version,
    Long totalRequests,
    Long totalErrors,
    Double meanResponseTime,
    Double p95ResponseTime,
    Double errorRate,
    String thresholdVerdict
) {}
