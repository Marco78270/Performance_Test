package com.gatlingweb.dto;

import com.gatlingweb.entity.MonitoredServer;
import com.gatlingweb.entity.ServerType;
import java.time.LocalDateTime;

public record MonitoredServerDto(
    Long id,
    String name,
    String url,
    ServerType serverType,
    Boolean enabled,
    LocalDateTime lastSeenAt,
    String lastError
) {
    public static MonitoredServerDto from(MonitoredServer server) {
        return new MonitoredServerDto(
            server.getId(),
            server.getName(),
            server.getUrl(),
            server.getServerType(),
            server.getEnabled(),
            server.getLastSeenAt(),
            server.getLastError()
        );
    }
}
