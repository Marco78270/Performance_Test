package com.gatlingweb.service;

import com.gatlingweb.dto.SimulationFileDto;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.*;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

@Service
public class SimulationFileService {

    private static final Pattern SIMULATION_CLASS_PATTERN =
        Pattern.compile("class\\s+(\\w+)\\s+extends\\s+Simulation");

    private final Path simulationsRoot;

    public SimulationFileService(@Value("${gatling.workspace}") String workspace) {
        this.simulationsRoot = Path.of(workspace).resolve("simulations").toAbsolutePath().normalize();
    }

    public Path getSimulationsRoot() {
        return simulationsRoot;
    }

    private Path resolveAndValidate(String relativePath) {
        Path resolved = simulationsRoot.resolve(relativePath).normalize();
        if (!resolved.startsWith(simulationsRoot)) {
            throw new SecurityException("Path traversal detected: " + relativePath);
        }
        return resolved;
    }

    public List<SimulationFileDto> listFiles() throws IOException {
        if (!Files.exists(simulationsRoot)) {
            Files.createDirectories(simulationsRoot);
            return List.of();
        }
        return buildTree(simulationsRoot, simulationsRoot);
    }

    private List<SimulationFileDto> buildTree(Path dir, Path root) throws IOException {
        List<SimulationFileDto> result = new ArrayList<>();
        try (DirectoryStream<Path> stream = Files.newDirectoryStream(dir)) {
            for (Path entry : stream) {
                String relativePath = root.relativize(entry).toString().replace('\\', '/');
                String name = entry.getFileName().toString();
                if (Files.isDirectory(entry)) {
                    List<SimulationFileDto> children = buildTree(entry, root);
                    result.add(new SimulationFileDto(relativePath, name, true, children));
                } else if (name.endsWith(".scala")) {
                    result.add(new SimulationFileDto(relativePath, name, false, null));
                }
            }
        }
        result.sort(Comparator.comparing(SimulationFileDto::directory).reversed()
                .thenComparing(SimulationFileDto::name));
        return result;
    }

    public String readFile(String relativePath) throws IOException {
        Path file = resolveAndValidate(relativePath);
        return Files.readString(file);
    }

    public void writeFile(String relativePath, String content) throws IOException {
        Path file = resolveAndValidate(relativePath);
        Files.createDirectories(file.getParent());
        Files.writeString(file, content);
    }

    public void createFile(String relativePath, String content) throws IOException {
        Path file = resolveAndValidate(relativePath);
        if (Files.exists(file)) {
            throw new IllegalArgumentException("File already exists: " + relativePath);
        }
        Files.createDirectories(file.getParent());
        Files.writeString(file, content != null ? content : "");
    }

    public void deleteFile(String relativePath) throws IOException {
        Path file = resolveAndValidate(relativePath);
        if (Files.isDirectory(file)) {
            try (Stream<Path> walk = Files.walk(file)) {
                walk.sorted(Comparator.reverseOrder()).forEach(p -> {
                    try { Files.delete(p); } catch (IOException e) { throw new RuntimeException(e); }
                });
            }
        } else {
            Files.deleteIfExists(file);
        }
    }

    public void renameFile(String oldPath, String newPath) throws IOException {
        Path source = resolveAndValidate(oldPath);
        Path target = resolveAndValidate(newPath);
        if (!Files.exists(source)) {
            throw new IllegalArgumentException("Source file does not exist: " + oldPath);
        }
        if (Files.exists(target)) {
            throw new IllegalArgumentException("Target file already exists: " + newPath);
        }
        Files.createDirectories(target.getParent());
        Files.move(source, target);
    }

    public void createDirectory(String relativePath) throws IOException {
        Path dir = resolveAndValidate(relativePath);
        if (Files.exists(dir)) {
            throw new IllegalArgumentException("Path already exists: " + relativePath);
        }
        Files.createDirectories(dir);
    }

    public List<String> listSimulationClasses() throws IOException {
        List<String> classes = new ArrayList<>();
        if (!Files.exists(simulationsRoot)) return classes;

        try (Stream<Path> walk = Files.walk(simulationsRoot)) {
            walk.filter(p -> p.toString().endsWith(".scala"))
                .forEach(p -> {
                    try {
                        String content = Files.readString(p);
                        // Extract package
                        String pkg = "";
                        var pkgMatcher = Pattern.compile("package\\s+([\\w.]+)").matcher(content);
                        if (pkgMatcher.find()) {
                            pkg = pkgMatcher.group(1) + ".";
                        }
                        Matcher m = SIMULATION_CLASS_PATTERN.matcher(content);
                        while (m.find()) {
                            classes.add(pkg + m.group(1));
                        }
                    } catch (IOException ignored) {}
                });
        }
        return classes;
    }
}
