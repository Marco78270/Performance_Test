-- Index pour le scheduler (recherche des tests à lancer par date+statut)
CREATE INDEX IF NOT EXISTS idx_scheduled_tests_at_status
    ON scheduled_tests(scheduled_at, status);

-- Index pour les filtres de l'historique Selenium
CREATE INDEX IF NOT EXISTS idx_selenium_runs_status
    ON selenium_test_runs(status);

CREATE INDEX IF NOT EXISTS idx_selenium_runs_script
    ON selenium_test_runs(script_class);
