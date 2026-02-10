package com.gatlingweb.dto;

public record MetricsSnapshot(
    long timestamp,
    double requestsPerSecond,
    double errorsPerSecond,
    double meanResponseTime,
    double p50,
    double p75,
    double p95,
    double p99,
    int activeUsers,
    long totalRequests,
    long totalErrors
) {}
