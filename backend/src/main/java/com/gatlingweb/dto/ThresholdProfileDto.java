package com.gatlingweb.dto;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.gatlingweb.entity.ThresholdProfile;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;

public record ThresholdProfileDto(
    Long id,
    String name,
    String simulationClass,
    List<ThresholdRuleDto> rules,
    LocalDateTime createdAt,
    LocalDateTime updatedAt
) {
    private static final ObjectMapper MAPPER = new ObjectMapper();

    public static ThresholdProfileDto from(ThresholdProfile profile) {
        List<ThresholdRuleDto> ruleList;
        try {
            ruleList = MAPPER.readValue(profile.getRules(), new TypeReference<>() {});
        } catch (Exception e) {
            ruleList = List.of();
        }
        return new ThresholdProfileDto(
            profile.getId(),
            profile.getName(),
            profile.getSimulationClass(),
            ruleList,
            epochToLocalDateTime(profile.getCreatedAt()),
            epochToLocalDateTime(profile.getUpdatedAt())
        );
    }

    private static LocalDateTime epochToLocalDateTime(Long epochMillis) {
        if (epochMillis == null) return null;
        return LocalDateTime.ofInstant(Instant.ofEpochMilli(epochMillis), ZoneId.systemDefault());
    }
}
