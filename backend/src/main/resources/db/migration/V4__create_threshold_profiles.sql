CREATE TABLE threshold_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    simulation_class TEXT NOT NULL,
    rules TEXT NOT NULL DEFAULT '[]',
    created_at TEXT,
    updated_at TEXT
);

CREATE UNIQUE INDEX idx_threshold_profiles_simulation ON threshold_profiles(simulation_class);

ALTER TABLE test_runs ADD COLUMN threshold_verdict TEXT;
ALTER TABLE test_runs ADD COLUMN threshold_profile_id INTEGER;
ALTER TABLE test_runs ADD COLUMN threshold_details TEXT;
