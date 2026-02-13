package com.gatlingweb.selenium.dto;

public record SeleniumMetricsSnapshot(
    long timestamp,
    double iterationsPerSecond,
    double errorsPerSecond,
    double meanStepDuration,
    double p50,
    double p75,
    double p95,
    double p99,
    int activeBrowsers,
    long totalIterations,
    long totalErrors,
    Double cpuPercent,
    Double memoryPercent
) {}
