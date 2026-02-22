package com.gatlingweb.config.export;

import com.gatlingweb.entity.MonitoredServer;
import com.gatlingweb.entity.ServerType;
import com.gatlingweb.entity.ThresholdProfile;
import com.gatlingweb.repository.MonitoredServerRepository;
import com.gatlingweb.repository.ThresholdProfileRepository;
import com.gatlingweb.selenium.entity.AppSetting;
import com.gatlingweb.selenium.repository.AppSettingRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/config")
public class ConfigController {

    private final ThresholdProfileRepository thresholdRepo;
    private final MonitoredServerRepository serverRepo;
    private final AppSettingRepository settingRepo;

    public ConfigController(
            ThresholdProfileRepository thresholdRepo,
            MonitoredServerRepository serverRepo,
            AppSettingRepository settingRepo) {
        this.thresholdRepo = thresholdRepo;
        this.serverRepo = serverRepo;
        this.settingRepo = settingRepo;
    }

    @GetMapping("/export")
    public ConfigExportDto export() {
        List<ConfigExportDto.ThresholdProfileExport> profiles = thresholdRepo.findAll().stream()
            .map(p -> new ConfigExportDto.ThresholdProfileExport(p.getName(), p.getSimulationClass(), p.getRules()))
            .toList();

        List<ConfigExportDto.MonitoredServerExport> servers = serverRepo.findAll().stream()
            .map(s -> new ConfigExportDto.MonitoredServerExport(
                s.getName(), s.getUrl(),
                s.getServerType() != null ? s.getServerType().name() : null,
                Boolean.TRUE.equals(s.getEnabled())))
            .toList();

        List<ConfigExportDto.AppSettingExport> settings = settingRepo.findAll().stream()
            .map(a -> new ConfigExportDto.AppSettingExport(a.getKey(), a.getValue()))
            .toList();

        return new ConfigExportDto("1.0", LocalDateTime.now().toString(), profiles, servers, settings);
    }

    @PostMapping("/import")
    @Transactional
    public ResponseEntity<Map<String, Integer>> importConfig(@RequestBody ConfigExportDto dto) {
        thresholdRepo.deleteAll();
        serverRepo.deleteAll();
        settingRepo.deleteAll();

        long now = System.currentTimeMillis();
        for (ConfigExportDto.ThresholdProfileExport p : dto.thresholdProfiles()) {
            ThresholdProfile profile = new ThresholdProfile();
            profile.setName(p.name());
            profile.setSimulationClass(p.simulationClass());
            profile.setRules(p.rules());
            profile.setCreatedAt(now);
            profile.setUpdatedAt(now);
            thresholdRepo.save(profile);
        }

        for (ConfigExportDto.MonitoredServerExport s : dto.monitoredServers()) {
            MonitoredServer server = new MonitoredServer();
            server.setName(s.name());
            server.setUrl(s.url());
            if (s.serverType() != null) {
                try { server.setServerType(ServerType.valueOf(s.serverType())); } catch (IllegalArgumentException ignored) {}
            }
            server.setEnabled(s.enabled());
            serverRepo.save(server);
        }

        for (ConfigExportDto.AppSettingExport a : dto.appSettings()) {
            settingRepo.save(new AppSetting(a.key(), a.value()));
        }

        return ResponseEntity.ok(Map.of(
            "profiles", dto.thresholdProfiles().size(),
            "servers", dto.monitoredServers().size(),
            "settings", dto.appSettings().size()
        ));
    }
}
