package com.gatlingweb.service;

import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.TimeUnit;

@Service
public class BandwidthLimiterService {

    private static final Logger log = LoggerFactory.getLogger(BandwidthLimiterService.class);

    private final boolean isWindows;
    private volatile boolean limitApplied = false;

    public BandwidthLimiterService() {
        this.isWindows = System.getProperty("os.name").toLowerCase().contains("win");
        cleanupStaleLimit();
    }

    /**
     * On startup, remove any stale bandwidth limit left by a previous crashed session.
     */
    private void cleanupStaleLimit() {
        try {
            if (isWindows) {
                // Check if a GatlingBandwidthLimit policy exists and remove it
                String[] checkCmd = {"powershell", "-Command",
                    "if (Get-NetQosPolicy -Name 'GatlingBandwidthLimit' -PolicyStore ActiveStore -ErrorAction SilentlyContinue) { " +
                    "Remove-NetQosPolicy -Name 'GatlingBandwidthLimit' -PolicyStore ActiveStore -Confirm:$false -ErrorAction Stop; " +
                    "'REMOVED' } else { 'NONE' }"
                };
                ProcessBuilder pb = new ProcessBuilder(checkCmd);
                pb.redirectErrorStream(true);
                Process p = pb.start();
                String output = new String(p.getInputStream().readAllBytes()).trim();
                p.waitFor(10, TimeUnit.SECONDS);
                if (output.contains("REMOVED")) {
                    log.warn("Removed stale bandwidth limit from previous session");
                }
            } else {
                // On Linux, check if a tbf qdisc exists on the default interface
                String iface = detectLinuxInterface();
                String[] cmd = {"sudo", "tc", "qdisc", "del", "dev", iface, "root"};
                ProcessBuilder pb = new ProcessBuilder(cmd);
                pb.redirectErrorStream(true);
                Process p = pb.start();
                p.waitFor(5, TimeUnit.SECONDS);
                // Ignore errors - there might not be a qdisc to remove
            }
        } catch (Exception e) {
            log.debug("Startup bandwidth cleanup (non-critical): {}", e.getMessage());
        }
    }

    public void applyLimit(int mbps) {
        if (limitApplied) {
            log.warn("Bandwidth limit already applied, removing first");
            removeLimit();
        }

        try {
            if (isWindows) {
                applyWindowsLimit(mbps);
            } else {
                applyLinuxLimit(mbps);
            }
            limitApplied = true;
            log.info("Bandwidth limit applied: {} Mbps", mbps);
        } catch (Exception e) {
            log.error("Failed to apply bandwidth limit of {} Mbps", mbps, e);
            throw new RuntimeException("Failed to apply bandwidth limit: " + e.getMessage(), e);
        }
    }

    public void removeLimit() {
        if (!limitApplied) {
            return;
        }

        try {
            if (isWindows) {
                removeWindowsLimit();
            } else {
                removeLinuxLimit();
            }
            log.info("Bandwidth limit removed");
        } catch (Exception e) {
            log.error("Failed to remove bandwidth limit", e);
        } finally {
            limitApplied = false;
        }
    }

    private void applyWindowsLimit(int mbps) throws Exception {
        long bitsPerSecond = (long) mbps * 1_000_000L;
        executeElevatedPowershell(
            "New-NetQosPolicy -Name 'GatlingBandwidthLimit' " +
            "-ThrottleRateActionBitsPerSecond " + bitsPerSecond +
            " -PolicyStore ActiveStore -ErrorAction Stop"
        );
    }

    private void removeWindowsLimit() throws Exception {
        // Try direct removal first (works if app runs elevated or policy was created in ActiveStore)
        try {
            String[] cmd = {"powershell", "-Command",
                "Remove-NetQosPolicy -Name 'GatlingBandwidthLimit' -PolicyStore ActiveStore -Confirm:$false -ErrorAction Stop"
            };
            executeCommand(cmd);
            return;
        } catch (Exception e) {
            log.debug("Direct removal failed, trying elevated: {}", e.getMessage());
        }
        // Fall back to elevated removal
        executeElevatedPowershell(
            "Remove-NetQosPolicy -Name 'GatlingBandwidthLimit' " +
            "-PolicyStore ActiveStore -Confirm:$false -ErrorAction Stop"
        );
    }

