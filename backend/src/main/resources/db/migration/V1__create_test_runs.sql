-- SQLite uses INTEGER for auto-increment primary keys
-- This is compatible with Java Long type at runtime
CREATE TABLE IF NOT EXISTS test_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    simulation_class TEXT,
    version TEXT,
    status TEXT,
    start_time TEXT,
    end_time TEXT,
    report_path TEXT,
    total_requests INTEGER,
    total_errors INTEGER,
    mean_response_time REAL,
    p50_response_time REAL,
    p75_response_time REAL,
    p95_response_time REAL,
    p99_response_time REAL
);

CREATE INDEX IF NOT EXISTS idx_test_runs_status ON test_runs(status);
CREATE INDEX IF NOT EXISTS idx_test_runs_start_time ON test_runs(start_time);
