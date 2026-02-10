package com.gatlingweb.controller;

import com.gatlingweb.dto.ComparisonDto;
import com.gatlingweb.dto.InfraMetricsSnapshot;
import com.gatlingweb.dto.LaunchRequest;
import com.gatlingweb.dto.MetricsSnapshot;
import com.gatlingweb.dto.TestRunDto;
import com.gatlingweb.dto.TrendDataDto;
import com.gatlingweb.dto.UpdateLabelsRequest;
import com.gatlingweb.service.MetricsPersistenceService;
import com.gatlingweb.service.PdfExportService;
import com.gatlingweb.service.TestRunService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/tests")
public class TestRunController {

    private final TestRunService testRunService;
    private final MetricsPersistenceService metricsPersistenceService;
    private final PdfExportService pdfExportService;

    public TestRunController(TestRunService testRunService, MetricsPersistenceService metricsPersistenceService,
                             PdfExportService pdfExportService) {
        this.testRunService = testRunService;
        this.metricsPersistenceService = metricsPersistenceService;
        this.pdfExportService = pdfExportService;
    }

    @PostMapping("/launch")
    public TestRunDto launch(@Valid @RequestBody LaunchRequest request) {
        return testRunService.launch(request);
    }

    @PostMapping("/{id}/cancel")
    public ResponseEntity<?> cancel(@PathVariable Long id) {
        testRunService.cancel(id);
        return ResponseEntity.ok(Map.of("status", "cancelled"));
    }

    @GetMapping
    public Page<TestRunDto> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "startTime") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir,
            @RequestParam(required = false) String label
    ) {
        Sort sort = sortDir.equalsIgnoreCase("asc")
                ? Sort.by(sortBy).ascending()
                : Sort.by(sortBy).descending();
        if (label != null && !label.isBlank()) {
            return testRunService.findByLabel(label.trim(), PageRequest.of(page, size, sort));
        }
        return testRunService.findAll(PageRequest.of(page, size, sort));
    }

    @GetMapping("/{id}")
    public ResponseEntity<TestRunDto> get(@PathVariable Long id) {
        return testRunService.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/running")
    public ResponseEntity<TestRunDto> getRunning() {
        return testRunService.findRunning()
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        testRunService.delete(id);
        return ResponseEntity.ok(Map.of("status", "deleted"));
    }

    @PutMapping("/{id}/version")
    public ResponseEntity<?> updateVersion(@PathVariable Long id, @RequestBody Map<String, String> body) {
        testRunService.updateVersion(id, body.get("version"));
        return ResponseEntity.ok(Map.of("status", "updated"));
    }

    @PutMapping("/{id}/labels")
    public ResponseEntity<?> updateLabels(@PathVariable Long id, @RequestBody UpdateLabelsRequest request) {
        testRunService.updateLabels(id, request.labels());
        return ResponseEntity.ok(Map.of("status", "updated"));
    }

    @GetMapping("/{id}/metrics")
    public List<MetricsSnapshot> getMetrics(@PathVariable Long id) {
        return metricsPersistenceService.getMetrics(id);
    }

    @GetMapping("/{id}/infra-metrics")
    public List<InfraMetricsSnapshot> getInfraMetrics(@PathVariable Long id) {
        return metricsPersistenceService.getInfraMetrics(id);
    }

    @GetMapping("/queue")
    public List<TestRunDto> getQueue() {
        return testRunService.getQueue();
    }

    @PostMapping("/{id}/cancel-queued")
    public ResponseEntity<?> cancelQueued(@PathVariable Long id) {
        testRunService.cancelQueued(id);
        return ResponseEntity.ok(Map.of("status", "cancelled"));
    }

    @GetMapping("/simulation-classes")
    public List<String> getSimulationClasses() {
        return testRunService.getCompletedSimulationClasses();
    }

    @GetMapping("/trends")
    public TrendDataDto getTrends(
            @RequestParam String simulationClass,
            @RequestParam(defaultValue = "20") int limit) {
        return testRunService.getTrends(simulationClass, limit);
    }

    @GetMapping("/{id}/export/pdf")
    public ResponseEntity<byte[]> exportPdf(@PathVariable Long id) {
        byte[] pdf = pdfExportService.generateSingleTestPdf(id);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=test-report-" + id + ".pdf")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }

    @GetMapping("/compare/export/pdf")
    public ResponseEntity<byte[]> exportComparisonPdf(@RequestParam String ids) {
        String[] parts = ids.split(",");
        if (parts.length != 2) {
            throw new IllegalArgumentException("Exactly 2 test IDs required");
        }
        long idA = Long.parseLong(parts[0].trim());
        long idB = Long.parseLong(parts[1].trim());
        byte[] pdf = pdfExportService.generateComparisonPdf(idA, idB);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=comparison-" + idA + "-vs-" + idB + ".pdf")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }

    @GetMapping("/summary")
    public Map<String, Object> summary() {
        return testRunService.getSummary();
    }

    @GetMapping("/labels")
    public List<String> getAllLabels() {
        return testRunService.getAllLabels();
    }

    @GetMapping("/export/json")
    public List<TestRunDto> exportJson() {
        return testRunService.findAll(PageRequest.of(0, Integer.MAX_VALUE, Sort.by("startTime").descending())).getContent();
    }

    @GetMapping("/export/csv")
    public ResponseEntity<byte[]> exportCsv() {
        String csv = testRunService.exportCsv();
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=test-results.csv")
                .header(HttpHeaders.CONTENT_TYPE, "text/csv; charset=UTF-8")
                .body(csv.getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }

    @GetMapping("/compare")
    public ComparisonDto compare(@RequestParam String ids) {
        String[] parts = ids.split(",");
        if (parts.length != 2) {
            throw new IllegalArgumentException("Exactly 2 test IDs required");
        }
        return testRunService.compare(Long.parseLong(parts[0].trim()), Long.parseLong(parts[1].trim()));
    }
}
