package com.gatlingweb.selenium.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Stream;

@Service
public class SikuliImageService {

    private static final Set<String> ALLOWED_EXTENSIONS = Set.of("png", "jpg", "jpeg");
    private static final long MAX_SIZE = 5 * 1024 * 1024; // 5MB

    private final Path imagesDir;

    public SikuliImageService(@Value("${selenium.workspace:../selenium-workspace}") String workspace) {
        this.imagesDir = Path.of(workspace).toAbsolutePath().normalize().resolve("sikuli-images");
    }

    public Path getImagesDir() {
        return imagesDir;
    }

    public List<Map<String, Object>> listImages() throws IOException {
        ensureDir();
        try (Stream<Path> stream = Files.list(imagesDir)) {
            return stream
                .filter(Files::isRegularFile)
                .filter(p -> isAllowedExtension(p.getFileName().toString()))
                .map(p -> {
                    try {
                        return Map.<String, Object>of(
                            "name", p.getFileName().toString(),
                            "size", Files.size(p),
                            "lastModified", Files.getLastModifiedTime(p).toMillis()
                        );
                    } catch (IOException e) {
                        return Map.<String, Object>of("name", p.getFileName().toString(), "size", 0L, "lastModified", 0L);
                    }
                })
                .toList();
        }
    }

    public void upload(MultipartFile file) throws IOException {
        String name = file.getOriginalFilename();
        if (name == null || name.isBlank()) throw new IllegalArgumentException("Missing file name");

        // Path traversal protection
        if (name.contains("..") || name.contains("/") || name.contains("\\")) {
            throw new IllegalArgumentException("Invalid file name");
        }

        if (!isAllowedExtension(name)) {
            throw new IllegalArgumentException("Only PNG/JPG files are allowed");
        }

        if (file.getSize() > MAX_SIZE) {
            throw new IllegalArgumentException("File exceeds 5MB limit");
        }

        ensureDir();
        Path target = imagesDir.resolve(name).normalize();
        if (!target.startsWith(imagesDir)) {
            throw new IllegalArgumentException("Invalid file path");
        }
        file.transferTo(target);
    }

    public void delete(String name) throws IOException {
        validateName(name);
        Path target = imagesDir.resolve(name).normalize();
        if (!target.startsWith(imagesDir)) throw new IllegalArgumentException("Invalid file path");
        Files.deleteIfExists(target);
    }

    public byte[] getBytes(String name) throws IOException {
        validateName(name);
        Path target = imagesDir.resolve(name).normalize();
        if (!target.startsWith(imagesDir)) throw new IllegalArgumentException("Invalid file path");
        if (!Files.exists(target)) throw new IllegalArgumentException("Image not found: " + name);
        return Files.readAllBytes(target);
    }

    private void ensureDir() throws IOException {
        if (!Files.exists(imagesDir)) {
            Files.createDirectories(imagesDir);
        }
    }

    private void validateName(String name) {
        if (name == null || name.isBlank() || name.contains("..") || name.contains("/") || name.contains("\\")) {
            throw new IllegalArgumentException("Invalid file name");
        }
    }

    private boolean isAllowedExtension(String name) {
        int dot = name.lastIndexOf('.');
        if (dot < 0) return false;
        return ALLOWED_EXTENSIONS.contains(name.substring(dot + 1).toLowerCase());
    }
}
