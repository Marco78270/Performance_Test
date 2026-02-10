package com.gatlingweb.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.*;
import java.util.*;
import java.util.stream.Stream;

@Service
public class ReportService {

    private final Path gatlingResultsDir;

    public ReportService(@Value("${gatling.workspace}") String workspace) {
        this.gatlingResultsDir = Path.of(workspace).resolve("target/gatling").toAbsolutePath().normalize();
    }

    public List<String> listReports() throws IOException {
        if (!Files.exists(gatlingResultsDir)) return List.of();
        try (Stream<Path> dirs = Files.list(gatlingResultsDir)) {
            return dirs.filter(Files::isDirectory)
                .filter(d -> Files.exists(d.resolve("index.html")))
                .map(d -> d.getFileName().toString())
                .sorted(Comparator.reverseOrder())
                .toList();
        }
    }
}
