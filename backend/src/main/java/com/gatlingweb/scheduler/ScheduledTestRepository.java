package com.gatlingweb.scheduler;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ScheduledTestRepository extends JpaRepository<ScheduledTest, Long> {

    List<ScheduledTest> findAllByOrderByScheduledAtAsc();

    @Query("SELECT s FROM ScheduledTest s WHERE s.status = 'PENDING' AND s.scheduledAt <= :now ORDER BY s.scheduledAt ASC")
    List<ScheduledTest> findDuePending(@Param("now") Long now);
}
