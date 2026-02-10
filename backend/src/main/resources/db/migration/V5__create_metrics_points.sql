CREATE TABLE metrics_points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    test_run_id INTEGER NOT NULL,
    timestamp BIGINT NOT NULL,
    requests_per_second REAL DEFAULT 0,
    errors_per_second REAL DEFAULT 0,
    mean_response_time REAL DEFAULT 0,
    p50 REAL DEFAULT 0,
    p75 REAL DEFAULT 0,
    p95 REAL DEFAULT 0,
    p99 REAL DEFAULT 0,
    active_users INTEGER DEFAULT 0,
    total_requests BIGINT DEFAULT 0,
    total_errors BIGINT DEFAULT 0,
    FOREIGN KEY (test_run_id) REFERENCES test_runs(id) ON DELETE CASCADE
);

CREATE INDEX idx_metrics_points_test_run ON metrics_points(test_run_id, timestamp);
