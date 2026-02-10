package com.gatlingweb.controller;

import java.security.Principal;
import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    @GetMapping("/check")
    public Map<String, Object> check(Principal principal) {
        return Map.of("authenticated", true, "username", principal.getName());
    }
}
