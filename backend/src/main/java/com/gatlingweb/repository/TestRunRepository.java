package com.gatlingweb.repository;

import com.gatlingweb.entity.TestRun;
import com.gatlingweb.entity.TestStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface TestRunRepository extends JpaRepository<TestRun, Long> {
    Optional<TestRun> findByStatus(TestStatus status);
    List<TestRun> findAllByOrderByStartTimeDesc();
    Page<TestRun> findAll(Pageable pageable);
    List<TestRun> findBySimulationClassOrderByStartTimeDesc(String simulationClass);
    List<TestRun> findByStatusOrderByStartTimeAsc(TestStatus status);
    List<TestRun> findAllByStatus(TestStatus status);
    long countByStatus(TestStatus status);

    @Query("SELECT DISTINCT t.simulationClass FROM TestRun t WHERE t.status IN ('COMPLETED', 'FAILED')")
    List<String> findDistinctSimulationClassCompleted();

    List<TestRun> findBySimulationClassAndStatusOrderByStartTimeDesc(String simulationClass, TestStatus status, Pageable pageable);

    @Query("SELECT DISTINCT l FROM TestRun t JOIN t.labels l ORDER BY l")
    List<String> findAllDistinctLabels();

    @Query("SELECT DISTINCT t FROM TestRun t JOIN t.labels l WHERE l = :label")
    Page<TestRun> findByLabel(@Param("label") String label, Pageable pageable);

    long countByStatusAndStartTimeAfter(TestStatus status, java.time.LocalDateTime after);

    @Query("SELECT AVG(t.meanResponseTime) FROM TestRun t WHERE t.status = 'COMPLETED' AND t.startTime > :after AND t.meanResponseTime IS NOT NULL")
    Double avgMeanResponseTimeAfter(@Param("after") java.time.LocalDateTime after);
}
