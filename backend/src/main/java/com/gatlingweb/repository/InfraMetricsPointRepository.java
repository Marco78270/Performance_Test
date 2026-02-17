package com.gatlingweb.repository;

import com.gatlingweb.entity.InfraMetricsPoint;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface InfraMetricsPointRepository extends JpaRepository<InfraMetricsPoint, Long> {
    List<InfraMetricsPoint> findByTestRunIdOrderByTimestampAsc(Long testRunId);
    void deleteByTestRunId(Long testRunId);
}
