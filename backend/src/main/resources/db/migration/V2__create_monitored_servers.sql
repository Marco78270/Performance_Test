CREATE TABLE monitored_servers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(255) NOT NULL,
    url VARCHAR(500) NOT NULL,
    server_type VARCHAR(50) NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    last_seen_at TIMESTAMP,
    last_error VARCHAR(1000)
);
