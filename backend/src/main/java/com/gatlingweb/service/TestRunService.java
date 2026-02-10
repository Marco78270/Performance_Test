package com.gatlingweb.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.gatlingweb.dto.ComparisonDto;
import com.gatlingweb.dto.LaunchRequest;
import com.gatlingweb.dto.TestRunDto;
import com.gatlingweb.dto.TrendDataDto;
import com.gatlingweb.dto.TrendPointDto;
import com.gatlingweb.entity.TestRun;
import com.gatlingweb.entity.TestStatus;
import com.gatlingweb.repository.TestRunRepository;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;

@Service
public class TestRunService {

    private static final Logger log = LoggerFactory.getLogger(TestRunService.class);
    private static final int MAX_QUEUE_SIZE = 20;

    private final TestRunRepository repository;
    private final GatlingExecutionService executionService;
    private final ObjectMapper objectMapper;
    private final SimpMessagingTemplate messaging;

    public TestRunService(TestRunRepository repository, GatlingExecutionService executionService,
                          ObjectMapper objectMapper, SimpMessagingTemplate messaging) {
        this.repository = repository;
        this.executionService = executionService;
        this.objectMapper = objectMapper;
        this.messaging = messaging;
    }

    @PostConstruct
    void init() {
        executionService.setOnTestComplete(this::processNextQueued);
        recoverOrphanedTests();
    }

    private void recoverOrphanedTests() {
        List<TestRun> orphanedRunning = repository.findAllByStatus(TestStatus.RUNNING);
        for (TestRun run : orphanedRunning) {
            log.warn("Found orphaned RUNNING test #{} from previous session, marking as FAILED", run.getId());
            run.setStatus(TestStatus.FAILED);
            run.setEndTime(LocalDateTime.now());
            repository.save(run);
        }
        if (!orphanedRunning.isEmpty()) {
            log.info("Marked {} orphaned RUNNING tests as FAILED", orphanedRunning.size());
        }

        List<TestRun> queued = repository.findByStatusOrderByStartTimeAsc(TestStatus.QUEUED);
        if (!queued.isEmpty()) {
            log.info("Found {} queued tests from previous session, processing...", queued.size());
            processNextQueued();
        }
    }

    public TestRunDto launch(LaunchRequest request) {
        try {
            TestRun run = executionService.launch(request.simulationClass(), request.version());
            if (request.bandwidthLimitMbps() != null) {
                run.setBandwidthLimitMbps(request.bandwidthLimitMbps());
                repository.save(run);
            }
            executionService.executeAsync(run.getId(), request);
            return TestRunDto.from(run);
        } catch (IllegalStateException e) {
            // Lock not available: another test is running, queue this one
            if (repository.countByStatus(TestStatus.QUEUED) >= MAX_QUEUE_SIZE) {
                throw new IllegalStateException("Test queue is full (max " + MAX_QUEUE_SIZE + " tests). "
                        + "Please wait for running tests to complete or cancel queued tests.");
            }
            TestRun run = new TestRun();
            run.setSimulationClass(request.simulationClass());
            run.setVersion(request.version());
            run.setStatus(TestStatus.QUEUED);
            run.setStartTime(LocalDateTime.now());
            try {
                run.setLaunchParams(objectMapper.writeValueAsString(request));
            } catch (JsonProcessingException ex) {
                throw new RuntimeException("Failed to serialize launch params", ex);
            }
            run = repository.save(run);
            broadcastQueue();
            return TestRunDto.from(run);
        }
    }

    void processNextQueued() {
        while (true) {
            List<TestRun> queued = repository.findByStatusOrderByStartTimeAsc(TestStatus.QUEUED);
            if (queued.isEmpty()) return;

            TestRun next = queued.get(0);
            log.info("Processing next queued test #{} ({})", next.getId(), next.getSimulationClass());

            LaunchRequest request;
            try {
                request = objectMapper.readValue(next.getLaunchParams(), LaunchRequest.class);
            } catch (JsonProcessingException e) {
                log.error("Failed to deserialize launch params for test #{}", next.getId(), e);
                next.setStatus(TestStatus.FAILED);
                next.setEndTime(LocalDateTime.now());
                repository.save(next);
                broadcastQueue();
                continue;
            }

            executionService.launchExisting(next);
            messaging.convertAndSend("/topic/test-status/" + next.getId(), "RUNNING");
            broadcastQueue();
            executionService.executeAsync(next.getId(), request);
            return;
        }
    }

    public List<TestRunDto> getQueue() {
        return repository.findByStatusOrderByStartTimeAsc(TestStatus.QUEUED)
                .stream().map(TestRunDto::from).toList();
    }

