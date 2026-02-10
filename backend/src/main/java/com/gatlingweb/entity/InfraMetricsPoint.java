package com.gatlingweb.entity;

import com.gatlingweb.dto.InfraMetricsSnapshot;
import jakarta.persistence.*;

@Entity
@Table(name = "infra_metrics_points")
public class InfraMetricsPoint {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long testRunId;
    private long timestamp;
    private Long serverId;
    private String serverName;

    @Enumerated(EnumType.STRING)
    private ServerType serverType;

    private Double cpuPercent;
    private Long memoryUsedBytes;
    private Long memoryTotalBytes;
    private Double memoryPercent;
    private Double diskReadBytesPerSec;
    private Double diskWriteBytesPerSec;
    private Double networkRecvBytesPerSec;
    private Double networkSentBytesPerSec;
    private Double sqlBatchPerSec;

    public InfraMetricsPoint() {}

    public static InfraMetricsPoint from(Long testRunId, InfraMetricsSnapshot s) {
        InfraMetricsPoint p = new InfraMetricsPoint();
        p.testRunId = testRunId;
        p.timestamp = s.timestamp();
        p.serverId = s.serverId();
        p.serverName = s.serverName();
        p.serverType = s.serverType();
        p.cpuPercent = s.cpuPercent();
        p.memoryUsedBytes = s.memoryUsedBytes();
        p.memoryTotalBytes = s.memoryTotalBytes();
        p.memoryPercent = s.memoryPercent();
        p.diskReadBytesPerSec = s.diskReadBytesPerSec();
        p.diskWriteBytesPerSec = s.diskWriteBytesPerSec();
        p.networkRecvBytesPerSec = s.networkRecvBytesPerSec();
        p.networkSentBytesPerSec = s.networkSentBytesPerSec();
        p.sqlBatchPerSec = s.sqlBatchPerSec();
        return p;
    }

    public InfraMetricsSnapshot toSnapshot() {
        return new InfraMetricsSnapshot(
            timestamp, serverId, serverName, serverType,
            cpuPercent, memoryUsedBytes, memoryTotalBytes, memoryPercent,
            diskReadBytesPerSec, diskWriteBytesPerSec,
            networkRecvBytesPerSec, networkSentBytesPerSec,
            sqlBatchPerSec, null
        );
    }

    public Long getId() { return id; }
    public Long getTestRunId() { return testRunId; }
    public Long getServerId() { return serverId; }
    public String getServerName() { return serverName; }
    public ServerType getServerType() { return serverType; }
    public Double getCpuPercent() { return cpuPercent; }
    public Long getMemoryUsedBytes() { return memoryUsedBytes; }
    public Long getMemoryTotalBytes() { return memoryTotalBytes; }
    public Double getMemoryPercent() { return memoryPercent; }
    public Double getDiskReadBytesPerSec() { return diskReadBytesPerSec; }
    public Double getDiskWriteBytesPerSec() { return diskWriteBytesPerSec; }
    public Double getNetworkRecvBytesPerSec() { return networkRecvBytesPerSec; }
    public Double getNetworkSentBytesPerSec() { return networkSentBytesPerSec; }
    public Double getSqlBatchPerSec() { return sqlBatchPerSec; }
}
