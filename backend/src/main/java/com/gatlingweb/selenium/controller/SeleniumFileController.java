package com.gatlingweb.selenium.controller;

import com.gatlingweb.dto.SimulationFileDto;
import com.gatlingweb.dto.SimulationTemplateDto;
import com.gatlingweb.selenium.service.SeleniumFileService;
import com.gatlingweb.selenium.service.SeleniumTemplateService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/selenium")
public class SeleniumFileController {

    private final SeleniumFileService fileService;
    private final SeleniumTemplateService templateService;

    public SeleniumFileController(SeleniumFileService fileService, SeleniumTemplateService templateService) {
        this.fileService = fileService;
        this.templateService = templateService;
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

    @PostMapping("/files/rename")
    public ResponseEntity<?> renameFile(@RequestBody Map<String, String> body) throws IOException {
        fileService.renameFile(body.get("oldPath"), body.get("newPath"));
        return ResponseEntity.ok(Map.of("status", "renamed"));
    }

    @PostMapping("/directories")
    public ResponseEntity<?> createDirectory(@RequestBody Map<String, String> body) throws IOException {
        fileService.createDirectory(body.get("path"));
        return ResponseEntity.ok(Map.of("status", "created"));
    }

    @GetMapping("/classes")
    public List<String> listClasses() throws IOException {
        return fileService.listScriptClasses();
    }

    @GetMapping("/templates")
    public List<SimulationTemplateDto> listTemplates() {
        return templateService.listTemplates();
    }

    @GetMapping("/templates/content")
    public ResponseEntity<Map<String, String>> getTemplateContent(
            @RequestParam String id,
            @RequestParam(defaultValue = "MySeleniumScript") String className,
            @RequestParam(defaultValue = "http://localhost:8080") String baseUrl) {
        String content = templateService.getTemplateContent(id, className, baseUrl);
        return ResponseEntity.ok(Map.of("content", content));
    }
}
