package com.gatlingweb.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

public record LaunchRequest(
    @NotBlank(message = "simulationClass is required")
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
    Integer bandwidthLimitMbps
) {}
