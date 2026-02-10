package com.gatlingweb.controller;

import com.gatlingweb.dto.CreateThresholdProfileRequest;
import com.gatlingweb.dto.ThresholdProfileDto;
import com.gatlingweb.service.ThresholdService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/thresholds")
public class ThresholdController {

    private final ThresholdService thresholdService;

    public ThresholdController(ThresholdService thresholdService) {
        this.thresholdService = thresholdService;
    }

    @GetMapping
    public List<ThresholdProfileDto> list() {
        return thresholdService.findAll();
    }

    @GetMapping("/{id}")
    public ThresholdProfileDto get(@PathVariable Long id) {
        return thresholdService.findById(id);
    }

    @PostMapping
    public ThresholdProfileDto create(@Valid @RequestBody CreateThresholdProfileRequest request) {
        return thresholdService.create(request);
    }

    @PutMapping("/{id}")
    public ThresholdProfileDto update(@PathVariable Long id, @Valid @RequestBody CreateThresholdProfileRequest request) {
        return thresholdService.update(id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        thresholdService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
