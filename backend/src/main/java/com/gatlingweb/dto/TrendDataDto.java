package com.gatlingweb.dto;

import java.util.List;

public record TrendDataDto(
    String simulationClass,
    List<TrendPointDto> points,
    double thresholdPassRate
) {}
