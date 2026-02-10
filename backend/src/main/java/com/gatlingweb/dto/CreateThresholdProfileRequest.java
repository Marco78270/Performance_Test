package com.gatlingweb.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;

public record CreateThresholdProfileRequest(
    @NotBlank String name,
    @NotBlank String simulationClass,
    @NotEmpty List<ThresholdRuleDto> rules
) {}
