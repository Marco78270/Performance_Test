package com.gatlingweb.controller;

import com.gatlingweb.config.SecurityConfig;
import com.gatlingweb.dto.ThresholdProfileDto;
import com.gatlingweb.service.ThresholdService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.httpBasic;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(ThresholdController.class)
@Import(SecurityConfig.class)
@ActiveProfiles("test")
class ThresholdControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private ThresholdService thresholdService;

    private static final String USER = "test";
    private static final String PASS = "test";

    private ThresholdProfileDto minimalProfile() {
        return new ThresholdProfileDto(1L, "Default", "sim.BasicSimulation", List.of(), null, null);
    }

    @Test
    void list_withAuth_returns200() throws Exception {
        when(thresholdService.findAll()).thenReturn(List.of(minimalProfile()));

        mockMvc.perform(get("/api/thresholds").with(httpBasic(USER, PASS)))
                .andExpect(status().isOk());
    }

    @Test
    void list_noAuth_returns401() throws Exception {
        mockMvc.perform(get("/api/thresholds"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void get_returns200() throws Exception {
        when(thresholdService.findById(1L)).thenReturn(minimalProfile());

        mockMvc.perform(get("/api/thresholds/1").with(httpBasic(USER, PASS)))
                .andExpect(status().isOk());
    }

    @Test
    void create_returns200() throws Exception {
        when(thresholdService.create(any())).thenReturn(minimalProfile());

        String body = "{\"name\":\"Default\",\"simulationClass\":\"sim.BasicSimulation\"," +
                "\"rules\":[{\"metric\":\"meanResponseTime\",\"operator\":\"<\",\"threshold\":1000}]}";

        mockMvc.perform(post("/api/thresholds")
                        .with(httpBasic(USER, PASS))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk());
    }

    @Test
    void update_returns200() throws Exception {
        when(thresholdService.update(eq(1L), any())).thenReturn(minimalProfile());

        String body = "{\"name\":\"Updated\",\"simulationClass\":\"sim.BasicSimulation\"," +
                "\"rules\":[{\"metric\":\"meanResponseTime\",\"operator\":\"<\",\"threshold\":500}]}";

        mockMvc.perform(put("/api/thresholds/1")
                        .with(httpBasic(USER, PASS))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk());
    }

    @Test
    void delete_returns204() throws Exception {
        doNothing().when(thresholdService).delete(1L);

        mockMvc.perform(delete("/api/thresholds/1").with(httpBasic(USER, PASS)))
                .andExpect(status().isNoContent());
    }
}
