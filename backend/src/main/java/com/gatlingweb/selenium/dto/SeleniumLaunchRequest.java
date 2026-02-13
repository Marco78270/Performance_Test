package com.gatlingweb.selenium.dto;

import jakarta.validation.constraints.*;

public record SeleniumLaunchRequest(
    @NotBlank(message = "scriptClass is required")
    @Pattern(regexp = "^[a-zA-Z_][a-zA-Z0-9_]*$", message = "scriptClass must be a valid class name")
    String scriptClass,

    @NotBlank(message = "browser is required")
    @Pattern(regexp = "^(chrome|firefox|edge)$", message = "browser must be chrome, firefox, or edge")
    String browser,

    @Min(value = 1, message = "instances must be at least 1")
    @Max(value = 20, message = "instances must not exceed 20")
    int instances,

    String version,

    boolean headless,

    @Min(value = 1, message = "loops must be at least 1")
    @Max(value = 100, message = "loops must not exceed 100")
    int loops,

    @Min(value = 0, message = "rampUpSeconds must be at least 0")
    @Max(value = 600, message = "rampUpSeconds must not exceed 600")
    int rampUpSeconds
) {
    public SeleniumLaunchRequest {
        if (loops == 0) loops = 1;
    }
}
