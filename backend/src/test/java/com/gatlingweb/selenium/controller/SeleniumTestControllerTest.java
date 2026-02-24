package com.gatlingweb.selenium.controller;

import com.gatlingweb.config.SecurityConfig;
import com.gatlingweb.selenium.entity.SeleniumTestRun;
import com.gatlingweb.selenium.repository.SeleniumBrowserResultRepository;
import com.gatlingweb.selenium.repository.SeleniumTestRunRepository;
import com.gatlingweb.selenium.service.SeleniumCompilerService;
import com.gatlingweb.selenium.service.SeleniumExecutionService;
import com.gatlingweb.selenium.service.SeleniumMetricsCollector;
import com.gatlingweb.selenium.service.SeleniumPdfExportService;
import com.gatlingweb.service.MetricsPersistenceService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.PageImpl;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.httpBasic;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(SeleniumTestController.class)
@Import(SecurityConfig.class)
@ActiveProfiles("test")
class SeleniumTestControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private SeleniumExecutionService executionService;

    @MockBean
    private SeleniumCompilerService compilerService;

    @MockBean
    private SeleniumMetricsCollector metricsCollector;

    @MockBean
    private SeleniumTestRunRepository testRunRepository;

    @MockBean
    private SeleniumBrowserResultRepository resultRepository;

    @MockBean
    private MetricsPersistenceService metricsPersistenceService;

    @MockBean
    private SeleniumPdfExportService pdfExportService;

    private static final String USER = "test";
    private static final String PASS = "test";

    @Test
    void listTests_withAuth_returns200() throws Exception {
        when(testRunRepository.findAll(any(org.springframework.data.domain.Pageable.class)))
                .thenReturn(new PageImpl<>(List.of()));

        mockMvc.perform(get("/api/selenium/tests").with(httpBasic(USER, PASS)))
                .andExpect(status().isOk());
    }

    @Test
    void listTests_noAuth_returns401() throws Exception {
        mockMvc.perform(get("/api/selenium/tests"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void getTest_found_returns200() throws Exception {
        SeleniumTestRun run = new SeleniumTestRun();
        when(testRunRepository.findById(1L)).thenReturn(Optional.of(run));

        mockMvc.perform(get("/api/selenium/tests/1").with(httpBasic(USER, PASS)))
                .andExpect(status().isOk());
    }

    @Test
    void getTest_notFound_returns404() throws Exception {
        when(testRunRepository.findById(99L)).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/selenium/tests/99").with(httpBasic(USER, PASS)))
                .andExpect(status().isNotFound());
    }

    @Test
    void compile_returns200() throws Exception {
        when(compilerService.compile())
                .thenReturn(new SeleniumCompilerService.CompileResult(true, List.of("BUILD SUCCESS")));

        mockMvc.perform(post("/api/selenium/compile").with(httpBasic(USER, PASS)))
                .andExpect(status().isOk());
    }

    @Test
    void cancelTest_returns200() throws Exception {
        doNothing().when(executionService).cancel(1L);

        mockMvc.perform(post("/api/selenium/tests/1/cancel").with(httpBasic(USER, PASS)))
                .andExpect(status().isOk());
    }

    @Test
    void deleteTest_returns200() throws Exception {
        doNothing().when(metricsCollector).deleteMetrics(1L);
        doNothing().when(resultRepository).deleteByTestRunId(1L);
        doNothing().when(testRunRepository).deleteById(1L);

        mockMvc.perform(delete("/api/selenium/tests/1").with(httpBasic(USER, PASS)))
                .andExpect(status().isOk());
    }
}
