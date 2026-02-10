package com.gatlingweb.dto;

import com.gatlingweb.entity.ServerType;

public record InfraMetricsSnapshot(
    long timestamp,
    Long serverId,
    String serverName,
    ServerType serverType,
    Double cpuPercent,
    Long memoryUsedBytes,
    Long memoryTotalBytes,
    Double memoryPercent,
    Double diskReadBytesPerSec,
    Double diskWriteBytesPerSec,
    Double networkRecvBytesPerSec,
    Double networkSentBytesPerSec,
    Double sqlBatchPerSec,
    String error
) {
    public static InfraMetricsSnapshot error(Long serverId, String serverName, ServerType serverType, String error) {
        return new InfraMetricsSnapshot(
            System.currentTimeMillis(),
            serverId,
            serverName,
            serverType,
            null, null, null, null, null, null, null, null, null,
            error
        );
    }
}
