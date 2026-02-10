package com.gatlingweb.controller;

import com.gatlingweb.dto.SimulationFileDto;
import com.gatlingweb.service.SimulationFileService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/simulations")
public class SimulationController {

    private final SimulationFileService fileService;

    public SimulationController(SimulationFileService fileService) {
        this.fileService = fileService;
    }

    @GetMapping("/files")
    public ResponseEntity<?> getFiles(@RequestParam(required = false) String path) throws IOException {
        if (path != null) {
            String content = fileService.readFile(path);
            return ResponseEntity.ok(Map.of("path", path, "content", content));
        }
        List<SimulationFileDto> tree = fileService.listFiles();
        return ResponseEntity.ok(tree);
    }

    @PutMapping("/files")
    public ResponseEntity<?> updateFile(@RequestParam String path, @RequestBody Map<String, String> body) throws IOException {
        fileService.writeFile(path, body.get("content"));
        return ResponseEntity.ok(Map.of("status", "saved"));
    }

    @PostMapping("/files")
    public ResponseEntity<?> createFile(@RequestBody Map<String, String> body) throws IOException {
        String path = body.get("path");
        String content = body.getOrDefault("content", "");
        fileService.createFile(path, content);
        return ResponseEntity.ok(Map.of("status", "created"));
    }

    @DeleteMapping("/files")
    public ResponseEntity<?> deleteFile(@RequestParam String path) throws IOException {
        fileService.deleteFile(path);
        return ResponseEntity.ok(Map.of("status", "deleted"));
    }

    @GetMapping("/classes")
    public List<String> listClasses() throws IOException {
        return fileService.listSimulationClasses();
    }

    @PostMapping("/files/rename")
    public ResponseEntity<?> renameFile(@RequestBody Map<String, String> body) throws IOException {
        String oldPath = body.get("oldPath");
        String newPath = body.get("newPath");
        fileService.renameFile(oldPath, newPath);
        return ResponseEntity.ok(Map.of("status", "renamed"));
    }

    @PostMapping("/directories")
    public ResponseEntity<?> createDirectory(@RequestBody Map<String, String> body) throws IOException {
        String path = body.get("path");
        fileService.createDirectory(path);
        return ResponseEntity.ok(Map.of("status", "created"));
    }
}
