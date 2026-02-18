package com.gatlingweb.selenium.dto;

import com.gatlingweb.selenium.entity.SeleniumTestRun;

import java.util.Map;

public record SeleniumComparisonDto(
    SeleniumTestRun testA,
    SeleniumTestRun testB,
    Map<String, Double> diffPercent,
    Map<String, Double> aggregatedA,
    Map<String, Double> aggregatedB
) {}
