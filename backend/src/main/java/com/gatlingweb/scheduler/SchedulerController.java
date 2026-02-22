package com.gatlingweb.scheduler;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/scheduler")
public class SchedulerController {

    private final SchedulerService schedulerService;

    public SchedulerController(SchedulerService schedulerService) {
        this.schedulerService = schedulerService;
    }

    @GetMapping
    public List<ScheduledTest> list() {
        return schedulerService.findAll();
    }

    @PostMapping
    public ResponseEntity<ScheduledTest> create(@RequestBody ScheduledTest job) {
        return ResponseEntity.ok(schedulerService.create(job));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> cancel(@PathVariable Long id) {
        boolean cancelled = schedulerService.cancel(id);
        if (cancelled) {
            return ResponseEntity.ok(Map.of("status", "cancelled"));
        }
        return ResponseEntity.badRequest().body(Map.of("error", "Job not found or not in PENDING status"));
    }
}
