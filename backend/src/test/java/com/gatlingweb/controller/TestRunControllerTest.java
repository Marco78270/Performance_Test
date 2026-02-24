package com.gatlingweb.controller;

import com.gatlingweb.config.SecurityConfig;
import com.gatlingweb.dto.LaunchRequest;
import com.gatlingweb.dto.TestRunDto;
import com.gatlingweb.entity.TestStatus;
import com.gatlingweb.service.MetricsPersistenceService;
import com.gatlingweb.service.PdfExportService;
import com.gatlingweb.service.TestRunService;
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
import java.util.Map;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.httpBasic;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(TestRunController.class)
@Import(SecurityConfig.class)
@ActiveProfiles("test")
class TestRunControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private TestRunService testRunService;

    @MockBean
    private MetricsPersistenceService metricsPersistenceService;

    @MockBean
    private PdfExportService pdfExportService;

    private static final String USER = "test";
    private static final String PASS = "test";

    private TestRunDto minimalDto() {
        return new TestRunDto(1L, "sim.BasicSimulation", null, TestStatus.COMPLETED,
                null, null, null, 0L, 0L, null, null, null, null, null,
                List.of(), null, null, null, null, null, null);
    }

    @Test
    void list_withAuth_returns200() throws Exception {
        when(testRunService.findAll(any())).thenReturn(new PageImpl<>(List.of()));

        mockMvc.perform(get("/api/tests").with(httpBasic(USER, PASS)))
                .andExpect(status().isOk());
    }

    @Test
    void list_noAuth_returns401() throws Exception {
        mockMvc.perform(get("/api/tests"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void get_found_returns200() throws Exception {
        when(testRunService.findById(1L)).thenReturn(Optional.of(minimalDto()));

        mockMvc.perform(get("/api/tests/1").with(httpBasic(USER, PASS)))
                .andExpect(status().isOk());
    }

    @Test
    void get_notFound_returns404() throws Exception {
        when(testRunService.findById(99L)).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/tests/99").with(httpBasic(USER, PASS)))
                .andExpect(status().isNotFound());
    }

    @Test
    void launch_returns200() throws Exception {
        when(testRunService.launch(any())).thenReturn(minimalDto());

        mockMvc.perform(post("/api/tests/launch")
                        .with(httpBasic(USER, PASS))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"simulationClass\":\"sim.BasicSimulation\"}"))
                .andExpect(status().isOk());
    }

    @Test
    void cancel_returns200() throws Exception {
        doNothing().when(testRunService).cancel(1L);

        mockMvc.perform(post("/api/tests/1/cancel").with(httpBasic(USER, PASS)))
                .andExpect(status().isOk());
    }

    @Test
    void delete_returns200() throws Exception {
        doNothing().when(testRunService).delete(1L);

        mockMvc.perform(delete("/api/tests/1").with(httpBasic(USER, PASS)))
                .andExpect(status().isOk());
    }

    @Test
    void getRunning_noRunning_returns404() throws Exception {
        when(testRunService.findRunning()).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/tests/running").with(httpBasic(USER, PASS)))
                .andExpect(status().isNotFound());
    }

    @Test
    void getAllLabels_returns200() throws Exception {
        when(testRunService.getAllLabels()).thenReturn(List.of("smoke", "load"));

        mockMvc.perform(get("/api/tests/labels").with(httpBasic(USER, PASS)))
                .andExpect(status().isOk());
    }

    @Test
    void getSummary_returns200() throws Exception {
        when(testRunService.getSummary()).thenReturn(Map.of("total", 0));

        mockMvc.perform(get("/api/tests/summary").with(httpBasic(USER, PASS)))
                .andExpect(status().isOk());
    }
}
