package com.gatlingweb.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "monitored_servers")
public class MonitoredServer {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;
    private String url;

    @Enumerated(EnumType.STRING)
    private ServerType serverType;

    private Boolean enabled = true;
    private LocalDateTime lastSeenAt;
    private String lastError;

    public MonitoredServer() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getUrl() { return url; }
    public void setUrl(String url) { this.url = url; }

    public ServerType getServerType() { return serverType; }
    public void setServerType(ServerType serverType) { this.serverType = serverType; }

    public Boolean getEnabled() { return enabled; }
    public void setEnabled(Boolean enabled) { this.enabled = enabled; }

    public LocalDateTime getLastSeenAt() { return lastSeenAt; }
    public void setLastSeenAt(LocalDateTime lastSeenAt) { this.lastSeenAt = lastSeenAt; }

    public String getLastError() { return lastError; }
    public void setLastError(String lastError) { this.lastError = lastError; }
}
