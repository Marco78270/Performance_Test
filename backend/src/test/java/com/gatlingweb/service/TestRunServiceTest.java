package com.gatlingweb.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.gatlingweb.dto.LaunchRequest;
import com.gatlingweb.dto.TestRunDto;
import com.gatlingweb.entity.TestRun;
import com.gatlingweb.entity.TestStatus;
import com.gatlingweb.repository.TestRunRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TestRunServiceTest {

    @Mock
    private TestRunRepository repository;
    @Mock
    private GatlingExecutionService executionService;
    @Mock
    private SimpMessagingTemplate messaging;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private TestRunService service;

    @BeforeEach
    void setUp() {
        service = new TestRunService(repository, executionService, objectMapper, messaging);
    }

    @Test
    void launch_noTestRunning_createsAndExecutes() {
        TestRun created = new TestRun();
        created.setId(1L);
        created.setSimulationClass("com.example.Sim");
        created.setStatus(TestStatus.RUNNING);
        when(executionService.launch("com.example.Sim", "v1")).thenReturn(created);

        LaunchRequest request = new LaunchRequest("com.example.Sim", "v1", 10, true, 10, 60, true, null);
        TestRunDto result = service.launch(request);

        assertThat(result.id()).isEqualTo(1L);
        verify(executionService).executeAsync(eq(1L), eq(request));
    }

    @Test
    void launch_testRunning_queuesTest() {
        // executionService.launch() throws when lock not available (TOCTOU-safe pattern)
        when(executionService.launch(anyString(), anyString()))
                .thenThrow(new IllegalStateException("A test is already running"));
        when(repository.countByStatus(TestStatus.QUEUED)).thenReturn(0L);
        when(repository.save(any(TestRun.class))).thenAnswer(inv -> {
            TestRun run = inv.getArgument(0);
            run.setId(2L);
            return run;
        });
        when(repository.findByStatusOrderByStartTimeAsc(TestStatus.QUEUED)).thenReturn(Collections.emptyList());

        LaunchRequest request = new LaunchRequest("com.example.Sim", "v1", 10, true, 10, 60, true, null);
        TestRunDto result = service.launch(request);

        assertThat(result.id()).isEqualTo(2L);
        verify(executionService, never()).executeAsync(anyLong(), any());

        ArgumentCaptor<TestRun> captor = ArgumentCaptor.forClass(TestRun.class);
        verify(repository).save(captor.capture());
        assertThat(captor.getValue().getStatus()).isEqualTo(TestStatus.QUEUED);
    }

    @Test
    void processNextQueued_emptyQueue_doesNothing() {
        when(repository.findByStatusOrderByStartTimeAsc(TestStatus.QUEUED)).thenReturn(Collections.emptyList());

        service.processNextQueued();

        verify(executionService, never()).launchExisting(any());
    }

    @Test
    void processNextQueued_deserializationFails_marksFailedAndContinues() {
        TestRun badTest = new TestRun();
        badTest.setId(1L);
        badTest.setStatus(TestStatus.QUEUED);
        badTest.setLaunchParams("invalid json");

        // First call returns bad test, second call returns empty (it was marked FAILED)
        when(repository.findByStatusOrderByStartTimeAsc(TestStatus.QUEUED))
                .thenReturn(List.of(badTest))
                .thenReturn(Collections.emptyList());

        service.processNextQueued();

        ArgumentCaptor<TestRun> captor = ArgumentCaptor.forClass(TestRun.class);
        verify(repository).save(captor.capture());
        assertThat(captor.getValue().getStatus()).isEqualTo(TestStatus.FAILED);
    }

    @Test
    void processNextQueued_validTest_launchesAndExecutes() throws Exception {
        TestRun queued = new TestRun();
        queued.setId(1L);
        queued.setSimulationClass("com.example.Sim");
        queued.setStatus(TestStatus.QUEUED);
        queued.setLaunchParams(objectMapper.writeValueAsString(
                new LaunchRequest("com.example.Sim", "v1", 5, true, 10, 30, true, null)
        ));

        // First call: returns queued test; subsequent calls (from broadcastQueue): return empty
        when(repository.findByStatusOrderByStartTimeAsc(TestStatus.QUEUED))
                .thenReturn(List.of(queued))
                .thenReturn(Collections.emptyList());

        service.processNextQueued();

        verify(executionService).launchExisting(queued);
        verify(executionService).executeAsync(eq(1L), any(LaunchRequest.class));
    }

    @Test
    void cancelQueued_validQueuedTest_setsCancelled() {
        TestRun queued = new TestRun();
        queued.setId(1L);
        queued.setStatus(TestStatus.QUEUED);
        when(repository.findById(1L)).thenReturn(Optional.of(queued));
        when(repository.findByStatusOrderByStartTimeAsc(TestStatus.QUEUED)).thenReturn(Collections.emptyList());

        service.cancelQueued(1L);

        assertThat(queued.getStatus()).isEqualTo(TestStatus.CANCELLED);
        verify(repository).save(queued);
    }

    @Test
    void cancelQueued_nonQueuedTest_doesNothing() {
        TestRun running = new TestRun();
        running.setId(1L);
        running.setStatus(TestStatus.RUNNING);
        when(repository.findById(1L)).thenReturn(Optional.of(running));

        service.cancelQueued(1L);

        assertThat(running.getStatus()).isEqualTo(TestStatus.RUNNING);
        verify(repository, never()).save(any());
    }
}
