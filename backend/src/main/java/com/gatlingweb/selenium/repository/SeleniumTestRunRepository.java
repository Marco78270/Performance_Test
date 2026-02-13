package com.gatlingweb.selenium.repository;

import com.gatlingweb.entity.TestStatus;
import com.gatlingweb.selenium.entity.SeleniumTestRun;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface SeleniumTestRunRepository extends JpaRepository<SeleniumTestRun, Long> {
    Page<SeleniumTestRun> findAll(Pageable pageable);
    Page<SeleniumTestRun> findByBrowser(String browser, Pageable pageable);
    Page<SeleniumTestRun> findByStatus(TestStatus status, Pageable pageable);
    Page<SeleniumTestRun> findByBrowserAndStatus(String browser, TestStatus status, Pageable pageable);
    Optional<SeleniumTestRun> findFirstByStatus(TestStatus status);
    List<SeleniumTestRun> findAllByStatus(TestStatus status);

    @Query("SELECT t.labels FROM SeleniumTestRun t WHERE t.labels IS NOT NULL AND t.labels <> ''")
    List<String> findAllLabelsRaw();

    Page<SeleniumTestRun> findByLabelsContaining(String label, Pageable pageable);
    Page<SeleniumTestRun> findByBrowserAndLabelsContaining(String browser, String label, Pageable pageable);
    Page<SeleniumTestRun> findByStatusAndLabelsContaining(TestStatus status, String label, Pageable pageable);
    Page<SeleniumTestRun> findByBrowserAndStatusAndLabelsContaining(String browser, TestStatus status, String label, Pageable pageable);
}
