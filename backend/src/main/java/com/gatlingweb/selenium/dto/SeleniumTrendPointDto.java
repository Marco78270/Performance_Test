package com.gatlingweb.selenium.dto;

public record SeleniumTrendPointDto(
    Long testRunId,
    String startTime,
    String version,
    Double meanStepDuration,
    double passRate,
    int totalIterations
) {}
