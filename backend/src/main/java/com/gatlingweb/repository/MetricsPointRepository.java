package com.gatlingweb.repository;

import com.gatlingweb.entity.MetricsPoint;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MetricsPointRepository extends JpaRepository<MetricsPoint, Long> {
    List<MetricsPoint> findByTestRunIdOrderByTimestampAsc(Long testRunId);
}
