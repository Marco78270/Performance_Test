package com.gatlingweb.controller;

import com.gatlingweb.config.SecurityConfig;
import com.gatlingweb.dto.SimulationFileDto;
import com.gatlingweb.service.SimulationFileService;
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

@WebMvcTest(SimulationController.class)
@Import(SecurityConfig.class)
@ActiveProfiles("test")
class SimulationControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private SimulationFileService fileService;

    private static final String USER = "test";
    private static final String PASS = "test";

    @Test
    void getFiles_noPath_returns200() throws Exception {
        when(fileService.listFiles()).thenReturn(List.of(
                new SimulationFileDto("simulations", "simulations", true, List.of())));

        mockMvc.perform(get("/api/simulations/files").with(httpBasic(USER, PASS)))
                .andExpect(status().isOk());
    }

    @Test
    void getFiles_withPath_returns200() throws Exception {
        when(fileService.readFile("sim/BasicSimulation.scala"))
                .thenReturn("class BasicSimulation extends Simulation {}");

        mockMvc.perform(get("/api/simulations/files")
                        .param("path", "sim/BasicSimulation.scala")
                        .with(httpBasic(USER, PASS)))
                .andExpect(status().isOk());
    }

    @Test
    void updateFile_returns200() throws Exception {
        doNothing().when(fileService).writeFile(any(), any());

        mockMvc.perform(put("/api/simulations/files")
                        .param("path", "sim/BasicSimulation.scala")
                        .with(httpBasic(USER, PASS))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"content\":\"class BasicSimulation {}\"}"))
                .andExpect(status().isOk());
    }

    @Test
    void createFile_returns200() throws Exception {
        doNothing().when(fileService).createFile(any(), any());

        mockMvc.perform(post("/api/simulations/files")
                        .with(httpBasic(USER, PASS))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"path\":\"sim/NewSimulation.scala\",\"content\":\"\"}"))
                .andExpect(status().isOk());
    }

    @Test
    void deleteFile_returns200() throws Exception {
        doNothing().when(fileService).deleteFile(any());

        mockMvc.perform(delete("/api/simulations/files")
                        .param("path", "sim/OldSimulation.scala")
                        .with(httpBasic(USER, PASS)))
                .andExpect(status().isOk());
    }

    @Test
    void listClasses_returns200() throws Exception {
        when(fileService.listSimulationClasses()).thenReturn(List.of("sim.BasicSimulation"));

        mockMvc.perform(get("/api/simulations/classes").with(httpBasic(USER, PASS)))
                .andExpect(status().isOk());
    }
}
