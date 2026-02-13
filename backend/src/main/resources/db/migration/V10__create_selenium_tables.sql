CREATE TABLE selenium_test_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    script_class TEXT NOT NULL,
    browser TEXT NOT NULL DEFAULT 'chrome',
    instances INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL CHECK (status IN ('QUEUED','RUNNING','COMPLETED','FAILED','CANCELLED')),
    start_time BIGINT,
    end_time BIGINT,
    total_instances INTEGER DEFAULT 0,
    passed_instances INTEGER DEFAULT 0,
    failed_instances INTEGER DEFAULT 0,
    version TEXT,
    labels TEXT DEFAULT '',
    grid_url TEXT
);

CREATE TABLE selenium_browser_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    test_run_id INTEGER NOT NULL,
    browser_index INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'RUNNING',
    start_time BIGINT,
    end_time BIGINT,
    duration_ms BIGINT,
    error_message TEXT,
    steps_json TEXT,
    screenshot_path TEXT,
    FOREIGN KEY (test_run_id) REFERENCES selenium_test_runs(id) ON DELETE CASCADE
);
CREATE INDEX idx_sel_results_test ON selenium_browser_results(test_run_id);
