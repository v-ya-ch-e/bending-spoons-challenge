CREATE TABLE IF NOT EXISTS projects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_name VARCHAR(255) NOT NULL UNIQUE,
    project_description TEXT NOT NULL,
    project_phase ENUM('new acquisition', 'growth', 'maintenance') NOT NULL,
    icon_url VARCHAR(2048) NOT NULL,
    poster_url VARCHAR(2048) NOT NULL,
    required_people_amount INT NOT NULL,
    -- JSON object keyed by skill; each value is non-negative headcount buckets:
    -- { "level_1": int, "level_2": int, "level_3": int }.
    required_skills JSON NOT NULL,
    github_repositories JSON NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS employees (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    role VARCHAR(255) NOT NULL,
    skills JSON NOT NULL,
    preferences JSON NOT NULL,
    interests JSON NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS project_assignments (
    employee_id INT NOT NULL,
    project_id INT NOT NULL,
    PRIMARY KEY (employee_id, project_id),
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS move_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT NOT NULL,
    from_project_id INT,
    to_project_id INT NOT NULL,
    reason TEXT NOT NULL,
    expected_role VARCHAR(255) NOT NULL,
    current_project_impact ENUM('low', 'medium', 'high') NOT NULL,
    status ENUM('pending', 'accepted', 'rejected', 'clarification_requested') NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    responded_at DATETIME,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (from_project_id) REFERENCES projects(id) ON DELETE SET NULL,
    FOREIGN KEY (to_project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS policies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    config JSON NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    activated_at DATETIME,
    INDEX idx_policies_active (is_active, activated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO policies (name, description, config, is_active, activated_at)
SELECT
    'Conservative strict matching',
    'Minimizes disruption by limiting moves and protecting current project coverage.',
    JSON_OBJECT(
        'max_candidate_plans', 25,
        'max_moves', 1,
        'max_projects_in_scope', 8,
        'max_employees_in_scope', 60,
        'max_employee_project_count', 2,
        'minimum_remaining_project_coverage', 0.85,
        'minimum_target_coverage_improvement', 0.1,
        'allow_unassigned_employees', TRUE,
        'allow_multi_project_assignment', TRUE,
        'allow_understaff_current_project', FALSE,
        'exclude_pending_move_requests', TRUE,
        'prefer_employee_preferences', TRUE,
        'emit_hiring_gaps', TRUE
    ),
    FALSE,
    NULL
WHERE NOT EXISTS (SELECT 1 FROM policies WHERE name = 'Conservative strict matching');

INSERT INTO policies (name, description, config, is_active, activated_at)
SELECT
    'Balanced strict matching',
    'Balanced matching defaults for demos and normal staffing planning.',
    JSON_OBJECT(
        'max_candidate_plans', 25,
        'max_moves', 2,
        'max_projects_in_scope', 8,
        'max_employees_in_scope', 60,
        'max_employee_project_count', 2,
        'minimum_remaining_project_coverage', 0.75,
        'minimum_target_coverage_improvement', 0.1,
        'allow_unassigned_employees', TRUE,
        'allow_multi_project_assignment', TRUE,
        'allow_understaff_current_project', FALSE,
        'exclude_pending_move_requests', TRUE,
        'prefer_employee_preferences', TRUE,
        'emit_hiring_gaps', TRUE
    ),
    TRUE,
    CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM policies WHERE name = 'Balanced strict matching');

INSERT INTO policies (name, description, config, is_active, activated_at)
SELECT
    'Aggressive strict matching',
    'Prioritizes urgent strategic staffing by allowing more source-project risk.',
    JSON_OBJECT(
        'max_candidate_plans', 25,
        'max_moves', 3,
        'max_projects_in_scope', 8,
        'max_employees_in_scope', 60,
        'max_employee_project_count', 2,
        'minimum_remaining_project_coverage', 0.6,
        'minimum_target_coverage_improvement', 0.1,
        'allow_unassigned_employees', TRUE,
        'allow_multi_project_assignment', TRUE,
        'allow_understaff_current_project', TRUE,
        'exclude_pending_move_requests', TRUE,
        'prefer_employee_preferences', TRUE,
        'emit_hiring_gaps', TRUE
    ),
    FALSE,
    NULL
WHERE NOT EXISTS (SELECT 1 FROM policies WHERE name = 'Aggressive strict matching');

UPDATE policies
SET
    is_active = CASE WHEN name = 'Balanced strict matching' THEN TRUE ELSE FALSE END,
    activated_at = CASE
        WHEN name = 'Balanced strict matching' AND activated_at IS NULL THEN CURRENT_TIMESTAMP
        WHEN name <> 'Balanced strict matching' THEN NULL
        ELSE activated_at
    END
WHERE name IN (
    'Conservative strict matching',
    'Balanced strict matching',
    'Aggressive strict matching'
) OR is_active = TRUE;

CREATE TABLE IF NOT EXISTS matching_runs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    use_case ENUM('portfolio_rebalance', 'project_rebalance', 'project_staffing') NOT NULL,
    target_project_id INT,
    status ENUM('pending', 'running', 'completed', 'failed') NOT NULL DEFAULT 'pending',
    requested_by VARCHAR(255),
    rule_config JSON NOT NULL,
    input_snapshot JSON,
    candidate_count INT NOT NULL DEFAULT 0,
    recommendation_count INT NOT NULL DEFAULT 0,
    hiring_recommendation_count INT NOT NULL DEFAULT 0,
    selected_candidate_plan_id VARCHAR(64),
    summary TEXT,
    error_message TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME,
    completed_at DATETIME,
    FOREIGN KEY (target_project_id) REFERENCES projects(id) ON DELETE SET NULL,
    INDEX idx_matching_runs_latest (use_case, target_project_id, created_at),
    INDEX idx_matching_runs_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS matching_candidates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    run_id INT NOT NULL,
    candidate_plan_id VARCHAR(64) NOT NULL,
    strict_score DECIMAL(8, 4),
    hard_rule_summary JSON,
    plan_payload JSON NOT NULL,
    rejected_reason TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (run_id) REFERENCES matching_runs(id) ON DELETE CASCADE,
    UNIQUE KEY uq_matching_candidates_plan (run_id, candidate_plan_id),
    INDEX idx_matching_candidates_run (run_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS matching_recommendations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    run_id INT NOT NULL,
    candidate_plan_id VARCHAR(64) NOT NULL,
    recommendation_rank INT NOT NULL,
    fit_score DECIMAL(8, 4),
    summary TEXT NOT NULL,
    explanation TEXT,
    risks JSON NOT NULL,
    ramp_up_estimate VARCHAR(255),
    suggested_moves JSON NOT NULL,
    model_metadata JSON,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (run_id) REFERENCES matching_runs(id) ON DELETE CASCADE,
    UNIQUE KEY uq_matching_recommendations_plan (run_id, candidate_plan_id),
    UNIQUE KEY uq_matching_recommendations_rank (run_id, recommendation_rank),
    INDEX idx_matching_recommendations_run (run_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS matching_hiring_recommendations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    run_id INT NOT NULL,
    candidate_plan_id VARCHAR(64),
    project_id INT,
    role_title VARCHAR(255) NOT NULL,
    count INT NOT NULL,
    required_skills JSON NOT NULL,
    reason TEXT NOT NULL,
    urgency ENUM('low', 'medium', 'high') NOT NULL,
    suggested_assignment VARCHAR(255),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (run_id) REFERENCES matching_runs(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
    INDEX idx_matching_hiring_run (run_id),
    INDEX idx_matching_hiring_project (project_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS matching_run_events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    run_id INT NOT NULL,
    level ENUM('debug', 'info', 'warning', 'error') NOT NULL,
    stage ENUM('request', 'snapshot', 'strict_rules', 'hiring_gap', 'llm_evaluation', 'persistence', 'action') NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    metadata JSON,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (run_id) REFERENCES matching_runs(id) ON DELETE CASCADE,
    INDEX idx_matching_events_run (run_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
