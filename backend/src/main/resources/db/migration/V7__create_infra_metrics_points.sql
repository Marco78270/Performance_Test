CREATE TABLE infra_metrics_points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    test_run_id INTEGER NOT NULL,
    timestamp BIGINT NOT NULL,
    server_id INTEGER,
    server_name TEXT,
    server_type TEXT,
    cpu_percent REAL,
    memory_used_bytes BIGINT,
    memory_total_bytes BIGINT,
    memory_percent REAL,
    disk_read_bytes_per_sec REAL,
    disk_write_bytes_per_sec REAL,
    network_recv_bytes_per_sec REAL,
    network_sent_bytes_per_sec REAL,
    sql_batch_per_sec REAL,
    FOREIGN KEY (test_run_id) REFERENCES test_runs(id) ON DELETE CASCADE
);

CREATE INDEX idx_infra_metrics_test_run ON infra_metrics_points(test_run_id, server_id, timestamp);
