package com.gatlingweb.controller;

import java.security.Principal;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.info.BuildProperties;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    @Autowired(required = false)
    private BuildProperties buildProperties;

    @GetMapping("/check")
    public Map<String, Object> check(Principal principal) {
        String version = buildProperties != null ? buildProperties.getVersion() : "dev";
        return Map.of("authenticated", true, "username", principal.getName(), "appVersion", version);
    }
}
