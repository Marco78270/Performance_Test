package com.gatlingweb.selenium.controller;

import com.gatlingweb.selenium.dto.SeleniumComparisonDto;
import com.gatlingweb.selenium.dto.SeleniumMetricsSnapshot;
import com.gatlingweb.selenium.entity.SeleniumTestRun;
import com.gatlingweb.selenium.repository.SeleniumTestRunRepository;
import com.gatlingweb.selenium.service.SeleniumMetricsCollector;
import com.gatlingweb.selenium.service.SeleniumPdfExportService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/selenium")
public class SeleniumComparisonController {

    private final SeleniumTestRunRepository testRunRepository;
    private final SeleniumMetricsCollector metricsCollector;
    private final SeleniumPdfExportService pdfExportService;

    public SeleniumComparisonController(
            SeleniumTestRunRepository testRunRepository,
            SeleniumMetricsCollector metricsCollector,
            SeleniumPdfExportService pdfExportService) {
        this.testRunRepository = testRunRepository;
        this.metricsCollector = metricsCollector;
        this.pdfExportService = pdfExportService;
    }

    @GetMapping("/compare")
    public ResponseEntity<?> compare(@RequestParam String ids) {
        String[] parts = ids.split(",");
        if (parts.length != 2) {
            return ResponseEntity.badRequest().body(Map.of("error", "Exactly 2 ids required"));
        }
        Long idA = Long.parseLong(parts[0].trim());
        Long idB = Long.parseLong(parts[1].trim());

        SeleniumTestRun testA = testRunRepository.findById(idA)
                .orElseThrow(() -> new IllegalArgumentException("Test not found: " + idA));
        SeleniumTestRun testB = testRunRepository.findById(idB)
                .orElseThrow(() -> new IllegalArgumentException("Test not found: " + idB));

        List<SeleniumMetricsSnapshot> metricsA = metricsCollector.getMetrics(idA);
        List<SeleniumMetricsSnapshot> metricsB = metricsCollector.getMetrics(idB);

        Map<String, Double> aggA = aggregateMetrics(testA, metricsA);
        Map<String, Double> aggB = aggregateMetrics(testB, metricsB);

        Map<String, Double> diffPercent = new LinkedHashMap<>();
        for (String key : aggA.keySet()) {
            Double valA = aggA.get(key);
            Double valB = aggB.get(key);
            if (valA != null && valB != null && valA != 0) {
                diffPercent.put(key, ((valB - valA) / Math.abs(valA)) * 100.0);
            } else {
                diffPercent.put(key, null);
            }
        }

        return ResponseEntity.ok(new SeleniumComparisonDto(testA, testB, diffPercent, aggA, aggB));
    }

    @GetMapping("/compare/export/pdf")
    public ResponseEntity<byte[]> compareExportPdf(@RequestParam String ids) {
        String[] parts = ids.split(",");
        Long idA = Long.parseLong(parts[0].trim());
        Long idB = Long.parseLong(parts[1].trim());
        byte[] pdf = pdfExportService.generateComparisonPdf(idA, idB);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=selenium-compare-" + idA + "-vs-" + idB + ".pdf")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }

    private Map<String, Double> aggregateMetrics(SeleniumTestRun run, List<SeleniumMetricsSnapshot> metrics) {
        Map<String, Double> agg = new LinkedHashMap<>();
        agg.put("meanStepDuration", run.getMeanStepDuration());

        if (!metrics.isEmpty()) {
            List<Double> p50Vals = metrics.stream().map(SeleniumMetricsSnapshot::p50).filter(v -> v > 0).toList();
            List<Double> p75Vals = metrics.stream().map(SeleniumMetricsSnapshot::p75).filter(v -> v > 0).toList();
            List<Double> p95Vals = metrics.stream().map(SeleniumMetricsSnapshot::p95).filter(v -> v > 0).toList();
            List<Double> p99Vals = metrics.stream().map(SeleniumMetricsSnapshot::p99).filter(v -> v > 0).toList();

            agg.put("p50", p50Vals.isEmpty() ? null : p50Vals.stream().mapToDouble(Double::doubleValue).average().orElse(0));
            agg.put("p75", p75Vals.isEmpty() ? null : p75Vals.stream().mapToDouble(Double::doubleValue).average().orElse(0));
            agg.put("p95", p95Vals.isEmpty() ? null : p95Vals.stream().mapToDouble(Double::doubleValue).average().orElse(0));
            agg.put("p99", p99Vals.isEmpty() ? null : p99Vals.stream().mapToDouble(Double::doubleValue).average().orElse(0));
        } else {
            agg.put("p50", null);
            agg.put("p75", null);
            agg.put("p95", null);
            agg.put("p99", null);
        }

        int total = run.getTotalIterations();
        int failed = run.getFailedIterations();
        agg.put("totalIterations", (double) total);
        agg.put("passedIterations", (double) run.getPassedIterations());
        agg.put("failedIterations", (double) failed);
        agg.put("errorRate", total > 0 ? ((double) failed / total) * 100.0 : 0.0);
        agg.put("passedInstances", (double) run.getPassedInstances());
        agg.put("failedInstances", (double) run.getFailedInstances());

        return agg;
    }
}
