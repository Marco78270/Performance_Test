package com.gatlingweb.dto;

public record ThresholdRuleDto(
    String metric,
    String operator,
    double value,
    String label
) {}
