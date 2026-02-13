package com.gatlingweb.selenium.repository;

import com.gatlingweb.selenium.entity.SeleniumBrowserResult;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SeleniumBrowserResultRepository extends JpaRepository<SeleniumBrowserResult, Long> {
    List<SeleniumBrowserResult> findByTestRunIdOrderByBrowserIndex(Long testRunId);
    List<SeleniumBrowserResult> findByTestRunIdOrderByBrowserIndexAscIterationAsc(Long testRunId);
    void deleteByTestRunId(Long testRunId);
}
