package com.gatlingweb.selenium.service;

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
public class SeleniumFileService {

    private static final Pattern SCRIPT_CLASS_PATTERN =
        Pattern.compile("class\\s+(\\w+)\\s+extends\\s+BaseSeleniumScript");

    private final Path scriptsRoot;

    public SeleniumFileService(@Value("${selenium.workspace:../selenium-workspace}") String workspace) {
        this.scriptsRoot = Path.of(workspace).resolve("scripts").toAbsolutePath().normalize();
    }

    public Path getScriptsRoot() {
        return scriptsRoot;
    }

    private Path resolveAndValidate(String relativePath) {
        Path resolved = scriptsRoot.resolve(relativePath).normalize();
        if (!resolved.startsWith(scriptsRoot)) {
            throw new SecurityException("Path traversal detected: " + relativePath);
        }
        return resolved;
    }

    public List<SimulationFileDto> listFiles() throws IOException {
        if (!Files.exists(scriptsRoot)) {
            Files.createDirectories(scriptsRoot);
            return List.of();
        }
        return buildTree(scriptsRoot, scriptsRoot);
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
                } else if (name.endsWith(".java")) {
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
        // Prevent deleting BaseSeleniumScript.java
        if (file.getFileName().toString().equals("BaseSeleniumScript.java")) {
            throw new IllegalArgumentException("Cannot delete BaseSeleniumScript.java");
        }
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
        if (source.getFileName().toString().equals("BaseSeleniumScript.java")) {
            throw new IllegalArgumentException("Cannot rename BaseSeleniumScript.java");
        }
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

    public List<String> listScriptClasses() throws IOException {
        List<String> classes = new ArrayList<>();
        if (!Files.exists(scriptsRoot)) return classes;

        try (Stream<Path> walk = Files.walk(scriptsRoot)) {
            walk.filter(p -> p.toString().endsWith(".java"))
                .forEach(p -> {
                    try {
                        String content = Files.readString(p);
                        Matcher m = SCRIPT_CLASS_PATTERN.matcher(content);
                        while (m.find()) {
                            classes.add(m.group(1));
                        }
                    } catch (IOException ignored) {}
                });
        }
        return classes;
    }
}
