package com.gatlingweb.dto;

public record ThresholdEvaluationResult(
    String metric,
    String operator,
    double threshold,
    double actual,
    boolean passed
) {}
