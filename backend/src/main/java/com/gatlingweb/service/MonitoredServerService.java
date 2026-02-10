package com.gatlingweb.service;

import com.gatlingweb.dto.CreateServerRequest;
import com.gatlingweb.dto.MonitoredServerDto;
import com.gatlingweb.entity.MonitoredServer;
import com.gatlingweb.repository.MonitoredServerRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class MonitoredServerService {

    private final MonitoredServerRepository repository;

    public MonitoredServerService(MonitoredServerRepository repository) {
        this.repository = repository;
    }

    public List<MonitoredServerDto> findAll() {
        return repository.findAll().stream()
            .map(MonitoredServerDto::from)
            .toList();
    }

    public List<MonitoredServer> findEnabled() {
        return repository.findByEnabledTrue();
    }

    public MonitoredServerDto findById(Long id) {
        return repository.findById(id)
            .map(MonitoredServerDto::from)
            .orElseThrow(() -> new IllegalArgumentException("Server not found: " + id));
    }

    @Transactional
    public MonitoredServerDto create(CreateServerRequest request) {
        MonitoredServer server = new MonitoredServer();
        server.setName(request.name());
        server.setUrl(request.url());
        server.setServerType(request.serverType());
        server.setEnabled(true);
        return MonitoredServerDto.from(repository.save(server));
    }

    @Transactional
    public MonitoredServerDto update(Long id, CreateServerRequest request) {
        MonitoredServer server = repository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Server not found: " + id));
        server.setName(request.name());
        server.setUrl(request.url());
        server.setServerType(request.serverType());
        return MonitoredServerDto.from(repository.save(server));
    }

    @Transactional
    public MonitoredServerDto toggleEnabled(Long id) {
        MonitoredServer server = repository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Server not found: " + id));
        server.setEnabled(!server.getEnabled());
        return MonitoredServerDto.from(repository.save(server));
    }

    @Transactional
    public void delete(Long id) {
        if (!repository.existsById(id)) {
            throw new IllegalArgumentException("Server not found: " + id);
        }
        repository.deleteById(id);
    }

    @Transactional
    public void updateStatus(Long id, java.time.LocalDateTime lastSeenAt, String lastError) {
        repository.findById(id).ifPresent(server -> {
            server.setLastSeenAt(lastSeenAt);
            server.setLastError(lastError);
            repository.save(server);
        });
    }
}
