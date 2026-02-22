package com.gatlingweb.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "test_runs")
public class TestRun {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String simulationClass;
    private String version;

    @Enumerated(EnumType.STRING)
    private TestStatus status;

    private LocalDateTime startTime;
    private LocalDateTime endTime;

    private String reportPath;

    private Long totalRequests;
    private Long totalErrors;
    private Double meanResponseTime;
    @Column(name = "p50_response_time")
    private Double p50ResponseTime;
    @Column(name = "p75_response_time")
    private Double p75ResponseTime;
    @Column(name = "p95_response_time")
    private Double p95ResponseTime;
    @Column(name = "p99_response_time")
    private Double p99ResponseTime;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "test_run_labels", joinColumns = @JoinColumn(name = "test_run_id"))
    @Column(name = "label")
    private Set<String> labels = new HashSet<>();

    @Enumerated(EnumType.STRING)
    private ThresholdVerdict thresholdVerdict;
    private Long thresholdProfileId;
    private String thresholdDetails;
    private String launchParams;
    private Integer bandwidthLimitMbps;
    private String notes;

    public TestRun() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getSimulationClass() { return simulationClass; }
    public void setSimulationClass(String simulationClass) { this.simulationClass = simulationClass; }

    public String getVersion() { return version; }
    public void setVersion(String version) { this.version = version; }

    public TestStatus getStatus() { return status; }
    public void setStatus(TestStatus status) { this.status = status; }

    public LocalDateTime getStartTime() { return startTime; }
    public void setStartTime(LocalDateTime startTime) { this.startTime = startTime; }

    public LocalDateTime getEndTime() { return endTime; }
    public void setEndTime(LocalDateTime endTime) { this.endTime = endTime; }

    public String getReportPath() { return reportPath; }
    public void setReportPath(String reportPath) { this.reportPath = reportPath; }

    public Long getTotalRequests() { return totalRequests; }
    public void setTotalRequests(Long totalRequests) { this.totalRequests = totalRequests; }

    public Long getTotalErrors() { return totalErrors; }
    public void setTotalErrors(Long totalErrors) { this.totalErrors = totalErrors; }

    public Double getMeanResponseTime() { return meanResponseTime; }
    public void setMeanResponseTime(Double meanResponseTime) { this.meanResponseTime = meanResponseTime; }

    public Double getP50ResponseTime() { return p50ResponseTime; }
    public void setP50ResponseTime(Double p50ResponseTime) { this.p50ResponseTime = p50ResponseTime; }

    public Double getP75ResponseTime() { return p75ResponseTime; }
    public void setP75ResponseTime(Double p75ResponseTime) { this.p75ResponseTime = p75ResponseTime; }

    public Double getP95ResponseTime() { return p95ResponseTime; }
    public void setP95ResponseTime(Double p95ResponseTime) { this.p95ResponseTime = p95ResponseTime; }

    public Double getP99ResponseTime() { return p99ResponseTime; }
    public void setP99ResponseTime(Double p99ResponseTime) { this.p99ResponseTime = p99ResponseTime; }

    public Set<String> getLabels() { return labels; }
    public void setLabels(Set<String> labels) { this.labels = labels; }

    public ThresholdVerdict getThresholdVerdict() { return thresholdVerdict; }
    public void setThresholdVerdict(ThresholdVerdict thresholdVerdict) { this.thresholdVerdict = thresholdVerdict; }

    public Long getThresholdProfileId() { return thresholdProfileId; }
    public void setThresholdProfileId(Long thresholdProfileId) { this.thresholdProfileId = thresholdProfileId; }

    public String getThresholdDetails() { return thresholdDetails; }
    public void setThresholdDetails(String thresholdDetails) { this.thresholdDetails = thresholdDetails; }

    public String getLaunchParams() { return launchParams; }
    public void setLaunchParams(String launchParams) { this.launchParams = launchParams; }

    public Integer getBandwidthLimitMbps() { return bandwidthLimitMbps; }
    public void setBandwidthLimitMbps(Integer bandwidthLimitMbps) { this.bandwidthLimitMbps = bandwidthLimitMbps; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
}
