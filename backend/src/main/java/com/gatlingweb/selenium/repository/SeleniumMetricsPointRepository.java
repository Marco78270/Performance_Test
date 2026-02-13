package com.gatlingweb.selenium.repository;

import com.gatlingweb.selenium.entity.SeleniumMetricsPoint;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SeleniumMetricsPointRepository extends JpaRepository<SeleniumMetricsPoint, Long> {
    List<SeleniumMetricsPoint> findByTestRunIdOrderByTimestampAsc(Long testRunId);
    void deleteByTestRunId(Long testRunId);
}
