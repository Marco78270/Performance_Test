package com.gatlingweb.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Path;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Value("${gatling.workspace}")
    private String workspace;

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        Path reportsPath = Path.of(workspace).resolve("target/gatling").toAbsolutePath();
        registry.addResourceHandler("/reports/**")
                .addResourceLocations("file:" + reportsPath + "/");
    }
}
