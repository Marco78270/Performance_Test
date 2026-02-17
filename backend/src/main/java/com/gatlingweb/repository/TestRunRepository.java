package com.gatlingweb.repository;

import com.gatlingweb.entity.TestRun;
import com.gatlingweb.entity.TestStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface TestRunRepository extends JpaRepository<TestRun, Long> {
    Optional<TestRun> findByStatus(TestStatus status);
    List<TestRun> findAllByOrderByStartTimeDesc();
    Page<TestRun> findAll(Pageable pageable);
    List<TestRun> findBySimulationClassOrderByStartTimeDesc(String simulationClass);
    Page<TestRun> findByLabelsContaining(String label, Pageable pageable);
    List<TestRun> findByStatusOrderByStartTimeAsc(TestStatus status);
    List<TestRun> findAllByStatus(TestStatus status);
    long countByStatus(TestStatus status);

    @Query("SELECT DISTINCT t.simulationClass FROM TestRun t WHERE t.status IN ('COMPLETED', 'FAILED')")
    List<String> findDistinctSimulationClassCompleted();

    List<TestRun> findBySimulationClassAndStatusOrderByStartTimeDesc(String simulationClass, TestStatus status, Pageable pageable);

    @Query("SELECT t.labels FROM TestRun t WHERE t.labels IS NOT NULL AND t.labels <> ''")
    List<String> findAllLabelsRaw();

    long countByStatusAndStartTimeAfter(TestStatus status, java.time.LocalDateTime after);

    @Query("SELECT AVG(t.meanResponseTime) FROM TestRun t WHERE t.status = 'COMPLETED' AND t.startTime > :after AND t.meanResponseTime IS NOT NULL")
    Double avgMeanResponseTimeAfter(@org.springframework.data.repository.query.Param("after") java.time.LocalDateTime after);

}
