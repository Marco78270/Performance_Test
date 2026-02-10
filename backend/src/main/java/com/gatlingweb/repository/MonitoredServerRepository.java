package com.gatlingweb.repository;

import com.gatlingweb.entity.MonitoredServer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MonitoredServerRepository extends JpaRepository<MonitoredServer, Long> {
    List<MonitoredServer> findByEnabledTrue();
}
