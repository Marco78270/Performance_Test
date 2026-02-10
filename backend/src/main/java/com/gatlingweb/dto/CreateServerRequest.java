package com.gatlingweb.dto;

import com.gatlingweb.entity.ServerType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record CreateServerRequest(
    @NotBlank(message = "Name is required")
    String name,

    @NotBlank(message = "URL is required")
    String url,

    @NotNull(message = "Server type is required")
    ServerType serverType
) {}
