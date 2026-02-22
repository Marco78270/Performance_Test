package com.gatlingweb.scheduler;

import jakarta.persistence.*;

@Entity
@Table(name = "scheduled_tests")
public class ScheduledTest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String testType;
    private String scriptClass;
    private String launchParamsJson;
    private Long scheduledAt;
    private String status = "PENDING";
    private Long launchedAt;
    private Long createdAt;
    private String notes;

    public ScheduledTest() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getTestType() { return testType; }
    public void setTestType(String testType) { this.testType = testType; }

    public String getScriptClass() { return scriptClass; }
    public void setScriptClass(String scriptClass) { this.scriptClass = scriptClass; }

    public String getLaunchParamsJson() { return launchParamsJson; }
    public void setLaunchParamsJson(String launchParamsJson) { this.launchParamsJson = launchParamsJson; }

    public Long getScheduledAt() { return scheduledAt; }
    public void setScheduledAt(Long scheduledAt) { this.scheduledAt = scheduledAt; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Long getLaunchedAt() { return launchedAt; }
    public void setLaunchedAt(Long launchedAt) { this.launchedAt = launchedAt; }

    public Long getCreatedAt() { return createdAt; }
    public void setCreatedAt(Long createdAt) { this.createdAt = createdAt; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
}
