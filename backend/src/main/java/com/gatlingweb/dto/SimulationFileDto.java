package com.gatlingweb.dto;

public record SimulationFileDto(
    String path,
    String name,
    boolean directory,
    java.util.List<SimulationFileDto> children
) {}
