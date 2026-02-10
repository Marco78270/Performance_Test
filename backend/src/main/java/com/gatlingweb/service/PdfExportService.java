package com.gatlingweb.service;

import com.gatlingweb.dto.ComparisonDto;
import com.gatlingweb.dto.InfraMetricsSnapshot;
import com.gatlingweb.dto.MetricsSnapshot;
import com.gatlingweb.dto.TestRunDto;
import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class PdfExportService {

    private final TestRunService testRunService;
    private final MetricsPersistenceService metricsPersistenceService;

    public PdfExportService(TestRunService testRunService, MetricsPersistenceService metricsPersistenceService) {
        this.testRunService = testRunService;
        this.metricsPersistenceService = metricsPersistenceService;
    }

    public byte[] generateSingleTestPdf(Long id) {
        TestRunDto run = testRunService.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Test not found: " + id));

        List<MetricsSnapshot> gatlingMetrics = metricsPersistenceService.getMetrics(id);
        List<InfraMetricsSnapshot> infraMetrics = metricsPersistenceService.getInfraMetrics(id);

        StringBuilder html = new StringBuilder();
        html.append(htmlHead("Test Report - #" + id));
        html.append("<h1>Test Report #").append(id).append("</h1>");

        // Executive summary box
        long totalReq = run.totalRequests() != null ? run.totalRequests() : 0;
        long totalErr = run.totalErrors() != null ? run.totalErrors() : 0;
        double errorRate = totalReq > 0 ? (double) totalErr / totalReq * 100 : 0;
        String verdictColor = "PASSED".equals(run.thresholdVerdict()) ? "#27ae60" : "FAILED".equals(run.thresholdVerdict()) ? "#e94560" : "#666";
        html.append("<div style=\"background:#f5f5f5;padding:10px;border-radius:5px;border-left:4px solid ").append(verdictColor).append(";margin-bottom:12px;\">");
        html.append("<div style=\"font-size:12px;font-weight:bold;margin-bottom:6px;\">").append(esc(run.simulationClass())).append("</div>");
        html.append("<div style=\"display:inline-block;width:120px;\"><span style=\"color:#888;\">Status:</span> <b>").append(run.status().name()).append("</b></div>");
        if (run.thresholdVerdict() != null) {
            html.append("<div style=\"display:inline-block;width:120px;\"><span style=\"color:#888;\">Verdict:</span> <b style=\"color:").append(verdictColor).append(";\">").append(run.thresholdVerdict()).append("</b></div>");
        }
        html.append("<div style=\"display:inline-block;width:150px;\"><span style=\"color:#888;\">Requests:</span> <b>").append(totalReq).append("</b></div>");
        html.append("<div style=\"display:inline-block;width:150px;\"><span style=\"color:#888;\">Error Rate:</span> <b>").append(String.format("%.2f%%", errorRate)).append("</b></div>");
        if (run.meanResponseTime() != null) {
            html.append("<div style=\"display:inline-block;width:150px;\"><span style=\"color:#888;\">Mean RT:</span> <b>").append(String.format("%.0f ms", run.meanResponseTime())).append("</b></div>");
        }
        if (run.p95ResponseTime() != null) {
            html.append("<div style=\"display:inline-block;width:150px;\"><span style=\"color:#888;\">p95:</span> <b>").append(String.format("%.0f ms", run.p95ResponseTime())).append("</b></div>");
        }
        html.append("</div>");

        // Test details table
        html.append("<h2>Test Details</h2>");
        html.append("<table>");
        html.append(row("Test ID", "#" + run.id()));
        html.append(row("Simulation", run.simulationClass()));
        html.append(row("Version", run.version() != null ? run.version() : "-"));
        html.append(row("Status", run.status().name()));
        html.append(row("Start Time", run.startTime() != null ? run.startTime().toString() : "-"));
        html.append(row("End Time", run.endTime() != null ? run.endTime().toString() : "-"));
        if (run.startTime() != null && run.endTime() != null) {
            long durationMs = java.time.Duration.between(run.startTime(), run.endTime()).toMillis();
            long sec = durationMs / 1000;
            String dur = sec >= 60 ? String.format("%dm %ds", sec / 60, sec % 60) : sec + "s";
            html.append(row("Duration", dur));
        }
        if (run.thresholdVerdict() != null) {
            html.append(row("Verdict", run.thresholdVerdict()));
        }
        if (run.bandwidthLimitMbps() != null) {
            html.append(row("Bandwidth Limit", run.bandwidthLimitMbps() + " Mbps"));
        }
        html.append("</table>");

        // Performance metrics
        html.append("<h2>Performance Metrics</h2>");
        html.append("<table>");
        html.append("<tr><th>Metric</th><th>Value</th></tr>");
        html.append(metricRow("Total Requests", run.totalRequests()));
        html.append(metricRow("Total Errors", run.totalErrors()));
        html.append(metricRow("Error Rate (%)", String.format("%.2f", errorRate)));
        html.append(metricRow("Mean RT (ms)", run.meanResponseTime()));
        html.append(metricRow("p50 (ms)", run.p50ResponseTime()));
        html.append(metricRow("p75 (ms)", run.p75ResponseTime()));
        html.append(metricRow("p95 (ms)", run.p95ResponseTime()));
        html.append(metricRow("p99 (ms)", run.p99ResponseTime()));
        html.append("</table>");

        // Threshold evaluation
        if (run.thresholdDetails() != null && !run.thresholdDetails().isEmpty()) {
            html.append("<h2>Threshold Evaluation</h2>");
            html.append("<table>");
            html.append("<tr><th>Rule</th><th>Threshold</th><th>Actual</th><th>Status</th></tr>");
            for (var detail : run.thresholdDetails()) {
                String status = detail.passed() ? "PASS" : "FAIL";
                String color = detail.passed() ? "#27ae60" : "#e94560";
                html.append("<tr>");
                html.append("<td>").append(esc(detail.metric())).append("</td>");
                html.append("<td>").append(esc(detail.operator())).append(" ").append(detail.threshold()).append("</td>");
                html.append("<td>").append(String.format("%.1f", detail.actual())).append("</td>");
                html.append("<td style=\"color:").append(color).append(";font-weight:bold;\">").append(status).append("</td>");
                html.append("</tr>");
            }
            html.append("</table>");
        }

        // Gatling metrics time-series
        if (!gatlingMetrics.isEmpty()) {
            html.append("<h2>Gatling Metrics Over Time</h2>");
            appendGatlingTimeSeries(html, gatlingMetrics);
        }

        // Infrastructure metrics
        if (!infraMetrics.isEmpty()) {
            html.append("<h2>Infrastructure Monitoring</h2>");
            appendInfraMetricsSummary(html, infraMetrics);
            appendInfraTimeSeries(html, infraMetrics);
        }

        html.append(htmlFoot());
        return convertHtmlToPdf(html.toString());
    }

    public byte[] generateComparisonPdf(Long idA, Long idB) {
        ComparisonDto comp = testRunService.compare(idA, idB);
        TestRunDto testA = comp.testA();
        TestRunDto testB = comp.testB();
        Map<String, Double> diff = comp.diffPercent();

        List<MetricsSnapshot> metricsA = metricsPersistenceService.getMetrics(idA);
        List<MetricsSnapshot> metricsB = metricsPersistenceService.getMetrics(idB);
        List<InfraMetricsSnapshot> infraA = metricsPersistenceService.getInfraMetrics(idA);
        List<InfraMetricsSnapshot> infraB = metricsPersistenceService.getInfraMetrics(idB);

        StringBuilder html = new StringBuilder();
        html.append(htmlHead("Comparison Report - #" + idA + " vs #" + idB));
        html.append("<h1>Test Comparison</h1>");

        // Test info
        html.append("<table>");
        html.append("<tr><th></th><th>Test A (#").append(testA.id()).append(")</th><th>Test B (#").append(testB.id()).append(")</th></tr>");
        html.append("<tr><td>Simulation</td><td>").append(esc(testA.simulationClass())).append("</td><td>").append(esc(testB.simulationClass())).append("</td></tr>");
        html.append("<tr><td>Version</td><td>").append(testA.version() != null ? esc(testA.version()) : "-").append("</td><td>").append(testB.version() != null ? esc(testB.version()) : "-").append("</td></tr>");
        html.append("<tr><td>Status</td><td>").append(testA.status().name()).append("</td><td>").append(testB.status().name()).append("</td></tr>");
        html.append("</table>");

        // Metrics comparison
        html.append("<h2>Metrics Comparison</h2>");
        html.append("<table>");
        html.append("<tr><th>Metric</th><th>Test A</th><th>Test B</th><th>Diff (%)</th></tr>");

        String[][] metrics = {
            {"meanResponseTime", "Mean RT (ms)"},
            {"p50ResponseTime", "p50 (ms)"},
            {"p75ResponseTime", "p75 (ms)"},
            {"p95ResponseTime", "p95 (ms)"},
            {"p99ResponseTime", "p99 (ms)"},
            {"totalRequests", "Total Requests"},
            {"errorRate", "Error Rate (%)"},
        };

        for (String[] m : metrics) {
            String key = m[0];
            String label = m[1];
            Double valA = getMetric(testA, key);
            Double valB = getMetric(testB, key);
            Double d = diff.get(key);

            String diffStr = d != null ? String.format("%+.1f%%", d) : "-";
            String diffColor = "#666";
            if (d != null) {
                boolean isRt = key.contains("ResponseTime") || key.equals("errorRate");
                if (isRt ? d < 0 : d > 0) diffColor = "#27ae60";
                else if (isRt ? d > 0 : d < 0) diffColor = "#e94560";
            }

            html.append("<tr>");
            html.append("<td style=\"font-weight:bold;\">").append(label).append("</td>");
            html.append("<td>").append(valA != null ? String.format("%.1f", valA) : "-").append("</td>");
            html.append("<td>").append(valB != null ? String.format("%.1f", valB) : "-").append("</td>");
            html.append("<td style=\"color:").append(diffColor).append(";font-weight:bold;\">").append(diffStr).append("</td>");
            html.append("</tr>");
        }
        html.append("</table>");

        // Gatling metrics time-series for both tests
        if (!metricsA.isEmpty() || !metricsB.isEmpty()) {
            html.append("<h2>Gatling Metrics - Test A (#").append(testA.id()).append(")</h2>");
            if (!metricsA.isEmpty()) {
                appendGatlingTimeSeries(html, metricsA);
            } else {
                html.append("<p>No metrics data available.</p>");
            }

            html.append("<h2>Gatling Metrics - Test B (#").append(testB.id()).append(")</h2>");
            if (!metricsB.isEmpty()) {
                appendGatlingTimeSeries(html, metricsB);
            } else {
                html.append("<p>No metrics data available.</p>");
            }
        }

        // Infra metrics for both tests
        if (!infraA.isEmpty()) {
            html.append("<h2>Infrastructure - Test A (#").append(testA.id()).append(")</h2>");
            appendInfraMetricsSummary(html, infraA);
        }
        if (!infraB.isEmpty()) {
            html.append("<h2>Infrastructure - Test B (#").append(testB.id()).append(")</h2>");
            appendInfraMetricsSummary(html, infraB);
        }

        html.append(htmlFoot());
        return convertHtmlToPdf(html.toString());
    }

    private void appendGatlingTimeSeries(StringBuilder html, List<MetricsSnapshot> metrics) {
        // Sample to max 20 rows to keep PDF readable
        List<MetricsSnapshot> sampled = sample(metrics, 20);
        long startTs = metrics.get(0).timestamp();

        html.append("<table>");
        html.append("<tr><th>Time</th><th>Req/s</th><th>Err/s</th><th>Mean RT</th><th>p50</th><th>p75</th><th>p95</th><th>p99</th><th>Users</th><th>Total Req</th><th>Total Err</th></tr>");
        for (MetricsSnapshot s : sampled) {
            long elapsed = (s.timestamp() - startTs) / 1000;
            String time = formatElapsed(elapsed);
            html.append("<tr>");
            html.append("<td>").append(time).append("</td>");
            html.append("<td>").append(String.format("%.1f", s.requestsPerSecond())).append("</td>");
            html.append("<td>").append(String.format("%.1f", s.errorsPerSecond())).append("</td>");
            html.append("<td>").append(String.format("%.0f", s.meanResponseTime())).append("</td>");
            html.append("<td>").append(String.format("%.0f", s.p50())).append("</td>");
            html.append("<td>").append(String.format("%.0f", s.p75())).append("</td>");
            html.append("<td>").append(String.format("%.0f", s.p95())).append("</td>");
            html.append("<td>").append(String.format("%.0f", s.p99())).append("</td>");
            html.append("<td>").append(s.activeUsers()).append("</td>");
            html.append("<td>").append(s.totalRequests()).append("</td>");
            html.append("<td>").append(s.totalErrors()).append("</td>");
            html.append("</tr>");
        }
        html.append("</table>");
    }

    private void appendInfraMetricsSummary(StringBuilder html, List<InfraMetricsSnapshot> infraMetrics) {
        // Group by server
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

            // CPU
            DoubleSummaryStatistics cpu = points.stream()
                    .filter(p -> p.cpuPercent() != null)
                    .mapToDouble(InfraMetricsSnapshot::cpuPercent)
                    .summaryStatistics();
            if (cpu.getCount() > 0) {
                html.append(summaryRow("CPU (%)", cpu));
            }

            // Memory %
            DoubleSummaryStatistics mem = points.stream()
                    .filter(p -> p.memoryPercent() != null)
                    .mapToDouble(InfraMetricsSnapshot::memoryPercent)
                    .summaryStatistics();
            if (mem.getCount() > 0) {
                html.append(summaryRow("Memory (%)", mem));
            }

            // Disk Read
            DoubleSummaryStatistics diskRead = points.stream()
                    .filter(p -> p.diskReadBytesPerSec() != null)
                    .mapToDouble(p -> p.diskReadBytesPerSec() / (1024 * 1024))
                    .summaryStatistics();
            if (diskRead.getCount() > 0) {
                html.append(summaryRow("Disk Read (MB/s)", diskRead));
            }

            // Disk Write
            DoubleSummaryStatistics diskWrite = points.stream()
                    .filter(p -> p.diskWriteBytesPerSec() != null)
                    .mapToDouble(p -> p.diskWriteBytesPerSec() / (1024 * 1024))
                    .summaryStatistics();
            if (diskWrite.getCount() > 0) {
                html.append(summaryRow("Disk Write (MB/s)", diskWrite));
            }

            // Network Recv
            DoubleSummaryStatistics netRecv = points.stream()
                    .filter(p -> p.networkRecvBytesPerSec() != null)
                    .mapToDouble(p -> p.networkRecvBytesPerSec() / (1024 * 1024))
                    .summaryStatistics();
            if (netRecv.getCount() > 0) {
                html.append(summaryRow("Network In (MB/s)", netRecv));
            }

            // Network Sent
            DoubleSummaryStatistics netSent = points.stream()
                    .filter(p -> p.networkSentBytesPerSec() != null)
                    .mapToDouble(p -> p.networkSentBytesPerSec() / (1024 * 1024))
                    .summaryStatistics();
            if (netSent.getCount() > 0) {
                html.append(summaryRow("Network Out (MB/s)", netSent));
            }

            // SQL Batch
            DoubleSummaryStatistics sql = points.stream()
                    .filter(p -> p.sqlBatchPerSec() != null)
                    .mapToDouble(InfraMetricsSnapshot::sqlBatchPerSec)
                    .summaryStatistics();
            if (sql.getCount() > 0) {
                html.append(summaryRow("SQL Batch/s", sql));
            }

            html.append("</table>");
        }
    }

    private void appendInfraTimeSeries(StringBuilder html, List<InfraMetricsSnapshot> infraMetrics) {
        Map<String, List<InfraMetricsSnapshot>> byServer = infraMetrics.stream()
                .filter(s -> s.serverName() != null)
                .collect(Collectors.groupingBy(InfraMetricsSnapshot::serverName, LinkedHashMap::new, Collectors.toList()));

        for (var entry : byServer.entrySet()) {
            String serverName = entry.getKey();
            List<InfraMetricsSnapshot> points = entry.getValue();
            List<InfraMetricsSnapshot> sampled = sample(points, 15);
            long startTs = points.get(0).timestamp();

            html.append("<h3>").append(esc(serverName)).append(" - Time Series</h3>");
            html.append("<table>");
            html.append("<tr><th>Time</th><th>CPU %</th><th>Memory %</th><th>Disk R (MB/s)</th><th>Disk W (MB/s)</th><th>Net In (MB/s)</th><th>Net Out (MB/s)</th></tr>");

            for (InfraMetricsSnapshot s : sampled) {
                long elapsed = (s.timestamp() - startTs) / 1000;
                html.append("<tr>");
                html.append("<td>").append(formatElapsed(elapsed)).append("</td>");
                html.append("<td>").append(fmtOpt(s.cpuPercent(), "%.1f")).append("</td>");
                html.append("<td>").append(fmtOpt(s.memoryPercent(), "%.1f")).append("</td>");
                html.append("<td>").append(fmtOptMb(s.diskReadBytesPerSec())).append("</td>");
                html.append("<td>").append(fmtOptMb(s.diskWriteBytesPerSec())).append("</td>");
                html.append("<td>").append(fmtOptMb(s.networkRecvBytesPerSec())).append("</td>");
                html.append("<td>").append(fmtOptMb(s.networkSentBytesPerSec())).append("</td>");
                html.append("</tr>");
            }
            html.append("</table>");
        }
    }

    private String summaryRow(String label, DoubleSummaryStatistics stats) {
        return "<tr><td style=\"font-weight:bold;\">" + esc(label) + "</td>" +
                "<td>" + String.format("%.1f", stats.getMin()) + "</td>" +
                "<td>" + String.format("%.1f", stats.getAverage()) + "</td>" +
                "<td>" + String.format("%.1f", stats.getMax()) + "</td></tr>\n";
    }

    private String fmtOpt(Double val, String fmt) {
        return val != null ? String.format(fmt, val) : "-";
    }

    private String fmtOptMb(Double bytesPerSec) {
        if (bytesPerSec == null) return "-";
        return String.format("%.2f", bytesPerSec / (1024 * 1024));
    }

    private String formatElapsed(long seconds) {
        long min = seconds / 60;
        long sec = seconds % 60;
        return min > 0 ? String.format("%dm%ds", min, sec) : String.format("%ds", sec);
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

    private Double getMetric(TestRunDto run, String key) {
        return switch (key) {
            case "meanResponseTime" -> run.meanResponseTime();
            case "p50ResponseTime" -> run.p50ResponseTime();
            case "p75ResponseTime" -> run.p75ResponseTime();
            case "p95ResponseTime" -> run.p95ResponseTime();
            case "p99ResponseTime" -> run.p99ResponseTime();
            case "totalRequests" -> run.totalRequests() != null ? run.totalRequests().doubleValue() : null;
            case "errorRate" -> {
                long total = run.totalRequests() != null ? run.totalRequests() : 0;
                long errors = run.totalErrors() != null ? run.totalErrors() : 0;
                yield total > 0 ? (double) errors / total * 100 : 0.0;
            }
            default -> null;
        };
    }

    private String htmlHead(String title) {
        return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n" +
            "<!DOCTYPE html PUBLIC \"-//W3C//DTD XHTML 1.0 Strict//EN\" \"http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd\">\n" +
            "<html xmlns=\"http://www.w3.org/1999/xhtml\">\n<head><title>" + esc(title) + "</title>\n" +
            "<style>\n" +
            "body { font-family: Helvetica, Arial, sans-serif; font-size: 10px; color: #333; margin: 25px; }\n" +
            "h1 { font-size: 20px; color: #1a1a2e; border-bottom: 2px solid #e94560; padding-bottom: 5px; }\n" +
            "h2 { font-size: 14px; color: #16213e; margin-top: 18px; border-bottom: 1px solid #ccc; padding-bottom: 3px; }\n" +
            "h3 { font-size: 12px; color: #333; margin-top: 12px; }\n" +
            "p { color: #666; font-size: 10px; }\n" +
            "table { width: 100%; border-collapse: collapse; margin-top: 6px; margin-bottom: 10px; }\n" +
            "th, td { text-align: left; padding: 4px 6px; border: 1px solid #ddd; font-size: 9px; }\n" +
            "th { background: #16213e; color: #fff; font-size: 8px; text-transform: uppercase; }\n" +
            "tr:nth-child(even) { background: #f9f9f9; }\n" +
            ".footer { margin-top: 30px; font-size: 8px; color: #999; text-align: center; }\n" +
            "</style>\n</head>\n<body>\n";
    }

    private String htmlFoot() {
        return "<div class=\"footer\">Generated by Gatling Web - " +
            LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")) +
            "</div>\n</body>\n</html>";
    }

    private String row(String label, String value) {
        return "<tr><td style=\"font-weight:bold;width:150px;\">" + esc(label) + "</td><td>" + esc(value != null ? value : "-") + "</td></tr>\n";
    }

    private String metricRow(String label, Object value) {
        String v;
        if (value == null) {
            v = "-";
        } else if (value instanceof Double d) {
            v = String.format("%.1f", d);
        } else if (value instanceof Long l) {
            v = l.toString();
        } else {
            v = value.toString();
        }
        return "<tr><td>" + esc(label) + "</td><td>" + esc(v) + "</td></tr>\n";
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
