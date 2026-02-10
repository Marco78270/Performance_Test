package com.gatlingweb.entity;

import com.gatlingweb.dto.MetricsSnapshot;
import jakarta.persistence.*;

@Entity
@Table(name = "metrics_points")
public class MetricsPoint {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long testRunId;
    private long timestamp;
    private double requestsPerSecond;
    private double errorsPerSecond;
    private double meanResponseTime;
    private double p50;
    private double p75;
    private double p95;
    private double p99;
    private int activeUsers;
    private long totalRequests;
    private long totalErrors;

    public MetricsPoint() {}

    public static MetricsPoint from(Long testRunId, MetricsSnapshot snapshot) {
        MetricsPoint mp = new MetricsPoint();
        mp.testRunId = testRunId;
        mp.timestamp = snapshot.timestamp();
        mp.requestsPerSecond = snapshot.requestsPerSecond();
        mp.errorsPerSecond = snapshot.errorsPerSecond();
        mp.meanResponseTime = snapshot.meanResponseTime();
        mp.p50 = snapshot.p50();
        mp.p75 = snapshot.p75();
        mp.p95 = snapshot.p95();
        mp.p99 = snapshot.p99();
        mp.activeUsers = snapshot.activeUsers();
        mp.totalRequests = snapshot.totalRequests();
        mp.totalErrors = snapshot.totalErrors();
        return mp;
    }

    public MetricsSnapshot toSnapshot() {
        return new MetricsSnapshot(
            timestamp, requestsPerSecond, errorsPerSecond, meanResponseTime,
            p50, p75, p95, p99, activeUsers, totalRequests, totalErrors
        );
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getTestRunId() { return testRunId; }
    public void setTestRunId(Long testRunId) { this.testRunId = testRunId; }
}
