CREATE TABLE IF NOT EXISTS projects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_name VARCHAR(255) NOT NULL UNIQUE,
    project_description TEXT NOT NULL,
    project_phase ENUM('new acquisition', 'growth', 'maintenance') NOT NULL,
    icon_url VARCHAR(2048) NOT NULL,
    poster_url VARCHAR(2048) NOT NULL,
    required_people_amount INT NOT NULL,
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
