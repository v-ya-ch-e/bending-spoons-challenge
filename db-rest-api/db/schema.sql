CREATE TABLE IF NOT EXISTS projects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_name VARCHAR(255) NOT NULL UNIQUE,
    project_description TEXT NOT NULL,
    project_phase ENUM('new acquisition', 'growth', 'maintenance') NOT NULL,
    icon_url VARCHAR(2048) NOT NULL,
    poster_url VARCHAR(2048) NOT NULL,
    required_people_amount INT NOT NULL,
    -- JSON object keyed by skill; each value is { "level_1": int, "level_2": int, "level_3": int }.
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
