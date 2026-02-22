CREATE TABLE scheduled_tests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    test_type TEXT NOT NULL,
    script_class TEXT NOT NULL,
    launch_params_json TEXT,
    scheduled_at INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    launched_at INTEGER,
    created_at INTEGER NOT NULL,
    notes TEXT
);
