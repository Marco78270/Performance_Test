package com.gatlingweb.repository;

import com.gatlingweb.entity.ThresholdProfile;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ThresholdProfileRepository extends JpaRepository<ThresholdProfile, Long> {
    Optional<ThresholdProfile> findBySimulationClass(String simulationClass);
    List<ThresholdProfile> findAllByOrderByNameAsc();
}
