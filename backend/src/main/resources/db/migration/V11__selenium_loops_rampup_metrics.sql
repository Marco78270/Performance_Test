-- Ajout loops/rampup sur selenium_test_runs
ALTER TABLE selenium_test_runs ADD COLUMN loops INTEGER NOT NULL DEFAULT 1;
ALTER TABLE selenium_test_runs ADD COLUMN ramp_up_seconds INTEGER NOT NULL DEFAULT 0;
ALTER TABLE selenium_test_runs ADD COLUMN total_iterations INTEGER DEFAULT 0;
ALTER TABLE selenium_test_runs ADD COLUMN passed_iterations INTEGER DEFAULT 0;
ALTER TABLE selenium_test_runs ADD COLUMN failed_iterations INTEGER DEFAULT 0;

-- Ajout iteration sur selenium_browser_results
ALTER TABLE selenium_browser_results ADD COLUMN iteration INTEGER NOT NULL DEFAULT 0;

-- Nouvelle table metriques Selenium
CREATE TABLE selenium_metrics_points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    test_run_id INTEGER NOT NULL,
    timestamp BIGINT NOT NULL,
    iterations_per_second REAL DEFAULT 0,
    errors_per_second REAL DEFAULT 0,
    mean_step_duration REAL DEFAULT 0,
    p50 REAL DEFAULT 0,
    p75 REAL DEFAULT 0,
    p95 REAL DEFAULT 0,
    p99 REAL DEFAULT 0,
    active_browsers INTEGER DEFAULT 0,
    total_iterations BIGINT DEFAULT 0,
    total_errors BIGINT DEFAULT 0,
    cpu_percent REAL,
    memory_percent REAL,
    FOREIGN KEY (test_run_id) REFERENCES selenium_test_runs(id) ON DELETE CASCADE
);
CREATE INDEX idx_sel_metrics_test ON selenium_metrics_points(test_run_id);
