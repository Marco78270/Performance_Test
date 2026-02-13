package com.gatlingweb.selenium.controller;

import com.gatlingweb.dto.InfraMetricsSnapshot;
import com.gatlingweb.dto.SimulationFileDto;
import com.gatlingweb.dto.SimulationTemplateDto;
import com.gatlingweb.entity.TestStatus;
import com.gatlingweb.selenium.dto.SeleniumLaunchRequest;
import com.gatlingweb.selenium.dto.SeleniumMetricsSnapshot;
import com.gatlingweb.selenium.entity.AppSetting;
import com.gatlingweb.selenium.entity.SeleniumBrowserResult;
import com.gatlingweb.selenium.entity.SeleniumTestRun;
import com.gatlingweb.selenium.repository.AppSettingRepository;
import com.gatlingweb.selenium.repository.SeleniumBrowserResultRepository;
import com.gatlingweb.selenium.repository.SeleniumTestRunRepository;
import com.gatlingweb.selenium.service.*;
import com.gatlingweb.service.MetricsPersistenceService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/selenium")
public class SeleniumController {

    private final SeleniumFileService fileService;
    private final SeleniumTemplateService templateService;
    private final SeleniumExecutionService executionService;
    private final SeleniumCompilerService compilerService;
    private final SeleniumGridService gridService;
    private final SeleniumMetricsCollector metricsCollector;
    private final SeleniumTestRunRepository testRunRepository;
    private final SeleniumBrowserResultRepository resultRepository;
    private final AppSettingRepository appSettingRepository;
    private final MetricsPersistenceService metricsPersistenceService;

    public SeleniumController(
            SeleniumFileService fileService,
            SeleniumTemplateService templateService,
            SeleniumExecutionService executionService,
            SeleniumCompilerService compilerService,
            SeleniumGridService gridService,
            SeleniumMetricsCollector metricsCollector,
            SeleniumTestRunRepository testRunRepository,
            SeleniumBrowserResultRepository resultRepository,
            AppSettingRepository appSettingRepository,
            MetricsPersistenceService metricsPersistenceService) {
        this.fileService = fileService;
        this.templateService = templateService;
        this.executionService = executionService;
        this.compilerService = compilerService;
        this.gridService = gridService;
        this.metricsCollector = metricsCollector;
        this.testRunRepository = testRunRepository;
        this.resultRepository = resultRepository;
        this.appSettingRepository = appSettingRepository;
        this.metricsPersistenceService = metricsPersistenceService;
    }

    // --- File management ---

    @GetMapping("/files")
    public ResponseEntity<?> getFiles(@RequestParam(required = false) String path) throws IOException {
        if (path != null) {
            String content = fileService.readFile(path);
            return ResponseEntity.ok(Map.of("path", path, "content", content));
        }
        List<SimulationFileDto> tree = fileService.listFiles();
        return ResponseEntity.ok(tree);
    }

    @PutMapping("/files")
    public ResponseEntity<?> updateFile(@RequestParam String path, @RequestBody Map<String, String> body) throws IOException {
        fileService.writeFile(path, body.get("content"));
        return ResponseEntity.ok(Map.of("status", "saved"));
    }

    @PostMapping("/files")
    public ResponseEntity<?> createFile(@RequestBody Map<String, String> body) throws IOException {
        String path = body.get("path");
        String content = body.getOrDefault("content", "");
        fileService.createFile(path, content);
        return ResponseEntity.ok(Map.of("status", "created"));
    }

    @DeleteMapping("/files")
    public ResponseEntity<?> deleteFile(@RequestParam String path) throws IOException {
        fileService.deleteFile(path);
        return ResponseEntity.ok(Map.of("status", "deleted"));
    }

    @PostMapping("/files/rename")
    public ResponseEntity<?> renameFile(@RequestBody Map<String, String> body) throws IOException {
        fileService.renameFile(body.get("oldPath"), body.get("newPath"));
        return ResponseEntity.ok(Map.of("status", "renamed"));
    }

    @PostMapping("/directories")
    public ResponseEntity<?> createDirectory(@RequestBody Map<String, String> body) throws IOException {
        fileService.createDirectory(body.get("path"));
        return ResponseEntity.ok(Map.of("status", "created"));
    }

    // --- Classes ---

    @GetMapping("/classes")
    public List<String> listClasses() throws IOException {
        return fileService.listScriptClasses();
    }

    // --- Templates ---

    @GetMapping("/templates")
    public List<SimulationTemplateDto> listTemplates() {
        return templateService.listTemplates();
    }

    @GetMapping("/templates/content")
    public ResponseEntity<Map<String, String>> getTemplateContent(
            @RequestParam String id,
            @RequestParam(defaultValue = "MySeleniumScript") String className,
            @RequestParam(defaultValue = "http://localhost:8080") String baseUrl) {
        String content = templateService.getTemplateContent(id, className, baseUrl);
        return ResponseEntity.ok(Map.of("content", content));
    }

    // --- Compilation ---

    @PostMapping("/compile")
    public ResponseEntity<?> compile() {
        SeleniumCompilerService.CompileResult result = compilerService.compile();
        return ResponseEntity.ok(Map.of("success", result.success(), "output", result.output()));
    }

    // --- Test execution ---

    @PostMapping("/launch")
    public ResponseEntity<?> launch(@Valid @RequestBody SeleniumLaunchRequest request) {
        if (executionService.isRunning()) {
            return ResponseEntity.badRequest().body(Map.of("error", "A Selenium test is already running"));
        }
        SeleniumTestRun run = executionService.launch(request);
        executionService.executeAsync(run.getId(), request.headless());
        return ResponseEntity.ok(run);
    }

