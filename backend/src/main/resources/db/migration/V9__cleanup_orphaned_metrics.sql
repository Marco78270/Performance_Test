-- Clean up orphaned metrics (test_run_id references deleted test runs)
DELETE FROM metrics_points WHERE test_run_id NOT IN (SELECT id FROM test_runs);
DELETE FROM infra_metrics_points WHERE test_run_id NOT IN (SELECT id FROM test_runs);

-- Clean up stale metrics (data predating their test run's start time by more than 60 seconds)
-- This fixes data pollution from SQLite ID reuse after test deletion
DELETE FROM metrics_points WHERE id IN (
    SELECT mp.id FROM metrics_points mp
    JOIN test_runs tr ON mp.test_run_id = tr.id
    WHERE mp.timestamp < tr.start_time - 60000
);
DELETE FROM infra_metrics_points WHERE id IN (
    SELECT imp.id FROM infra_metrics_points imp
    JOIN test_runs tr ON imp.test_run_id = tr.id
    WHERE imp.timestamp < tr.start_time - 60000
);
