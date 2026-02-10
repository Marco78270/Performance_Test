package com.gatlingweb.controller;

import com.gatlingweb.service.RecorderService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.util.Map;

@RestController
@RequestMapping("/api/recorder")
public class RecorderController {

    private final RecorderService recorderService;

    public RecorderController(RecorderService recorderService) {
        this.recorderService = recorderService;
    }

    @PostMapping("/launch")
    public ResponseEntity<?> launch() {
        try {
            recorderService.launchRecorder();
            return ResponseEntity.ok(Map.of("status", "launched"));
        } catch (IOException e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }
}
