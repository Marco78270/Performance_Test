package com.gatlingweb.selenium.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.gatlingweb.dto.SimulationTemplateDto;
import jakarta.annotation.PostConstruct;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;

@Service
public class SeleniumTemplateService {

    private final ObjectMapper objectMapper;
    private List<TemplateEntry> templates;

    public SeleniumTemplateService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @PostConstruct
    void loadManifest() throws IOException {
        try (InputStream is = new ClassPathResource("templates/selenium/manifest.json").getInputStream()) {
            templates = objectMapper.readValue(is, new TypeReference<>() {});
        }
    }

    public List<SimulationTemplateDto> listTemplates() {
        return templates.stream()
            .map(t -> new SimulationTemplateDto(t.id, t.name, t.description))
            .toList();
    }

    public String getTemplateContent(String templateId, String className, String baseUrl) {
        TemplateEntry entry = templates.stream()
            .filter(t -> t.id.equals(templateId))
            .findFirst()
            .orElseThrow(() -> new IllegalArgumentException("Unknown template: " + templateId));

        try (InputStream is = new ClassPathResource("templates/selenium/" + entry.fileName).getInputStream()) {
            String content = new String(is.readAllBytes(), StandardCharsets.UTF_8);
            content = content.replace("__CLASS_NAME__", className);
            content = content.replace("__BASE_URL__", baseUrl);
            return content;
        } catch (IOException e) {
            throw new RuntimeException("Failed to read template: " + entry.fileName, e);
        }
    }

    private record TemplateEntry(String id, String name, String description, String fileName) {}
}
