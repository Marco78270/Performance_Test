package com.gatlingweb.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record LaunchRequest(
    @NotBlank(message = "simulationClass is required")
    @Pattern(regexp = "^[a-zA-Z_][a-zA-Z0-9_]*(\\.[a-zA-Z_][a-zA-Z0-9_]*)*$",
             message = "simulationClass must be a valid fully-qualified class name")
    String simulationClass,
    String version,
    @Min(value = 1, message = "users must be at least 1")
    Integer users,
    Boolean rampUp,
    @Min(value = 1, message = "rampUpDuration must be at least 1")
    Integer rampUpDuration,
    @Min(value = 1, message = "duration must be at least 1")
    Integer duration,
    Boolean loop,
    @Min(value = 1, message = "bandwidthLimitMbps must be at least 1")
    @Max(value = 10000, message = "bandwidthLimitMbps must not exceed 10000")
    Integer bandwidthLimitMbps
) {}
