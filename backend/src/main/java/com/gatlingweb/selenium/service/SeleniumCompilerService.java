package com.gatlingweb.selenium.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

@Service
public class SeleniumCompilerService {

    private static final Logger log = LoggerFactory.getLogger(SeleniumCompilerService.class);

    private final Path workspacePath;

    public SeleniumCompilerService(@Value("${selenium.workspace:../selenium-workspace}") String workspace) {
        this.workspacePath = Path.of(workspace).toAbsolutePath().normalize();
    }

    public CompileResult compile() {
        try {
            String mvnCmd = System.getProperty("os.name").toLowerCase().contains("win")
                    ? "mvn.cmd" : "mvn";

            ProcessBuilder pb = new ProcessBuilder(
                mvnCmd, "compile", "-f", workspacePath.resolve("pom.xml").toString()
            );
            pb.directory(workspacePath.toFile());
            pb.redirectErrorStream(true);

            Process process = pb.start();
            List<String> output = new ArrayList<>();

            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    output.add(line);
                }
            }

            boolean finished = process.waitFor(120, TimeUnit.SECONDS);
            if (!finished) {
                process.destroyForcibly();
                return new CompileResult(false, List.of("Compilation timed out after 120 seconds"));
            }

            int exitCode = process.exitValue();
            if (exitCode == 0) {
                log.info("Selenium scripts compiled successfully");
                return new CompileResult(true, output);
            } else {
                // Extract error lines
                List<String> errors = output.stream()
                    .filter(l -> l.contains("[ERROR]") || l.contains("error:"))
                    .toList();
                if (errors.isEmpty()) errors = output;
                log.warn("Selenium compilation failed with exit code {}", exitCode);
                return new CompileResult(false, errors);
            }

        } catch (Exception e) {
            log.error("Compilation error", e);
            return new CompileResult(false, List.of("Compilation error: " + e.getMessage()));
        }
    }

    public Path getClassesDir() {
        return workspacePath.resolve("target/classes");
    }

    public record CompileResult(boolean success, List<String> output) {}
}
