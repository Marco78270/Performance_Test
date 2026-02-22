package com.gatlingweb.selenium.controller;

import com.gatlingweb.selenium.entity.AppSetting;
import com.gatlingweb.selenium.repository.AppSettingRepository;
import com.gatlingweb.selenium.service.SeleniumGridService;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/selenium")
public class SeleniumConfigController {

    private final SeleniumGridService gridService;
    private final AppSettingRepository appSettingRepository;

    public SeleniumConfigController(SeleniumGridService gridService, AppSettingRepository appSettingRepository) {
        this.gridService = gridService;
        this.appSettingRepository = appSettingRepository;
    }

    @GetMapping("/grid/status")
    public ResponseEntity<?> gridStatus() {
        return ResponseEntity.ok(Map.of(
            "status", gridService.getStatus(),
            "url", gridService.getGridUrl()
        ));
    }

    @GetMapping("/config/drivers")
    public ResponseEntity<?> getDriverConfig() {
        String chrome = appSettingRepository.findById("driver.chrome.path").map(AppSetting::getValue).orElse("");
        String firefox = appSettingRepository.findById("driver.firefox.path").map(AppSetting::getValue).orElse("");
        String edge = appSettingRepository.findById("driver.edge.path").map(AppSetting::getValue).orElse("");
        return ResponseEntity.ok(Map.of("chrome", chrome, "firefox", firefox, "edge", edge));
    }

    @PutMapping("/config/drivers")
    @Transactional
    public ResponseEntity<?> saveDriverConfig(@RequestBody Map<String, String> body) {
        String chrome = body.getOrDefault("chrome", "").trim();
        String firefox = body.getOrDefault("firefox", "").trim();
        String edge = body.getOrDefault("edge", "").trim();

        List<String> warnings = new ArrayList<>();
        if (!chrome.isBlank() && !new java.io.File(chrome).isFile()) {
            warnings.add("Chrome driver not found: " + chrome);
        }
        if (!firefox.isBlank() && !new java.io.File(firefox).isFile()) {
            warnings.add("Firefox driver not found: " + firefox);
        }
        if (!edge.isBlank() && !new java.io.File(edge).isFile()) {
            warnings.add("Edge driver not found: " + edge);
        }

        appSettingRepository.save(new AppSetting("driver.chrome.path", chrome));
        appSettingRepository.save(new AppSetting("driver.firefox.path", firefox));
        appSettingRepository.save(new AppSetting("driver.edge.path", edge));
        gridService.invalidateDriverCache();

        if (!warnings.isEmpty()) {
            return ResponseEntity.ok(Map.of("status", "saved", "warnings", warnings));
        }
        return ResponseEntity.ok(Map.of("status", "saved"));
    }
}
