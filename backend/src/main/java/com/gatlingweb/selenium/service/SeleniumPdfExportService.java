package com.gatlingweb.selenium.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.gatlingweb.dto.InfraMetricsSnapshot;
import com.gatlingweb.selenium.dto.SeleniumMetricsSnapshot;
import com.gatlingweb.selenium.entity.SeleniumBrowserResult;
import com.gatlingweb.selenium.entity.SeleniumTestRun;
import com.gatlingweb.selenium.repository.SeleniumBrowserResultRepository;
import com.gatlingweb.selenium.repository.SeleniumTestRunRepository;
import com.gatlingweb.service.MetricsPersistenceService;
import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class SeleniumPdfExportService {

    private final SeleniumTestRunRepository testRunRepository;
    private final SeleniumBrowserResultRepository resultRepository;
    private final SeleniumMetricsCollector metricsCollector;
    private final MetricsPersistenceService metricsPersistenceService;
    private final ObjectMapper objectMapper;

    public SeleniumPdfExportService(SeleniumTestRunRepository testRunRepository,
                                     SeleniumBrowserResultRepository resultRepository,
                                     SeleniumMetricsCollector metricsCollector,
                                     MetricsPersistenceService metricsPersistenceService,
                                     ObjectMapper objectMapper) {
        this.testRunRepository = testRunRepository;
        this.resultRepository = resultRepository;
        this.metricsCollector = metricsCollector;
        this.metricsPersistenceService = metricsPersistenceService;
        this.objectMapper = objectMapper;
    }

    public byte[] generatePdf(Long id) {
        SeleniumTestRun run = testRunRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Selenium test not found: " + id));

        List<SeleniumBrowserResult> results = resultRepository.findByTestRunIdOrderByBrowserIndexAscIterationAsc(id);
        List<SeleniumMetricsSnapshot> selMetrics = metricsCollector.getMetrics(id);
        List<InfraMetricsSnapshot> infraMetrics = metricsPersistenceService.getInfraMetrics(id);

        StringBuilder html = new StringBuilder();
        html.append(htmlHead("Selenium Report - #" + id));
        html.append("<h1>Selenium Test Report #").append(id).append("</h1>");

        // Executive summary
        long passed = results.stream().filter(r -> "PASSED".equals(r.getStatus())).count();
        long failed = results.stream().filter(r -> "FAILED".equals(r.getStatus()) || "ERROR".equals(r.getStatus())).count();
        long totalIter = passed + failed;
        double passRate = totalIter > 0 ? (double) passed / totalIter * 100 : 0;
        String summaryColor = failed == 0 ? "#27ae60" : "#e94560";

        html.append("<div style=\"background:#f5f5f5;padding:10px;border-radius:5px;border-left:4px solid ").append(summaryColor).append(";margin-bottom:12px;\">");
        html.append("<div style=\"font-size:12px;font-weight:bold;margin-bottom:6px;\">").append(esc(run.getScriptClass())).append("</div>");
        html.append("<div style=\"display:inline-block;width:120px;\"><span style=\"color:#888;\">Status:</span> <b>").append(run.getStatus().name()).append("</b></div>");
        html.append("<div style=\"display:inline-block;width:120px;\"><span style=\"color:#888;\">Browser:</span> <b>").append(esc(run.getBrowser())).append("</b></div>");
        html.append("<div style=\"display:inline-block;width:120px;\"><span style=\"color:#888;\">Instances:</span> <b>").append(run.getInstances()).append("</b></div>");
        html.append("<div style=\"display:inline-block;width:120px;\"><span style=\"color:#888;\">Loops:</span> <b>").append(run.getLoops()).append("</b></div>");
        html.append("<div style=\"display:inline-block;width:150px;\"><span style=\"color:#888;\">Pass Rate:</span> <b>").append(String.format("%.1f%%", passRate)).append("</b></div>");
        if (run.getMeanStepDuration() != null) {
            html.append("<div style=\"display:inline-block;width:150px;\"><span style=\"color:#888;\">Mean Step:</span> <b>").append(String.format("%.0f ms", run.getMeanStepDuration())).append("</b></div>");
        }
        html.append("</div>");

        // Test details table
        html.append("<h2>Test Details</h2>");
        html.append("<table>");
        html.append(row("Test ID", "#" + run.getId()));
        html.append(row("Script Class", run.getScriptClass()));
        html.append(row("Browser", run.getBrowser()));
        html.append(row("Instances", String.valueOf(run.getInstances())));
        html.append(row("Loops", String.valueOf(run.getLoops())));
        html.append(row("Ramp-up", run.getRampUpSeconds() > 0 ? run.getRampUpSeconds() + "s" : "None"));
        html.append(row("Headless", run.isHeadless() ? "Yes" : "No"));
        html.append(row("Version", run.getVersion() != null ? run.getVersion() : "-"));
        html.append(row("Status", run.getStatus().name()));
        if (run.getStartTime() != null) {
            html.append(row("Start Time", formatTimestamp(run.getStartTime())));
        }
        if (run.getEndTime() != null) {
            html.append(row("End Time", formatTimestamp(run.getEndTime())));
        }
        if (run.getStartTime() != null && run.getEndTime() != null) {
            html.append(row("Duration", formatDuration(run.getEndTime() - run.getStartTime())));
        }
        html.append("</table>");

        // Results summary
        html.append("<h2>Results Summary</h2>");
        html.append("<table>");
        html.append("<tr><th>Metric</th><th>Value</th></tr>");
        html.append(metricRow("Total Iterations", totalIter));
        html.append(metricRow("Passed", passed));
        html.append(metricRow("Failed", failed));
        html.append(metricRow("Pass Rate", String.format("%.1f%%", passRate)));
        if (run.getMeanStepDuration() != null) {
            html.append(metricRow("Mean Step Duration", String.format("%.0f ms", run.getMeanStepDuration())));
        }
        html.append("</table>");

        // Browser results detail
        if (!results.isEmpty()) {
            html.append("<h2>Browser Results</h2>");
            html.append("<table>");
            html.append("<tr><th>Browser</th><th>Iteration</th><th>Status</th><th>Duration</th><th>Steps</th><th>Error</th></tr>");

            for (SeleniumBrowserResult r : results) {
                String statusColor = "PASSED".equals(r.getStatus()) ? "#27ae60" : "#e94560";
                int stepCount = 0;
                if (r.getStepsJson() != null) {
                    try {
                        List<?> steps = objectMapper.readValue(r.getStepsJson(), new TypeReference<List<Map<String, Object>>>() {});
                        stepCount = steps.size();
                    } catch (Exception ignored) {}
                }
                html.append("<tr>");
                html.append("<td>#").append(r.getBrowserIndex() + 1).append("</td>");
                html.append("<td>").append(r.getIteration() + 1).append("</td>");
                html.append("<td style=\"color:").append(statusColor).append(";font-weight:bold;\">").append(r.getStatus()).append("</td>");
                html.append("<td>").append(r.getDurationMs() != null ? formatDuration(r.getDurationMs()) : "-").append("</td>");
                html.append("<td>").append(stepCount).append("</td>");
                html.append("<td>").append(r.getErrorMessage() != null ? esc(truncate(r.getErrorMessage(), 80)) : "-").append("</td>");
                html.append("</tr>");
            }
            html.append("</table>");

            // Detailed steps per browser
            appendStepDetails(html, results);
        }

        // Selenium metrics time-series
        if (!selMetrics.isEmpty()) {
            html.append("<h2>Metrics Over Time</h2>");
            appendSeleniumTimeSeries(html, selMetrics);
        }

        // Infrastructure metrics
        if (!infraMetrics.isEmpty()) {
            html.append("<h2>Infrastructure Monitoring</h2>");
            appendInfraMetricsSummary(html, infraMetrics);
        }

        html.append(htmlFoot());
        return convertHtmlToPdf(html.toString());
    }

    public byte[] generateComparisonPdf(Long idA, Long idB) {
        SeleniumTestRun testA = testRunRepository.findById(idA)
                .orElseThrow(() -> new IllegalArgumentException("Test not found: " + idA));
        SeleniumTestRun testB = testRunRepository.findById(idB)
                .orElseThrow(() -> new IllegalArgumentException("Test not found: " + idB));

        List<SeleniumMetricsSnapshot> metricsA = metricsCollector.getMetrics(idA);
        List<SeleniumMetricsSnapshot> metricsB = metricsCollector.getMetrics(idB);
        List<InfraMetricsSnapshot> infraA = metricsPersistenceService.getInfraMetrics(idA);
        List<InfraMetricsSnapshot> infraB = metricsPersistenceService.getInfraMetrics(idB);

        // Aggregate percentiles from time-series
        Map<String, Double> aggA = aggregateForPdf(testA, metricsA);
        Map<String, Double> aggB = aggregateForPdf(testB, metricsB);

        // Compute diffs
        Map<String, Double> diff = new LinkedHashMap<>();
        for (String key : aggA.keySet()) {
            Double valA = aggA.get(key);
            Double valB = aggB.get(key);
            if (valA != null && valB != null && valA != 0) {
                diff.put(key, ((valB - valA) / Math.abs(valA)) * 100.0);
            } else {
                diff.put(key, null);
            }
        }

        StringBuilder html = new StringBuilder();
        html.append(htmlHead("Selenium Comparison - #" + idA + " vs #" + idB));
        html.append("<h1>Selenium Test Comparison</h1>");

        // Test info side by side
        html.append("<table>");
        html.append("<tr><th></th><th>Test A (#").append(testA.getId()).append(")</th><th>Test B (#").append(testB.getId()).append(")</th></tr>");
        html.append("<tr><td>Script</td><td>").append(esc(testA.getScriptClass())).append("</td><td>").append(esc(testB.getScriptClass())).append("</td></tr>");
        html.append("<tr><td>Browser</td><td>").append(esc(testA.getBrowser())).append("</td><td>").append(esc(testB.getBrowser())).append("</td></tr>");
        html.append("<tr><td>Instances</td><td>").append(testA.getInstances()).append("</td><td>").append(testB.getInstances()).append("</td></tr>");
        html.append("<tr><td>Loops</td><td>").append(testA.getLoops()).append("</td><td>").append(testB.getLoops()).append("</td></tr>");
        html.append("<tr><td>Version</td><td>").append(testA.getVersion() != null ? esc(testA.getVersion()) : "-").append("</td><td>").append(testB.getVersion() != null ? esc(testB.getVersion()) : "-").append("</td></tr>");
        html.append("<tr><td>Status</td><td>").append(testA.getStatus().name()).append("</td><td>").append(testB.getStatus().name()).append("</td></tr>");
        if (testA.getStartTime() != null) html.append("<tr><td>Start</td><td>").append(formatTimestamp(testA.getStartTime())).append("</td><td>").append(formatTimestamp(testB.getStartTime())).append("</td></tr>");
        if (testA.getStartTime() != null && testA.getEndTime() != null) {
            html.append("<tr><td>Duration</td><td>").append(formatDuration(testA.getEndTime() - testA.getStartTime())).append("</td><td>");
            if (testB.getStartTime() != null && testB.getEndTime() != null) html.append(formatDuration(testB.getEndTime() - testB.getStartTime()));
            else html.append("-");
            html.append("</td></tr>");
        }
        html.append("</table>");

        // Metrics comparison
        html.append("<h2>Metrics Comparison</h2>");
        html.append("<table>");
        html.append("<tr><th>Metric</th><th>Test A</th><th>Test B</th><th>Diff (%)</th></tr>");

        String[][] metrics = {
            {"meanStepDuration", "Mean Step (ms)"},
            {"p50", "p50 (ms)"},
            {"p75", "p75 (ms)"},
            {"p95", "p95 (ms)"},
            {"p99", "p99 (ms)"},
            {"totalIterations", "Total Iterations"},
            {"passedIterations", "Passed Iterations"},
            {"failedIterations", "Failed Iterations"},
            {"errorRate", "Error Rate (%)"},
            {"passedInstances", "Passed Instances"},
            {"failedInstances", "Failed Instances"},
        };

        for (String[] m : metrics) {
            String key = m[0];
            String label = m[1];
            Double valA = aggA.get(key);
            Double valB = aggB.get(key);
            Double d = diff.get(key);

            String diffStr = d != null ? String.format("%+.1f%%", d) : "-";
            String diffColor = "#666";
            if (d != null) {
                boolean lowerIsBetter = key.contains("Step") || key.startsWith("p") || key.equals("errorRate") || key.equals("failedIterations") || key.equals("failedInstances");
                if (lowerIsBetter ? d < 0 : d > 0) diffColor = "#27ae60";
                else if (lowerIsBetter ? d > 0 : d < 0) diffColor = "#e94560";
            }

            html.append("<tr>");
            html.append("<td style=\"font-weight:bold;\">").append(label).append("</td>");
            html.append("<td>").append(valA != null ? String.format("%.1f", valA) : "-").append("</td>");
            html.append("<td>").append(valB != null ? String.format("%.1f", valB) : "-").append("</td>");
            html.append("<td style=\"color:").append(diffColor).append(";font-weight:bold;\">").append(diffStr).append("</td>");
            html.append("</tr>");
        }
        html.append("</table>");

        // Time-series for both tests
        if (!metricsA.isEmpty()) {
            html.append("<h2>Selenium Metrics - Test A (#").append(testA.getId()).append(")</h2>");
            appendSeleniumTimeSeries(html, metricsA);
        }
        if (!metricsB.isEmpty()) {
            html.append("<h2>Selenium Metrics - Test B (#").append(testB.getId()).append(")</h2>");
            appendSeleniumTimeSeries(html, metricsB);
        }

        // Infra metrics
        if (!infraA.isEmpty()) {
            html.append("<h2>Infrastructure - Test A (#").append(testA.getId()).append(")</h2>");
            appendInfraMetricsSummary(html, infraA);
        }
        if (!infraB.isEmpty()) {
            html.append("<h2>Infrastructure - Test B (#").append(testB.getId()).append(")</h2>");
            appendInfraMetricsSummary(html, infraB);
        }

        html.append(htmlFoot());
        return convertHtmlToPdf(html.toString());
    }

    private Map<String, Double> aggregateForPdf(SeleniumTestRun run, List<SeleniumMetricsSnapshot> metrics) {
        Map<String, Double> agg = new LinkedHashMap<>();
        agg.put("meanStepDuration", run.getMeanStepDuration());

        if (!metrics.isEmpty()) {
            agg.put("p50", metrics.stream().mapToDouble(SeleniumMetricsSnapshot::p50).filter(v -> v > 0).average().orElse(0));
            agg.put("p75", metrics.stream().mapToDouble(SeleniumMetricsSnapshot::p75).filter(v -> v > 0).average().orElse(0));
            agg.put("p95", metrics.stream().mapToDouble(SeleniumMetricsSnapshot::p95).filter(v -> v > 0).average().orElse(0));
            agg.put("p99", metrics.stream().mapToDouble(SeleniumMetricsSnapshot::p99).filter(v -> v > 0).average().orElse(0));
        } else {
            agg.put("p50", null); agg.put("p75", null); agg.put("p95", null); agg.put("p99", null);
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

    private void appendStepDetails(StringBuilder html, List<SeleniumBrowserResult> results) {
        for (SeleniumBrowserResult r : results) {
            if (r.getStepsJson() == null) continue;
            List<Map<String, Object>> steps;
            try {
                steps = objectMapper.readValue(r.getStepsJson(), new TypeReference<>() {});
            } catch (Exception e) { continue; }
            if (steps.isEmpty()) continue;

            html.append("<h3>Browser #").append(r.getBrowserIndex() + 1);
            html.append(" - Iteration ").append(r.getIteration() + 1).append("</h3>");
            html.append("<table>");
            html.append("<tr><th>Step</th><th>Duration</th><th>Status</th></tr>");
            for (Map<String, Object> step : steps) {
                String name = step.get("name") != null ? step.get("name").toString() : "?";
                Object durObj = step.get("durationMs");
                long dur = durObj instanceof Number ? ((Number) durObj).longValue() : 0;
                boolean stepPassed = Boolean.TRUE.equals(step.get("passed"));
                String color = stepPassed ? "#27ae60" : "#e94560";
                html.append("<tr>");
                html.append("<td>").append(esc(name)).append("</td>");
                html.append("<td>").append(formatDuration(dur)).append("</td>");
                html.append("<td style=\"color:").append(color).append(";font-weight:bold;\">").append(stepPassed ? "PASS" : "FAIL").append("</td>");
                html.append("</tr>");
            }
            html.append("</table>");
        }
    }

    private void appendSeleniumTimeSeries(StringBuilder html, List<SeleniumMetricsSnapshot> metrics) {
        List<SeleniumMetricsSnapshot> sampled = sample(metrics, 20);
        long startTs = metrics.get(0).timestamp();

        html.append("<table>");
        html.append("<tr><th>Time</th><th>Iter/s</th><th>Err/s</th><th>Mean Step</th><th>p50</th><th>p75</th><th>p95</th><th>Browsers</th><th>Total Iter</th><th>Total Err</th></tr>");
        for (SeleniumMetricsSnapshot s : sampled) {
            long elapsed = (s.timestamp() - startTs) / 1000;
            html.append("<tr>");
            html.append("<td>").append(formatElapsed(elapsed)).append("</td>");
            html.append("<td>").append(String.format("%.2f", s.iterationsPerSecond())).append("</td>");
            html.append("<td>").append(String.format("%.2f", s.errorsPerSecond())).append("</td>");
            html.append("<td>").append(String.format("%.0f", s.meanStepDuration())).append("</td>");
            html.append("<td>").append(String.format("%.0f", s.p50())).append("</td>");
            html.append("<td>").append(String.format("%.0f", s.p75())).append("</td>");
            html.append("<td>").append(String.format("%.0f", s.p95())).append("</td>");
            html.append("<td>").append(s.activeBrowsers()).append("</td>");
            html.append("<td>").append(s.totalIterations()).append("</td>");
            html.append("<td>").append(s.totalErrors()).append("</td>");
            html.append("</tr>");
        }
        html.append("</table>");
    }

    private void appendInfraMetricsSummary(StringBuilder html, List<InfraMetricsSnapshot> infraMetrics) {
        Map<String, List<InfraMetricsSnapshot>> byServer = infraMetrics.stream()
                .filter(s -> s.serverName() != null)
                .collect(Collectors.groupingBy(InfraMetricsSnapshot::serverName, LinkedHashMap::new, Collectors.toList()));

        for (var entry : byServer.entrySet()) {
            String serverName = entry.getKey();
            List<InfraMetricsSnapshot> points = entry.getValue();
            String serverType = points.get(0).serverType() != null ? points.get(0).serverType().name() : "";

            html.append("<h3>").append(esc(serverName)).append(" (").append(serverType).append(")</h3>");
            html.append("<table>");
            html.append("<tr><th>Metric</th><th>Min</th><th>Avg</th><th>Max</th></tr>");

            DoubleSummaryStatistics cpu = points.stream().filter(p -> p.cpuPercent() != null).mapToDouble(InfraMetricsSnapshot::cpuPercent).summaryStatistics();
            if (cpu.getCount() > 0) html.append(summaryRow("CPU (%)", cpu));

            DoubleSummaryStatistics mem = points.stream().filter(p -> p.memoryPercent() != null).mapToDouble(InfraMetricsSnapshot::memoryPercent).summaryStatistics();
            if (mem.getCount() > 0) html.append(summaryRow("Memory (%)", mem));

            html.append("</table>");
        }
    }

    // --- Helpers ---

    private String htmlHead(String title) {
        return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n" +
            "<!DOCTYPE html PUBLIC \"-//W3C//DTD XHTML 1.0 Strict//EN\" \"http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd\">\n" +
            "<html xmlns=\"http://www.w3.org/1999/xhtml\">\n<head><title>" + esc(title) + "</title>\n" +
            "<style>\n" +
            "body { font-family: Helvetica, Arial, sans-serif; font-size: 10px; color: #333; margin: 25px; }\n" +
            "h1 { font-size: 20px; color: #1a1a2e; border-bottom: 2px solid #e94560; padding-bottom: 5px; }\n" +
            "h2 { font-size: 14px; color: #16213e; margin-top: 18px; border-bottom: 1px solid #ccc; padding-bottom: 3px; }\n" +
            "h3 { font-size: 12px; color: #333; margin-top: 12px; }\n" +
            "table { width: 100%; border-collapse: collapse; margin-top: 6px; margin-bottom: 10px; }\n" +
            "th, td { text-align: left; padding: 4px 6px; border: 1px solid #ddd; font-size: 9px; }\n" +
            "th { background: #16213e; color: #fff; font-size: 8px; text-transform: uppercase; }\n" +
            "tr:nth-child(even) { background: #f9f9f9; }\n" +
            ".footer { margin-top: 30px; font-size: 8px; color: #999; text-align: center; }\n" +
            "</style>\n</head>\n<body>\n";
    }

    private String htmlFoot() {
        return "<div class=\"footer\">Generated by Gatling Web (Selenium) - " +
            LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")) +
            "</div>\n</body>\n</html>";
    }

    private String row(String label, String value) {
        return "<tr><td style=\"font-weight:bold;width:150px;\">" + esc(label) + "</td><td>" + esc(value != null ? value : "-") + "</td></tr>\n";
    }

    private String metricRow(String label, Object value) {
        String v = value == null ? "-" : value.toString();
        return "<tr><td>" + esc(label) + "</td><td>" + esc(v) + "</td></tr>\n";
    }

    private String summaryRow(String label, DoubleSummaryStatistics stats) {
        return "<tr><td style=\"font-weight:bold;\">" + esc(label) + "</td>" +
                "<td>" + String.format("%.1f", stats.getMin()) + "</td>" +
                "<td>" + String.format("%.1f", stats.getAverage()) + "</td>" +
                "<td>" + String.format("%.1f", stats.getMax()) + "</td></tr>\n";
    }

    private String formatElapsed(long seconds) {
        long min = seconds / 60;
        long sec = seconds % 60;
        return min > 0 ? String.format("%dm%ds", min, sec) : String.format("%ds", sec);
    }

    private String formatDuration(long ms) {
        if (ms < 1000) return ms + "ms";
        long sec = ms / 1000;
        return sec >= 60 ? String.format("%dm%ds", sec / 60, sec % 60) : sec + "s";
    }

    private String formatTimestamp(Long ts) {
        if (ts == null) return "-";
        return LocalDateTime.ofInstant(Instant.ofEpochMilli(ts), ZoneId.systemDefault())
                .format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
    }

    private String truncate(String s, int maxLen) {
        if (s == null) return "";
        return s.length() > maxLen ? s.substring(0, maxLen) + "..." : s;
    }

    private <T> List<T> sample(List<T> list, int maxSize) {
        if (list.size() <= maxSize) return list;
        List<T> sampled = new ArrayList<>();
        double step = (double) (list.size() - 1) / (maxSize - 1);
        for (int i = 0; i < maxSize; i++) {
            sampled.add(list.get((int) Math.round(i * step)));
        }
        return sampled;
    }

    private String esc(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }

    private byte[] convertHtmlToPdf(String html) {
        try (ByteArrayOutputStream os = new ByteArrayOutputStream()) {
            PdfRendererBuilder builder = new PdfRendererBuilder();
            builder.useFastMode();
            builder.withHtmlContent(html, null);
            builder.toStream(os);
            builder.run();
            return os.toByteArray();
        } catch (Exception e) {
            throw new RuntimeException("Failed to generate PDF", e);
        }
    }
}
