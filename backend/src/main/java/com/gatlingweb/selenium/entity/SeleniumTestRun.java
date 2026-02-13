package com.gatlingweb.selenium.entity;

import com.gatlingweb.entity.TestStatus;
import jakarta.persistence.*;

@Entity
@Table(name = "selenium_test_runs")
public class SeleniumTestRun {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String scriptClass;
    private String browser;
    private int instances;

    @Enumerated(EnumType.STRING)
    private TestStatus status;

    private Long startTime;
    private Long endTime;
    private int totalInstances;
    private int passedInstances;
    private int failedInstances;
    private String version;
    private String labels = "";
    private String gridUrl;
    private int loops = 1;
    private int rampUpSeconds = 0;
    private int totalIterations = 0;
    private int passedIterations = 0;
    private int failedIterations = 0;
    private Double meanStepDuration;

    public SeleniumTestRun() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getScriptClass() { return scriptClass; }
    public void setScriptClass(String scriptClass) { this.scriptClass = scriptClass; }

    public String getBrowser() { return browser; }
    public void setBrowser(String browser) { this.browser = browser; }

    public int getInstances() { return instances; }
    public void setInstances(int instances) { this.instances = instances; }

    public TestStatus getStatus() { return status; }
    public void setStatus(TestStatus status) { this.status = status; }

    public Long getStartTime() { return startTime; }
    public void setStartTime(Long startTime) { this.startTime = startTime; }

    public Long getEndTime() { return endTime; }
    public void setEndTime(Long endTime) { this.endTime = endTime; }

    public int getTotalInstances() { return totalInstances; }
    public void setTotalInstances(int totalInstances) { this.totalInstances = totalInstances; }

    public int getPassedInstances() { return passedInstances; }
    public void setPassedInstances(int passedInstances) { this.passedInstances = passedInstances; }

    public int getFailedInstances() { return failedInstances; }
    public void setFailedInstances(int failedInstances) { this.failedInstances = failedInstances; }

    public String getVersion() { return version; }
    public void setVersion(String version) { this.version = version; }

    public String getLabels() { return labels; }
    public void setLabels(String labels) { this.labels = labels; }

    public String getGridUrl() { return gridUrl; }
    public void setGridUrl(String gridUrl) { this.gridUrl = gridUrl; }

    public int getLoops() { return loops; }
    public void setLoops(int loops) { this.loops = loops; }

    public int getRampUpSeconds() { return rampUpSeconds; }
    public void setRampUpSeconds(int rampUpSeconds) { this.rampUpSeconds = rampUpSeconds; }

    public int getTotalIterations() { return totalIterations; }
    public void setTotalIterations(int totalIterations) { this.totalIterations = totalIterations; }

    public int getPassedIterations() { return passedIterations; }
    public void setPassedIterations(int passedIterations) { this.passedIterations = passedIterations; }

    public int getFailedIterations() { return failedIterations; }
    public void setFailedIterations(int failedIterations) { this.failedIterations = failedIterations; }

    public Double getMeanStepDuration() { return meanStepDuration; }
    public void setMeanStepDuration(Double meanStepDuration) { this.meanStepDuration = meanStepDuration; }
}
