package com.gatlingweb.scheduler;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.gatlingweb.dto.LaunchRequest;
import com.gatlingweb.selenium.dto.SeleniumLaunchRequest;
import com.gatlingweb.selenium.service.SeleniumExecutionService;
import com.gatlingweb.service.TestRunService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class SchedulerService {

    private static final Logger log = LoggerFactory.getLogger(SchedulerService.class);

    private final ScheduledTestRepository repository;
    private final TestRunService testRunService;
    private final SeleniumExecutionService seleniumExecutionService;
    private final ObjectMapper objectMapper;

    public SchedulerService(
            ScheduledTestRepository repository,
            TestRunService testRunService,
            SeleniumExecutionService seleniumExecutionService,
            ObjectMapper objectMapper) {
        this.repository = repository;
        this.testRunService = testRunService;
        this.seleniumExecutionService = seleniumExecutionService;
        this.objectMapper = objectMapper;
    }

    @Scheduled(fixedDelay = 60_000)
    @Transactional
    public void checkAndLaunch() {
        long now = System.currentTimeMillis();
        List<ScheduledTest> due = repository.findDuePending(now);
        for (ScheduledTest job : due) {
            try {
                if ("gatling".equalsIgnoreCase(job.getTestType())) {
                    LaunchRequest request = objectMapper.readValue(job.getLaunchParamsJson(), LaunchRequest.class);
                    testRunService.launch(request);
                } else if ("selenium".equalsIgnoreCase(job.getTestType())) {
                    SeleniumLaunchRequest request = objectMapper.readValue(job.getLaunchParamsJson(), SeleniumLaunchRequest.class);
                    var run = seleniumExecutionService.launch(request);
                    seleniumExecutionService.executeAsync(run.getId(), request.headless());
                }
                job.setStatus("LAUNCHED");
                job.setLaunchedAt(System.currentTimeMillis());
                log.info("Scheduled job #{} ({}) launched successfully", job.getId(), job.getScriptClass());
            } catch (Exception e) {
                job.setStatus("FAILED");
                log.error("Scheduled job #{} failed to launch: {}", job.getId(), e.getMessage(), e);
            }
            repository.save(job);
        }
    }

    public List<ScheduledTest> findAll() {
        return repository.findAllByOrderByScheduledAtAsc();
    }

    public ScheduledTest create(ScheduledTest job) {
        job.setCreatedAt(System.currentTimeMillis());
        job.setStatus("PENDING");
        return repository.save(job);
    }

    public boolean cancel(Long id) {
        return repository.findById(id).map(job -> {
            if ("PENDING".equals(job.getStatus())) {
                job.setStatus("CANCELLED");
                repository.save(job);
                return true;
            }
            return false;
        }).orElse(false);
    }
}
