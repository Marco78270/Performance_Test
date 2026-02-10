package com.gatlingweb.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.gatlingweb.dto.LaunchRequest;
import com.gatlingweb.entity.TestRun;
import com.gatlingweb.entity.TestStatus;
import com.gatlingweb.repository.TestRunRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TestRunServiceQueueTest {

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
    void processNextQueued_multipleDeserializationFailures_doesNotStackOverflow() {
        // Create 3 tests with invalid JSON, then empty queue
        // Each iteration: 1 call for the loop query + 1 call from broadcastQueue()
        TestRun bad1 = createBadTest(1L);
        TestRun bad2 = createBadTest(2L);
        TestRun bad3 = createBadTest(3L);

        when(repository.findByStatusOrderByStartTimeAsc(TestStatus.QUEUED))
                .thenReturn(List.of(bad1))       // loop iteration 1
                .thenReturn(List.of(bad2))        // broadcastQueue for bad1 (returns bad2 but not used for loop)
                .thenReturn(List.of(bad2))        // loop iteration 2
                .thenReturn(List.of(bad3))        // broadcastQueue for bad2
                .thenReturn(List.of(bad3))        // loop iteration 3
                .thenReturn(Collections.emptyList()) // broadcastQueue for bad3
                .thenReturn(Collections.emptyList()); // loop exits

        // Should NOT throw StackOverflowError (iterative, not recursive)
        assertThatCode(() -> service.processNextQueued()).doesNotThrowAnyException();

        // All 3 should be saved as FAILED
        verify(repository, times(3)).save(any(TestRun.class));
        assertThat(bad1.getStatus()).isEqualTo(TestStatus.FAILED);
        assertThat(bad2.getStatus()).isEqualTo(TestStatus.FAILED);
        assertThat(bad3.getStatus()).isEqualTo(TestStatus.FAILED);
    }

    private TestRun createBadTest(Long id) {
        TestRun bad = new TestRun();
        bad.setId(id);
        bad.setStatus(TestStatus.QUEUED);
        bad.setLaunchParams("invalid json");
        return bad;
    }

    @Test
    void processNextQueued_failureFollowedBySuccess_processesCorrectly() throws Exception {
        TestRun badTest = new TestRun();
        badTest.setId(1L);
        badTest.setStatus(TestStatus.QUEUED);
        badTest.setLaunchParams("invalid json");

        TestRun goodTest = new TestRun();
        goodTest.setId(2L);
        goodTest.setSimulationClass("com.example.Sim");
        goodTest.setStatus(TestStatus.QUEUED);
        goodTest.setLaunchParams(objectMapper.writeValueAsString(
                new LaunchRequest("com.example.Sim", "v1", 5, true, 10, 30, true, null)
        ));

        when(repository.findByStatusOrderByStartTimeAsc(TestStatus.QUEUED))
                .thenReturn(List.of(badTest))
                .thenReturn(List.of(goodTest));

        service.processNextQueued();

        // Bad test marked FAILED
        assertThat(badTest.getStatus()).isEqualTo(TestStatus.FAILED);
        // Good test launched
        verify(executionService).launchExisting(goodTest);
        verify(executionService).executeAsync(eq(2L), any(LaunchRequest.class));
    }

    @Test
    void launch_queueFull_throwsIllegalState() {
        when(executionService.launch(anyString(), anyString()))
                .thenThrow(new IllegalStateException("A test is already running"));
        when(repository.countByStatus(TestStatus.QUEUED)).thenReturn(20L);

        LaunchRequest request = new LaunchRequest("com.example.Sim", "v1", 5, true, 10, 30, true, null);

        assertThatThrownBy(() -> service.launch(request))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("queue is full");
    }

    @Test
    void launch_queueNotFull_queuesTest() {
        when(executionService.launch(anyString(), anyString()))
                .thenThrow(new IllegalStateException("A test is already running"));
        when(repository.countByStatus(TestStatus.QUEUED)).thenReturn(5L);
        when(repository.save(any(TestRun.class))).thenAnswer(inv -> {
            TestRun run = inv.getArgument(0);
            run.setId(1L);
            return run;
        });
        when(repository.findByStatusOrderByStartTimeAsc(TestStatus.QUEUED)).thenReturn(Collections.emptyList());

        LaunchRequest request = new LaunchRequest("com.example.Sim", "v1", 5, true, 10, 30, true, null);
        var result = service.launch(request);

        assertThat(result.id()).isEqualTo(1L);
        verify(repository).save(argThat(r -> r.getStatus() == TestStatus.QUEUED));
    }
}
