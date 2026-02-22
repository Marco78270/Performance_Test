package com.gatlingweb.selenium.controller;

import com.gatlingweb.selenium.service.SikuliImageService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;

@RestController
@RequestMapping("/api/selenium")
public class SeleniumSikuliController {

    private final SikuliImageService sikuliImageService;

    public SeleniumSikuliController(SikuliImageService sikuliImageService) {
        this.sikuliImageService = sikuliImageService;
    }

    @GetMapping("/sikuli/images")
    public ResponseEntity<?> listSikuliImages() throws IOException {
        return ResponseEntity.ok(sikuliImageService.listImages());
    }

    @PostMapping("/sikuli/images")
    public ResponseEntity<?> uploadSikuliImage(@RequestParam("file") MultipartFile file) {
        try {
            sikuliImageService.upload(file);
            return ResponseEntity.ok(Map.of("status", "uploaded"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (IOException e) {
            return ResponseEntity.internalServerError().body(Map.of("error", "Upload failed"));
        }
    }

    @DeleteMapping("/sikuli/images")
    public ResponseEntity<?> deleteSikuliImage(@RequestParam String name) throws IOException {
        sikuliImageService.delete(name);
        return ResponseEntity.ok(Map.of("status", "deleted"));
    }

    @GetMapping("/sikuli/images/{name}")
    public ResponseEntity<byte[]> getSikuliImage(@PathVariable String name) throws IOException {
        byte[] data = sikuliImageService.getBytes(name);
        String lower = name.toLowerCase();
        MediaType mediaType = lower.endsWith(".png") ? MediaType.IMAGE_PNG : MediaType.IMAGE_JPEG;
        return ResponseEntity.ok().contentType(mediaType).body(data);
    }
}
