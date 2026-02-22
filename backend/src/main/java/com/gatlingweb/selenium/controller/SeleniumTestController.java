package com.gatlingweb.selenium.controller;

import com.gatlingweb.dto.InfraMetricsSnapshot;
import com.gatlingweb.entity.TestStatus;
import com.gatlingweb.selenium.dto.SeleniumLaunchRequest;
import com.gatlingweb.selenium.dto.SeleniumMetricsSnapshot;
import com.gatlingweb.selenium.dto.SeleniumTrendDataDto;
import com.gatlingweb.selenium.entity.SeleniumBrowserResult;
import com.gatlingweb.selenium.entity.SeleniumTestRun;
import com.gatlingweb.selenium.repository.SeleniumBrowserResultRepository;
import com.gatlingweb.selenium.repository.SeleniumTestRunRepository;
import com.gatlingweb.selenium.service.*;
import com.gatlingweb.service.MetricsPersistenceService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/selenium")
public class SeleniumTestController {

    private final SeleniumExecutionService executionService;
    private final SeleniumCompilerService compilerService;
    private final SeleniumMetricsCollector metricsCollector;
    private final SeleniumTestRunRepository testRunRepository;
    private final SeleniumBrowserResultRepository resultRepository;
    private final MetricsPersistenceService metricsPersistenceService;
    private final SeleniumPdfExportService pdfExportService;

    public SeleniumTestController(
            SeleniumExecutionService executionService,
            SeleniumCompilerService compilerService,
            SeleniumMetricsCollector metricsCollector,
            SeleniumTestRunRepository testRunRepository,
            SeleniumBrowserResultRepository resultRepository,
            MetricsPersistenceService metricsPersistenceService,
            SeleniumPdfExportService pdfExportService) {
        this.executionService = executionService;
        this.compilerService = compilerService;
        this.metricsCollector = metricsCollector;
        this.testRunRepository = testRunRepository;
        this.resultRepository = resultRepository;
        this.metricsPersistenceService = metricsPersistenceService;
        this.pdfExportService = pdfExportService;
    }

    @PostMapping("/compile")
    public ResponseEntity<?> compile() {
        SeleniumCompilerService.CompileResult result = compilerService.compile();
        return ResponseEntity.ok(Map.of("success", result.success(), "output", result.output()));
    }

    @PostMapping("/launch")
    public ResponseEntity<?> launch(@Valid @RequestBody SeleniumLaunchRequest request) {
        if (executionService.isRunning()) {
            return ResponseEntity.badRequest().body(Map.of("error", "A Selenium test is already running"));
        }
        SeleniumTestRun run = executionService.launch(request);
        executionService.executeAsync(run.getId(), request.headless());
        return ResponseEntity.ok(run);
    }