    @GetMapping("/tests")
    public Page<SeleniumTestRun> listTests(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "id") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir,
            @RequestParam(required = false) String browser,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String label) {
        Sort sort = Sort.by(sortDir.equalsIgnoreCase("asc") ? Sort.Direction.ASC : Sort.Direction.DESC, sortBy);
        PageRequest pageRequest = PageRequest.of(page, size, sort);
        boolean hasBrowser = browser != null && !browser.isEmpty();
        boolean hasStatus = status != null && !status.isEmpty();
        boolean hasLabel = label != null && !label.isEmpty();
        if (hasBrowser && hasStatus && hasLabel) {
            return testRunRepository.findByBrowserAndStatusAndLabelsContaining(browser, TestStatus.valueOf(status), label, pageRequest);
        } else if (hasBrowser && hasStatus) {
            return testRunRepository.findByBrowserAndStatus(browser, TestStatus.valueOf(status), pageRequest);
        } else if (hasBrowser && hasLabel) {
            return testRunRepository.findByBrowserAndLabelsContaining(browser, label, pageRequest);
        } else if (hasStatus && hasLabel) {
            return testRunRepository.findByStatusAndLabelsContaining(TestStatus.valueOf(status), label, pageRequest);
        } else if (hasBrowser) {
            return testRunRepository.findByBrowser(browser, pageRequest);
        } else if (hasStatus) {
            return testRunRepository.findByStatus(TestStatus.valueOf(status), pageRequest);
        } else if (hasLabel) {
            return testRunRepository.findByLabelsContaining(label, pageRequest);
        }
        return testRunRepository.findAll(pageRequest);
    }

    @GetMapping("/tests/{id}")
    public ResponseEntity<SeleniumTestRun> getTest(@PathVariable Long id) {
        return testRunRepository.findById(id)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/tests/{id}/results")
    public List<SeleniumBrowserResult> getResults(@PathVariable Long id) {
        return resultRepository.findByTestRunIdOrderByBrowserIndexAscIterationAsc(id);
    }

    @GetMapping("/tests/{id}/metrics")
    public List<SeleniumMetricsSnapshot> getMetrics(@PathVariable Long id) {
        return metricsCollector.getMetrics(id);
    }

    @GetMapping("/tests/{id}/infra-metrics")
    public List<InfraMetricsSnapshot> getInfraMetrics(@PathVariable Long id) {
        return metricsPersistenceService.getInfraMetrics(id);
    }

    @DeleteMapping("/tests/{id}")
    @Transactional
    public ResponseEntity<?> deleteTest(@PathVariable Long id) {
        metricsCollector.deleteMetrics(id);
        resultRepository.deleteByTestRunId(id);
        testRunRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("status", "deleted"));
    }

    @PostMapping("/tests/{id}/cancel")
    public ResponseEntity<?> cancelTest(@PathVariable Long id) {
        executionService.cancel(id);
        return ResponseEntity.ok(Map.of("status", "cancelled"));
    }

    // --- Version & Labels ---

    @PutMapping("/tests/{id}/version")
    @Transactional
    public ResponseEntity<?> updateVersion(@PathVariable Long id, @RequestBody Map<String, String> body) {
        testRunRepository.findById(id).ifPresent(run -> {
            run.setVersion(body.get("version"));
            testRunRepository.save(run);
        });
        return ResponseEntity.ok(Map.of("status", "updated"));
    }

    @PutMapping("/tests/{id}/labels")
    @Transactional
    public ResponseEntity<?> updateLabels(@PathVariable Long id, @RequestBody Map<String, List<String>> body) {
        testRunRepository.findById(id).ifPresent(run -> {
            List<String> labels = body.getOrDefault("labels", List.of());
            String joined = labels.stream()
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .reduce((a, b) -> a + "," + b)
                .orElse("");
            run.setLabels(joined);
            testRunRepository.save(run);
        });
        return ResponseEntity.ok(Map.of("status", "updated"));
    }

    @GetMapping("/labels")
    public List<String> getAllLabels() {
        return testRunRepository.findAllLabelsRaw().stream()
            .flatMap(s -> Arrays.stream(s.split(",")))
            .map(String::trim)
            .filter(s -> !s.isEmpty())
            .distinct()
            .sorted()
            .toList();
    }

    // --- Grid status ---

    @GetMapping("/grid/status")
    public ResponseEntity<?> gridStatus() {
        return ResponseEntity.ok(Map.of(
            "status", gridService.getStatus(),
            "url", gridService.getGridUrl()
        ));
    }

    // --- Driver configuration ---

    @GetMapping("/config/drivers")
    public ResponseEntity<?> getDriverConfig() {
        String chrome = appSettingRepository.findById("driver.chrome.path").map(AppSetting::getValue).orElse("");
        String firefox = appSettingRepository.findById("driver.firefox.path").map(AppSetting::getValue).orElse("");
        String edge = appSettingRepository.findById("driver.edge.path").map(AppSetting::getValue).orElse("");
        return ResponseEntity.ok(Map.of("chrome", chrome, "firefox", firefox, "edge", edge));
    }

    @PutMapping("/config/drivers")
    @Transactional
    public ResponseEntity<?> saveDriverConfig(@RequestBody Map<String, String> body) {
        String chrome = body.getOrDefault("chrome", "");
        String firefox = body.getOrDefault("firefox", "");
        String edge = body.getOrDefault("edge", "");
        appSettingRepository.save(new AppSetting("driver.chrome.path", chrome));
        appSettingRepository.save(new AppSetting("driver.firefox.path", firefox));
        appSettingRepository.save(new AppSetting("driver.edge.path", edge));
        gridService.invalidateDriverCache();
        return ResponseEntity.ok(Map.of("status", "saved"));
    }
}
