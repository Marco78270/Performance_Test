-- Créer les tables de labels relationnelles
CREATE TABLE test_run_labels (
    test_run_id INTEGER NOT NULL,
    label TEXT NOT NULL,
    PRIMARY KEY (test_run_id, label),
    FOREIGN KEY (test_run_id) REFERENCES test_runs(id) ON DELETE CASCADE
);

CREATE TABLE selenium_test_run_labels (
    test_run_id INTEGER NOT NULL,
    label TEXT NOT NULL,
    PRIMARY KEY (test_run_id, label),
    FOREIGN KEY (test_run_id) REFERENCES selenium_test_runs(id) ON DELETE CASCADE
);

-- Migrer les labels existants de test_runs via CTE récursive
WITH RECURSIVE split(id, label, rest) AS (
  SELECT id,
    CASE WHEN instr(labels,',')>0 THEN substr(labels,1,instr(labels,',')-1) ELSE labels END,
    CASE WHEN instr(labels,',')>0 THEN substr(labels,instr(labels,',')+1) ELSE '' END
  FROM test_runs WHERE labels IS NOT NULL AND labels != ''
  UNION ALL
  SELECT id,
    CASE WHEN instr(rest,',')>0 THEN substr(rest,1,instr(rest,',')-1) ELSE rest END,
    CASE WHEN instr(rest,',')>0 THEN substr(rest,instr(rest,',')+1) ELSE '' END
  FROM split WHERE rest != ''
)
INSERT OR IGNORE INTO test_run_labels(test_run_id, label)
SELECT id, TRIM(label) FROM split WHERE TRIM(label) != '';

-- Migrer les labels existants de selenium_test_runs via CTE récursive
WITH RECURSIVE split(id, label, rest) AS (
  SELECT id,
    CASE WHEN instr(labels,',')>0 THEN substr(labels,1,instr(labels,',')-1) ELSE labels END,
    CASE WHEN instr(labels,',')>0 THEN substr(labels,instr(labels,',')+1) ELSE '' END
  FROM selenium_test_runs WHERE labels IS NOT NULL AND labels != ''
  UNION ALL
  SELECT id,
    CASE WHEN instr(rest,',')>0 THEN substr(rest,1,instr(rest,',')-1) ELSE rest END,
    CASE WHEN instr(rest,',')>0 THEN substr(rest,instr(rest,',')+1) ELSE '' END
  FROM split WHERE rest != ''
)
INSERT OR IGNORE INTO selenium_test_run_labels(test_run_id, label)
SELECT id, TRIM(label) FROM split WHERE TRIM(label) != '';

-- Supprimer les colonnes labels des tables principales
ALTER TABLE test_runs DROP COLUMN labels;
ALTER TABLE selenium_test_runs DROP COLUMN labels;
