package com.gatlingweb.dto;

import java.util.Map;

public record ComparisonDto(
    TestRunDto testA,
    TestRunDto testB,
    Map<String, Double> diffPercent
) {}
