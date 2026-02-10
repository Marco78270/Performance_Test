package com.gatlingweb.controller;

import com.gatlingweb.dto.SimulationTemplateDto;
import com.gatlingweb.service.SimulationTemplateService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/templates")
public class TemplateController {

    private final SimulationTemplateService templateService;

    public TemplateController(SimulationTemplateService templateService) {
        this.templateService = templateService;
    }

    @GetMapping
    public List<SimulationTemplateDto> list() {
        return templateService.listTemplates();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Map<String, String>> getContent(
            @PathVariable String id,
            @RequestParam(defaultValue = "MySimulation") String className,
            @RequestParam(defaultValue = "") String packageName,
            @RequestParam(defaultValue = "http://localhost:8080") String baseUrl) {
        String content = templateService.getTemplateContent(id, className, packageName, baseUrl);
        return ResponseEntity.ok(Map.of("content", content));
    }
}