    @GetMapping("/tests")
    public Page<SeleniumTestRun> listTests(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "id") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir,
            @RequestParam(required = false) String browser,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String label) {
        Sort sort = Sort.by(sortDir.equalsIgnoreCase("asc") ? Sort.Direction.ASC : Sort.Direction.DESC, sortBy);
        PageRequest pageRequest = PageRequest.of(page, size, sort);
        boolean hasBrowser = browser != null && !browser.isEmpty();
        boolean hasStatus = status != null && !status.isEmpty();
        boolean hasLabel = label != null && !label.isEmpty();
        if (hasBrowser && hasStatus && hasLabel) {
            return testRunRepository.findByBrowserAndStatusAndLabel(browser, TestStatus.valueOf(status), label, pageRequest);
        } else if (hasBrowser && hasStatus) {
            return testRunRepository.findByBrowserAndStatus(browser, TestStatus.valueOf(status), pageRequest);
        } else if (hasBrowser && hasLabel) {
            return testRunRepository.findByBrowserAndLabel(browser, label, pageRequest);
        } else if (hasStatus && hasLabel) {
            return testRunRepository.findByStatusAndLabel(TestStatus.valueOf(status), label, pageRequest);
        } else if (hasBrowser) {
            return testRunRepository.findByBrowser(browser, pageRequest);
        } else if (hasStatus) {
            return testRunRepository.findByStatus(TestStatus.valueOf(status), pageRequest);
        } else if (hasLabel) {
            return testRunRepository.findByLabel(label, pageRequest);
        }
        return testRunRepository.findAll(pageRequest);
    }

    @GetMapping("/tests/{id}")
    public ResponseEntity<SeleniumTestRun> getTest(@PathVariable Long id) {
        return testRunRepository.findById(id)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/tests/{id}/results")
    public List<SeleniumBrowserResult> getResults(@PathVariable Long id) {
        return resultRepository.findByTestRunIdOrderByBrowserIndexAscIterationAsc(id);
    }

    @GetMapping("/tests/{id}/metrics")
    public List<SeleniumMetricsSnapshot> getMetrics(@PathVariable Long id) {
        return metricsCollector.getMetrics(id);
    }

    @GetMapping("/tests/{id}/infra-metrics")
    public List<InfraMetricsSnapshot> getInfraMetrics(@PathVariable Long id) {
        return metricsPersistenceService.getInfraMetrics(id);
    }

    @GetMapping("/tests/{id}/export/pdf")
    public ResponseEntity<byte[]> exportPdf(@PathVariable Long id) {
        byte[] pdf = pdfExportService.generatePdf(id);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=selenium-report-" + id + ".pdf")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }

    @DeleteMapping("/tests/{id}")
    @Transactional
    public ResponseEntity<?> deleteTest(@PathVariable Long id) {
        metricsCollector.deleteMetrics(id);
        resultRepository.deleteByTestRunId(id);
        testRunRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("status", "deleted"));
    }

    @PostMapping("/tests/{id}/cancel")
    public ResponseEntity<?> cancelTest(@PathVariable Long id) {
        executionService.cancel(id);
        return ResponseEntity.ok(Map.of("status", "cancelled"));
    }

    @PutMapping("/tests/{id}/notes")
    @Transactional
    public ResponseEntity<?> updateNotes(@PathVariable Long id, @RequestBody Map<String, String> body) {
        testRunRepository.findById(id).ifPresent(run -> {
            run.setNotes(body.get("notes"));
            testRunRepository.save(run);
        });
        return ResponseEntity.ok(Map.of("status", "updated"));
    }

    @PutMapping("/tests/{id}/version")
    @Transactional
    public ResponseEntity<?> updateVersion(@PathVariable Long id, @RequestBody Map<String, String> body) {
        testRunRepository.findById(id).ifPresent(run -> {
            run.setVersion(body.get("version"));
            testRunRepository.save(run);
        });
        return ResponseEntity.ok(Map.of("status", "updated"));
    }

    @PutMapping("/tests/{id}/labels")
    @Transactional
    public ResponseEntity<?> updateLabels(@PathVariable Long id, @RequestBody Map<String, List<String>> body) {
        testRunRepository.findById(id).ifPresent(run -> {
            List<String> labels = body.getOrDefault("labels", List.of());
            Set<String> labelSet = new LinkedHashSet<>();
            for (String l : labels) {
                String t = l.trim();
                if (!t.isEmpty()) labelSet.add(t);
            }
            run.setLabels(labelSet);
            testRunRepository.save(run);
        });
        return ResponseEntity.ok(Map.of("status", "updated"));
    }

    @GetMapping("/labels")
    public List<String> getAllLabels() {
        return testRunRepository.findAllDistinctLabels();
    }

    @GetMapping("/trends")
    public SeleniumTrendDataDto getTrends(
            @RequestParam String scriptClass,
            @RequestParam(defaultValue = "20") int limit) {
        List<SeleniumTestRun> runs = testRunRepository
                .findByScriptClassAndStatusOrderByStartTimeDesc(scriptClass, TestStatus.COMPLETED, PageRequest.of(0, limit));
        List<SeleniumTestRun> chronological = new ArrayList<>(runs);
        Collections.reverse(chronological);

        var points = chronological.stream().map(run -> {
            int total = run.getTotalIterations();
            int passed = run.getPassedIterations();
            double passRate = total > 0 ? (double) passed / total * 100.0 : 0.0;
            return new com.gatlingweb.selenium.dto.SeleniumTrendPointDto(
                run.getId(),
                run.getStartTime() != null ? new java.util.Date(run.getStartTime()).toString() : null,
                run.getVersion(),
                run.getMeanStepDuration(),
                passRate,
                total
            );
        }).toList();

        return new SeleniumTrendDataDto(scriptClass, points);
    }
}