    /**
     * Executes a PowerShell command with UAC elevation (Start-Process -Verb RunAs).
     * Writes the command to a temp .ps1 script, runs it elevated, and checks a result file.
     */
    private void executeElevatedPowershell(String psCommand) throws Exception {
        Path scriptFile = Files.createTempFile("gatling-bw-", ".ps1");
        Path resultFile = Files.createTempFile("gatling-bw-result-", ".txt");

        try {
            // Script: run command, write SUCCESS or error to result file
            String script = String.join("\r\n",
                "try {",
                "    " + psCommand,
                "    'SUCCESS' | Out-File -FilePath '" + resultFile.toString().replace("'", "''") + "' -Encoding UTF8",
                "} catch {",
                "    $_.Exception.Message | Out-File -FilePath '" + resultFile.toString().replace("'", "''") + "' -Encoding UTF8",
                "    exit 1",
                "}"
            );
            Files.writeString(scriptFile, script);

            // Launch elevated PowerShell with -Verb RunAs
            String[] cmd = {"powershell", "-Command",
                "Start-Process powershell -Verb RunAs -Wait -ArgumentList " +
                "'-ExecutionPolicy Bypass -File \"" + scriptFile.toString() + "\"'"
            };

            log.info("Executing elevated: {}", psCommand);
            ProcessBuilder pb = new ProcessBuilder(cmd);
            pb.redirectErrorStream(true);
            Process process = pb.start();

            // Read any output from the launcher process
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    log.debug("[bandwidth-limiter] {}", line);
                }
            }

            boolean exited = process.waitFor(30, TimeUnit.SECONDS);
            if (!exited) {
                process.destroyForcibly();
                throw new RuntimeException("Elevated command timed out");
            }

            // Check result file
            if (Files.exists(resultFile)) {
                String result = Files.readString(resultFile).trim();
                if (!"SUCCESS".equals(result)) {
                    throw new RuntimeException("Elevated command failed: " + result);
                }
            } else {
                // If no result file, the UAC prompt may have been denied
                throw new RuntimeException("Elevated command produced no result (UAC denied?)");
            }
        } finally {
            Files.deleteIfExists(scriptFile);
            Files.deleteIfExists(resultFile);
        }
    }

    private void applyLinuxLimit(int mbps) throws Exception {
        String iface = detectLinuxInterface();
        String[] cmd = {"sudo", "tc", "qdisc", "replace", "dev", iface, "root", "tbf",
            "rate", mbps + "mbit", "burst", "32kbit", "latency", "400ms"
        };
        executeCommand(cmd);
    }

    private void removeLinuxLimit() throws Exception {
        String iface = detectLinuxInterface();
        String[] cmd = {"sudo", "tc", "qdisc", "del", "dev", iface, "root"};
        executeCommand(cmd);
    }

    private String detectLinuxInterface() throws Exception {
        ProcessBuilder pb = new ProcessBuilder("ip", "route", "show", "default");
        pb.redirectErrorStream(true);
        Process p = pb.start();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(p.getInputStream()))) {
            String line = reader.readLine();
            if (line != null) {
                String[] parts = line.split("\\s+");
                for (int i = 0; i < parts.length - 1; i++) {
                    if ("dev".equals(parts[i])) {
                        return parts[i + 1];
                    }
                }
            }
        }
        p.waitFor(5, TimeUnit.SECONDS);
        return "eth0";
    }

    private void executeCommand(String[] cmd) throws Exception {
        log.info("Executing: {}", String.join(" ", cmd));
        ProcessBuilder pb = new ProcessBuilder(cmd);
        pb.redirectErrorStream(true);
        Process process = pb.start();

        StringBuilder output = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
            String line;
            while ((line = reader.readLine()) != null) {
                output.append(line).append("\n");
                log.debug("[bandwidth-limiter] {}", line);
            }
        }

        boolean exited = process.waitFor(10, TimeUnit.SECONDS);
        if (!exited) {
            process.destroyForcibly();
            throw new RuntimeException("Command timed out");
        }

        int exitCode = process.exitValue();
        if (exitCode != 0) {
            log.warn("Command exited with code {}: {}", exitCode, output.toString().trim());
            throw new RuntimeException("Command failed with exit code " + exitCode + ": " + output.toString().trim());
        }
    }

    /**
     * Force remove regardless of limitApplied flag (for shutdown safety).
     */
    private void forceRemoveLimit() {
        try {
            if (isWindows) {
                removeWindowsLimit();
            } else {
                removeLinuxLimit();
            }
            log.info("Bandwidth limit force-removed");
        } catch (Exception e) {
            log.debug("Force remove (non-critical): {}", e.getMessage());
        } finally {
            limitApplied = false;
        }
    }

    @PreDestroy
    void shutdown() {
        log.info("BandwidthLimiterService shutting down...");
        forceRemoveLimit();
        log.info("BandwidthLimiterService shutdown complete");
    }

}
