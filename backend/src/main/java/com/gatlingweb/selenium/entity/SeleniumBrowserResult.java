package com.gatlingweb.selenium.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "selenium_browser_results")
public class SeleniumBrowserResult {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long testRunId;
    private int browserIndex;
    private int iteration = 0;
    private String status;
    private Long startTime;
    private Long endTime;
    private Long durationMs;
    private String errorMessage;

    @Column(name = "steps_json")
    private String stepsJson;

    private String screenshotPath;

    public SeleniumBrowserResult() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getTestRunId() { return testRunId; }
    public void setTestRunId(Long testRunId) { this.testRunId = testRunId; }

    public int getBrowserIndex() { return browserIndex; }
    public void setBrowserIndex(int browserIndex) { this.browserIndex = browserIndex; }

    public int getIteration() { return iteration; }
    public void setIteration(int iteration) { this.iteration = iteration; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Long getStartTime() { return startTime; }
    public void setStartTime(Long startTime) { this.startTime = startTime; }

    public Long getEndTime() { return endTime; }
    public void setEndTime(Long endTime) { this.endTime = endTime; }

    public Long getDurationMs() { return durationMs; }
    public void setDurationMs(Long durationMs) { this.durationMs = durationMs; }

    public String getErrorMessage() { return errorMessage; }
    public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }

    public String getStepsJson() { return stepsJson; }
    public void setStepsJson(String stepsJson) { this.stepsJson = stepsJson; }

    public String getScreenshotPath() { return screenshotPath; }
    public void setScreenshotPath(String screenshotPath) { this.screenshotPath = screenshotPath; }
}
