package com.gatlingweb.controller;

import com.gatlingweb.dto.CreateServerRequest;
import com.gatlingweb.dto.MonitoredServerDto;
import com.gatlingweb.service.MonitoredServerService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/servers")
public class MonitoredServerController {

    private final MonitoredServerService service;

    public MonitoredServerController(MonitoredServerService service) {
        this.service = service;
    }

    @GetMapping
    public List<MonitoredServerDto> getAll() {
        return service.findAll();
    }

    @GetMapping("/{id}")
    public MonitoredServerDto getById(@PathVariable Long id) {
        return service.findById(id);
    }

    @PostMapping
    public MonitoredServerDto create(@Valid @RequestBody CreateServerRequest request) {
        return service.create(request);
    }

    @PutMapping("/{id}")
    public MonitoredServerDto update(@PathVariable Long id, @Valid @RequestBody CreateServerRequest request) {
        return service.update(id, request);
    }

    @PostMapping("/{id}/toggle")
    public MonitoredServerDto toggle(@PathVariable Long id) {
        return service.toggleEnabled(id);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
