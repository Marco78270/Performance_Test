package com.gatlingweb.selenium.repository;

import com.gatlingweb.entity.TestStatus;
import com.gatlingweb.selenium.entity.SeleniumTestRun;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface SeleniumTestRunRepository extends JpaRepository<SeleniumTestRun, Long> {
    Page<SeleniumTestRun> findAll(Pageable pageable);
    Page<SeleniumTestRun> findByBrowser(String browser, Pageable pageable);
    Page<SeleniumTestRun> findByStatus(TestStatus status, Pageable pageable);
    Page<SeleniumTestRun> findByBrowserAndStatus(String browser, TestStatus status, Pageable pageable);
    Optional<SeleniumTestRun> findFirstByStatus(TestStatus status);
    List<SeleniumTestRun> findAllByStatus(TestStatus status);

    @Query("SELECT DISTINCT l FROM SeleniumTestRun t JOIN t.labels l ORDER BY l")
    List<String> findAllDistinctLabels();

    @Query("SELECT DISTINCT t FROM SeleniumTestRun t JOIN t.labels l WHERE l = :label")
    Page<SeleniumTestRun> findByLabel(@Param("label") String label, Pageable pageable);

    @Query("SELECT DISTINCT t FROM SeleniumTestRun t JOIN t.labels l WHERE t.browser = :browser AND l = :label")
    Page<SeleniumTestRun> findByBrowserAndLabel(@Param("browser") String browser, @Param("label") String label, Pageable pageable);

    @Query("SELECT DISTINCT t FROM SeleniumTestRun t JOIN t.labels l WHERE t.status = :status AND l = :label")
    Page<SeleniumTestRun> findByStatusAndLabel(@Param("status") TestStatus status, @Param("label") String label, Pageable pageable);

    @Query("SELECT DISTINCT t FROM SeleniumTestRun t JOIN t.labels l WHERE t.browser = :browser AND t.status = :status AND l = :label")
    Page<SeleniumTestRun> findByBrowserAndStatusAndLabel(@Param("browser") String browser, @Param("status") TestStatus status, @Param("label") String label, Pageable pageable);

    @Query("SELECT t FROM SeleniumTestRun t WHERE t.scriptClass = :scriptClass AND t.status = :status ORDER BY t.startTime DESC")
    List<SeleniumTestRun> findByScriptClassAndStatusOrderByStartTimeDesc(@Param("scriptClass") String scriptClass, @Param("status") TestStatus status, Pageable pageable);
}
