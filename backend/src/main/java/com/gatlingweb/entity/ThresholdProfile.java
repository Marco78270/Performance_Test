package com.gatlingweb.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "threshold_profiles")
public class ThresholdProfile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;
    private String simulationClass;
    private String rules;
    private Long createdAt;
    private Long updatedAt;

    public ThresholdProfile() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getSimulationClass() { return simulationClass; }
    public void setSimulationClass(String simulationClass) { this.simulationClass = simulationClass; }

    public String getRules() { return rules; }
    public void setRules(String rules) { this.rules = rules; }

    public Long getCreatedAt() { return createdAt; }
    public void setCreatedAt(Long createdAt) { this.createdAt = createdAt; }

    public Long getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Long updatedAt) { this.updatedAt = updatedAt; }
}
