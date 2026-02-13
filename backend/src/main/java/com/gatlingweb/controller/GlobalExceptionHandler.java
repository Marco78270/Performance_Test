package com.gatlingweb.controller;

import jakarta.persistence.EntityNotFoundException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.stream.Collectors;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(NoResourceFoundException.class)
    public void handleNoResource(NoResourceFoundException e,
                                 HttpServletRequest request,
                                 HttpServletResponse response) throws Exception {
        String path = request.getRequestURI();

        // Silently ignore favicon requests
        if (path.endsWith("/favicon.ico")) {
            response.setStatus(204);
            return;
        }

        // Forward to SPA for browser navigation (HTML requests to non-API paths)
        String accept = request.getHeader("Accept");
        if (accept != null && accept.contains("text/html")
                && !path.startsWith("/api/")
                && !path.startsWith("/ws")
                && !path.startsWith("/reports/")) {
            request.getRequestDispatcher("/index.html").forward(request, response);
            return;
        }

        response.setStatus(404);
        response.setContentType("application/json");
        response.getWriter().write("{\"code\":\"NOT_FOUND\",\"error\":\"Resource not found\"}");
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<Map<String, Object>> handleIllegalState(IllegalStateException e) {
        String code = "CONFLICT";
        String msg = e.getMessage();
        if (msg != null && msg.contains("queue is full")) code = "QUEUE_FULL";
        else if (msg != null && msg.contains("already running")) code = "TEST_ALREADY_RUNNING";
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(errorBody(code, msg));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, Object>> handleIllegalArgument(IllegalArgumentException e) {
        return ResponseEntity.badRequest()
                .body(errorBody("BAD_REQUEST", e.getMessage()));
    }

    @ExceptionHandler(EntityNotFoundException.class)
    public ResponseEntity<Map<String, Object>> handleNotFound(EntityNotFoundException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(errorBody("NOT_FOUND", e.getMessage()));
    }

    @ExceptionHandler(SecurityException.class)
    public ResponseEntity<Map<String, Object>> handleSecurity(SecurityException e) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(errorBody("FORBIDDEN", e.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException e) {
        var fields = e.getBindingResult().getFieldErrors().stream()
                .collect(Collectors.toMap(
                        f -> f.getField(),
                        f -> f.getDefaultMessage() != null ? f.getDefaultMessage() : "invalid",
                        (a, b) -> a
                ));
        Map<String, Object> body = errorBody("VALIDATION_FAILED", "Validation failed");
        body.put("fields", fields);
        return ResponseEntity.badRequest().body(body);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleGeneric(Exception e) {
        log.error("Unhandled exception", e);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(errorBody("INTERNAL_ERROR", "Internal server error"));
    }

    private Map<String, Object> errorBody(String code, String message) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("code", code);
        body.put("error", message != null ? message : "Unknown error");
        return body;
    }
}