    public void cancelQueued(Long id) {
        repository.findById(id).ifPresent(run -> {
            if (run.getStatus() == TestStatus.QUEUED) {
                run.setStatus(TestStatus.CANCELLED);
                run.setEndTime(LocalDateTime.now());
                repository.save(run);
                broadcastQueue();
            }
        });
    }

    public List<String> getCompletedSimulationClasses() {
        return repository.findDistinctSimulationClassCompleted();
    }

    public TrendDataDto getTrends(String simulationClass, int limit) {
        List<TestRun> runs = repository.findBySimulationClassAndStatusOrderByStartTimeDesc(
                simulationClass, TestStatus.COMPLETED, PageRequest.of(0, limit));
        // Reverse to have chronological order
        List<TestRun> chronological = new ArrayList<>(runs);
        Collections.reverse(chronological);

        List<TrendPointDto> points = chronological.stream().map(run -> {
            double errRate = errorRate(run);
            return new TrendPointDto(
                run.getId(),
                run.getStartTime() != null ? run.getStartTime().toString() : null,
                run.getVersion(),
                run.getTotalRequests(),
                run.getTotalErrors(),
                run.getMeanResponseTime(),
                run.getP95ResponseTime(),
                errRate,
                run.getThresholdVerdict() != null ? run.getThresholdVerdict().name() : null
            );
        }).toList();

        long passCount = chronological.stream()
            .filter(r -> r.getThresholdVerdict() != null && r.getThresholdVerdict().name().equals("PASSED"))
            .count();
        long withVerdict = chronological.stream()
            .filter(r -> r.getThresholdVerdict() != null)
            .count();
        double passRate = withVerdict > 0 ? (double) passCount / withVerdict * 100 : 0;

        return new TrendDataDto(simulationClass, points, passRate);
    }

    private void broadcastQueue() {
        List<TestRunDto> queue = getQueue();
        messaging.convertAndSend("/topic/queue", queue);
    }

    public void cancel(Long id) {
        executionService.cancel(id);
    }

    public Page<TestRunDto> findAll(Pageable pageable) {
        return repository.findAll(pageable).map(TestRunDto::from);
    }

    public Page<TestRunDto> findByLabel(String label, Pageable pageable) {
        return repository.findByLabelsContaining(label, pageable).map(TestRunDto::from);
    }

    public Optional<TestRunDto> findById(Long id) {
        return repository.findById(id).map(TestRunDto::from);
    }

    public Optional<TestRunDto> findRunning() {
        return repository.findByStatus(TestStatus.RUNNING).map(TestRunDto::from);
    }

    public void delete(Long id) {
        repository.deleteById(id);
    }

    public void updateVersion(Long id, String version) {
        repository.findById(id).ifPresent(run -> {
            run.setVersion(version);
            repository.save(run);
        });
    }

    public void updateLabels(Long id, List<String> labels) {
        repository.findById(id).ifPresent(run -> {
            String joined = labels.stream()
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .reduce((a, b) -> a + "," + b)
                .orElse("");
            run.setLabels(joined);
            repository.save(run);
        });
    }

    public ComparisonDto compare(Long idA, Long idB) {
        TestRun runA = repository.findById(idA)
            .orElseThrow(() -> new IllegalArgumentException("Test run not found: " + idA));
        TestRun runB = repository.findById(idB)
            .orElseThrow(() -> new IllegalArgumentException("Test run not found: " + idB));

        Map<String, Double> diff = new LinkedHashMap<>();
        diff.put("meanResponseTime", calcDiff(runA.getMeanResponseTime(), runB.getMeanResponseTime()));
        diff.put("p50ResponseTime", calcDiff(runA.getP50ResponseTime(), runB.getP50ResponseTime()));
        diff.put("p75ResponseTime", calcDiff(runA.getP75ResponseTime(), runB.getP75ResponseTime()));
        diff.put("p95ResponseTime", calcDiff(runA.getP95ResponseTime(), runB.getP95ResponseTime()));
        diff.put("p99ResponseTime", calcDiff(runA.getP99ResponseTime(), runB.getP99ResponseTime()));
        diff.put("totalRequests", calcDiff(
            runA.getTotalRequests() != null ? runA.getTotalRequests().doubleValue() : null,
            runB.getTotalRequests() != null ? runB.getTotalRequests().doubleValue() : null));
        diff.put("errorRate", calcDiff(errorRate(runA), errorRate(runB)));

        return new ComparisonDto(TestRunDto.from(runA), TestRunDto.from(runB), diff);
    }

    Double calcDiff(Double a, Double b) {
        if (a == null || b == null || a == 0) return null;
        return ((b - a) / a) * 100;
    }

    Double errorRate(TestRun run) {
        long total = run.getTotalRequests() != null ? run.getTotalRequests() : 0;
        long errors = run.getTotalErrors() != null ? run.getTotalErrors() : 0;
        return total > 0 ? (double) errors / total * 100 : 0.0;
    }
}
