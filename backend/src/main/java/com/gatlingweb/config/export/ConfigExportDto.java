package com.gatlingweb.config.export;

import java.util.List;

public record ConfigExportDto(
    String version,
    String exportedAt,
    List<ThresholdProfileExport> thresholdProfiles,
    List<MonitoredServerExport> monitoredServers,
    List<AppSettingExport> appSettings
) {
    public record ThresholdProfileExport(String name, String simulationClass, String rules) {}
    public record MonitoredServerExport(String name, String url, String serverType, boolean enabled) {}
    public record AppSettingExport(String key, String value) {}
}
