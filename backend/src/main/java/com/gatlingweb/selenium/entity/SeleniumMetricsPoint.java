package com.gatlingweb.selenium.entity;

import com.gatlingweb.selenium.dto.SeleniumMetricsSnapshot;
import jakarta.persistence.*;

@Entity
@Table(name = "selenium_metrics_points")
public class SeleniumMetricsPoint {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long testRunId;
    private long timestamp;
    private double iterationsPerSecond;
    private double errorsPerSecond;
    private double meanStepDuration;
    private double p50;
    private double p75;
    private double p95;
    private double p99;
    private int activeBrowsers;
    private long totalIterations;
    private long totalErrors;
    private Double cpuPercent;
    private Double memoryPercent;

    public SeleniumMetricsPoint() {}

    public static SeleniumMetricsPoint from(Long testRunId, SeleniumMetricsSnapshot snapshot) {
        SeleniumMetricsPoint mp = new SeleniumMetricsPoint();
        mp.testRunId = testRunId;
        mp.timestamp = snapshot.timestamp();
        mp.iterationsPerSecond = snapshot.iterationsPerSecond();
        mp.errorsPerSecond = snapshot.errorsPerSecond();
        mp.meanStepDuration = snapshot.meanStepDuration();
        mp.p50 = snapshot.p50();
        mp.p75 = snapshot.p75();
        mp.p95 = snapshot.p95();
        mp.p99 = snapshot.p99();
        mp.activeBrowsers = snapshot.activeBrowsers();
        mp.totalIterations = snapshot.totalIterations();
        mp.totalErrors = snapshot.totalErrors();
        mp.cpuPercent = snapshot.cpuPercent();
        mp.memoryPercent = snapshot.memoryPercent();
        return mp;
    }

    public SeleniumMetricsSnapshot toSnapshot() {
        return new SeleniumMetricsSnapshot(
            timestamp, iterationsPerSecond, errorsPerSecond, meanStepDuration,
            p50, p75, p95, p99, activeBrowsers, totalIterations, totalErrors,
            cpuPercent, memoryPercent
        );
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getTestRunId() { return testRunId; }
    public void setTestRunId(Long testRunId) { this.testRunId = testRunId; }
}
