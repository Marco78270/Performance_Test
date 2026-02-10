package com.gatlingweb.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Path;

@Service
public class RecorderService {

    private static final Logger log = LoggerFactory.getLogger(RecorderService.class);

    private final Path workspacePath;

    public RecorderService(@Value("${gatling.workspace}") String workspace) {
        this.workspacePath = Path.of(workspace).toAbsolutePath().normalize();
    }

    public void launchRecorder() throws IOException {
        String mvnCmd = System.getProperty("os.name").toLowerCase().contains("win")
                ? "mvn.cmd" : "mvn";

        ProcessBuilder pb = new ProcessBuilder(mvnCmd, "gatling:recorder");
        pb.directory(workspacePath.toFile());
        pb.redirectErrorStream(true);
        pb.start(); // Fire and forget - it's a GUI process
        log.info("Gatling Recorder launched from {}", workspacePath);
    }
}
