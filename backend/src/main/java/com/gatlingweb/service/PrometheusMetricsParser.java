package com.gatlingweb.service;

import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
public class PrometheusMetricsParser {

    private static final Pattern METRIC_LINE = Pattern.compile("^([a-zA-Z_:][a-zA-Z0-9_:]*)(?:\\{([^}]*)\\})?\\s+([\\d.eE+-]+|NaN|\\+Inf|-Inf)");

    public Map<String, Map<String, Double>> parse(String prometheusText) {
        Map<String, Map<String, Double>> metrics = new HashMap<>();

        for (String line : prometheusText.split("\n")) {
            line = line.trim();
            if (line.isEmpty() || line.startsWith("#")) {
                continue;
            }

            Matcher matcher = METRIC_LINE.matcher(line);
            if (matcher.find()) {
                String name = matcher.group(1);
                String labels = matcher.group(2);
                String valueStr = matcher.group(3);

                try {
                    double value = parseValue(valueStr);
                    String key = labels != null ? name + "{" + labels + "}" : name;
                    metrics.computeIfAbsent(name, k -> new HashMap<>()).put(key, value);
                } catch (NumberFormatException ignored) {
                }
            }
        }

        return metrics;
    }

    private double parseValue(String valueStr) {
        if ("NaN".equals(valueStr)) return Double.NaN;
        if ("+Inf".equals(valueStr)) return Double.POSITIVE_INFINITY;
        if ("-Inf".equals(valueStr)) return Double.NEGATIVE_INFINITY;
        return Double.parseDouble(valueStr);
    }

    public Double getCpuIdleTotal(Map<String, Map<String, Double>> metrics) {
        Map<String, Double> cpuMetrics = metrics.get("windows_cpu_time_total");
        if (cpuMetrics == null) return null;

        double idleTotal = 0;
        for (Map.Entry<String, Double> entry : cpuMetrics.entrySet()) {
            if (entry.getKey().contains("mode=\"idle\"")) {
                idleTotal += entry.getValue();
            }
        }
        return idleTotal;
    }

    public Double getCpuTotal(Map<String, Map<String, Double>> metrics) {
        Map<String, Double> cpuMetrics = metrics.get("windows_cpu_time_total");
        if (cpuMetrics == null) return null;

        double total = 0;
        for (Double value : cpuMetrics.values()) {
            total += value;
        }
        return total;
    }

    public Long getPhysicalMemoryBytes(Map<String, Map<String, Double>> metrics) {
        // Try new metric name first, then fallback to old one
        Map<String, Double> mem = metrics.get("windows_memory_physical_total_bytes");
        if (mem == null || mem.isEmpty()) {
            mem = metrics.get("windows_cs_physical_memory_bytes");
        }
        if (mem == null || mem.isEmpty()) return null;
        return mem.values().iterator().next().longValue();
    }

    public Long getFreeMemoryBytes(Map<String, Map<String, Double>> metrics) {
        // Try multiple metric names - windows_exporter versions use different names
        Map<String, Double> mem = metrics.get("windows_memory_physical_free_bytes");
        if (mem == null || mem.isEmpty()) {
            mem = metrics.get("windows_memory_available_bytes");
        }
        if (mem == null || mem.isEmpty()) {
            mem = metrics.get("windows_os_physical_memory_free_bytes");
        }
        if (mem == null || mem.isEmpty()) return null;
        return mem.values().iterator().next().longValue();
    }

    public Double getDiskReadBytesTotal(Map<String, Map<String, Double>> metrics) {
        return sumMetric(metrics, "windows_logical_disk_read_bytes_total");
    }

    public Double getDiskWriteBytesTotal(Map<String, Map<String, Double>> metrics) {
        return sumMetric(metrics, "windows_logical_disk_write_bytes_total");
    }

    public Double getNetworkRecvBytesTotal(Map<String, Map<String, Double>> metrics) {
        return sumMetric(metrics, "windows_net_bytes_received_total");
    }

    public Double getNetworkSentBytesTotal(Map<String, Map<String, Double>> metrics) {
        return sumMetric(metrics, "windows_net_bytes_sent_total");
    }

    public Double getSqlBatchRequestsTotal(Map<String, Map<String, Double>> metrics) {
        Map<String, Double> sqlMetrics = metrics.get("windows_mssql_sql_batch_requests_total");
        if (sqlMetrics == null || sqlMetrics.isEmpty()) return null;
        return sqlMetrics.values().iterator().next();
    }

    private Double sumMetric(Map<String, Map<String, Double>> metrics, String metricName) {
        Map<String, Double> metricMap = metrics.get(metricName);
        if (metricMap == null || metricMap.isEmpty()) return null;
        return metricMap.values().stream()
            .filter(v -> !v.isNaN() && !v.isInfinite())
            .mapToDouble(Double::doubleValue)
            .sum();
    }
}
