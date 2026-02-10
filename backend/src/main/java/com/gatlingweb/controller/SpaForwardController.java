package com.gatlingweb.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class SpaForwardController {

    @GetMapping(value = {"/", "/editor", "/history", "/test/{id}", "/recorder", "/servers", "/compare", "/thresholds", "/trends"})
    public String forward() {
        return "forward:/index.html";
    }
}
