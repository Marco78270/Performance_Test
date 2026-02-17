package com.gatlingweb.controller;

import java.security.Principal;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    @Value("${app.version:}")
    private String appVersion;

    @GetMapping("/check")
    public Map<String, Object> check(Principal principal) {
        return Map.of("authenticated", true, "username", principal.getName(), "appVersion", appVersion);
    }
}
