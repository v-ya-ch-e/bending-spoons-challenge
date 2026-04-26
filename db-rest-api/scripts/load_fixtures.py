"""Load Atlas seed fixtures into the configured MySQL database."""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any

import mysql.connector
from dotenv import load_dotenv

DEFAULT_FIXTURE = Path(__file__).resolve().parent.parent / "fixtures" / "seed_data.json"
SKILL_KEYS = ("android", "ios", "web", "backend", "infrastructure", "ai")
PROJECT_SKILL_LEVEL_KEYS = ("level_1", "level_2", "level_3")


def get_connection():
    required = ["DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD"]
    missing = [name for name in required if not os.environ.get(name)]
    if missing:
        sys.exit(f"Missing required environment variables: {', '.join(missing)}")

    return mysql.connector.connect(
        host=os.environ["DB_HOST"],
        port=int(os.environ.get("DB_PORT", "3306")),
        database=os.environ["DB_NAME"],
        user=os.environ["DB_USER"],
        password=os.environ["DB_PASSWORD"],
    )


def load_fixture(path: Path) -> dict[str, list[dict[str, Any]]]:
    if not path.exists():
        sys.exit(f"Fixture file not found: {path}")
    data = json.loads(path.read_text())
    for key in ("employees", "projects", "move_requests"):
        if key not in data or not isinstance(data[key], list):
            sys.exit(f"Fixture missing required list field: {key}")
    validate_fixture_contract(data)
    return data


def validate_fixture_contract(data: dict[str, list[dict[str, Any]]]) -> None:
    for project in data["projects"]:
        validate_project_skill_requirements(
            project.get("required_skills"),
            f"project {project.get('project_name')!r}",
        )
    for employee in data["employees"]:
        validate_employee_skill_map(
            employee.get("skills"),
            f"employee {employee.get('name')!r}",
        )


def validate_employee_skill_map(value: Any, label: str) -> None:
    if not isinstance(value, dict):
        sys.exit(f"{label} skills must be an object with canonical skill keys")
    if set(value) != set(SKILL_KEYS):
        sys.exit(f"{label} skills must use exactly these keys: {', '.join(SKILL_KEYS)}")
    invalid = [
        skill
        for skill in SKILL_KEYS
        if not isinstance(value[skill], int) or value[skill] < 0 or value[skill] > 3
    ]
    if invalid:
        sys.exit(
            f"{label} skill levels must be integers from 0 to 3: {', '.join(invalid)}"
        )


def validate_project_skill_requirements(value: Any, label: str) -> None:
    if not isinstance(value, dict):
        sys.exit(f"{label} required_skills must be an object with canonical skill keys")
    if set(value) != set(SKILL_KEYS):
        sys.exit(
            f"{label} required_skills must use exactly these keys: {', '.join(SKILL_KEYS)}"
        )

    invalid_skills = []
    invalid_levels = []
    for skill in SKILL_KEYS:
        requirement = value[skill]
        if not isinstance(requirement, dict):
            invalid_skills.append(skill)
            continue
        if set(requirement) != set(PROJECT_SKILL_LEVEL_KEYS):
            invalid_skills.append(skill)
            continue
        for level_key in PROJECT_SKILL_LEVEL_KEYS:
            if not isinstance(requirement[level_key], int) or requirement[level_key] < 0:
                invalid_levels.append(f"{skill}.{level_key}")

    if invalid_skills:
        sys.exit(
            f"{label} required_skills values must contain level_1, level_2, and level_3: "
            f"{', '.join(invalid_skills)}"
        )
    if invalid_levels:
        sys.exit(
            f"{label} required_skills counts must be non-negative integers: "
            f"{', '.join(invalid_levels)}"
        )


def insert_projects(cursor, projects: list[dict[str, Any]]) -> dict[str, int]:
    sql = """
        INSERT INTO projects (
            project_name, project_description, project_phase,
            icon_url, poster_url, required_people_amount,
            required_skills, github_repositories
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
    """
    name_to_id: dict[str, int] = {}
    for project in projects:
        cursor.execute(
            sql,
            (
                project["project_name"],
                project["project_description"],
                project["project_phase"],
                project["icon_url"],
                project["poster_url"],
                project["required_people_amount"],
                json.dumps(project["required_skills"]),
                json.dumps(project["github_repositories"]),
            ),
        )
        name_to_id[project["project_name"]] = cursor.lastrowid
    return name_to_id


def insert_employees(cursor, employees: list[dict[str, Any]]) -> dict[str, int]:
    sql = """
        INSERT INTO employees (
            name, role, github_username, skills, preferences, interests
        ) VALUES (%s, %s, %s, %s, %s, %s)
    """
    name_to_id: dict[str, int] = {}
    for employee in employees:
        cursor.execute(
            sql,
            (
                employee["name"],
                employee["role"],
                employee.get("github_username"),
                json.dumps(employee["skills"]),
                json.dumps(employee["preferences"]),
                json.dumps(employee["interests"]),
            ),
        )
        name_to_id[employee["name"]] = cursor.lastrowid
    return name_to_id


def employee_current_projects(employee: dict[str, Any]) -> list[str]:
    current_projects = employee.get("current_projects")
    if current_projects is not None:
        return current_projects
    legacy_current_project = employee.get("current_project")
    return [legacy_current_project] if legacy_current_project else []


def insert_project_assignments(
    cursor,
    employees: list[dict[str, Any]],
    employee_ids: dict[str, int],
    project_ids: dict[str, int],
) -> int:
    sql = """
        INSERT INTO project_assignments (employee_id, project_id)
        VALUES (%s, %s)
    """
    count = 0
    for employee in employees:
        employee_id = employee_ids[employee["name"]]
        for project_name in employee_current_projects(employee):
            project_id = project_ids.get(project_name)
            if project_id is None:
                sys.exit(
                    f"Employee {employee['name']!r} references unknown project {project_name!r}"
                )
            cursor.execute(sql, (employee_id, project_id))
            count += 1
    return count


def insert_move_requests(
    cursor,
    move_requests: list[dict[str, Any]],
    employee_ids: dict[str, int],
    project_ids: dict[str, int],
) -> int:
    sql = """
        INSERT INTO move_requests (
            employee_id, from_project_id, to_project_id,
            reason, expected_role,
            current_project_impact, status
        ) VALUES (%s, %s, %s, %s, %s, %s, %s)
    """
    count = 0
    for request in move_requests:
        employee_id = employee_ids.get(request["employee_name"])
        if employee_id is None:
            sys.exit(f"Move request references unknown employee {request['employee_name']!r}")
        to_project_id = project_ids.get(request["to_project_name"])
        if to_project_id is None:
            sys.exit(
                f"Move request references unknown to_project {request['to_project_name']!r}"
            )
        from_project_name = request.get("from_project_name")
        from_project_id = (
            project_ids.get(from_project_name) if from_project_name is not None else None
        )
        if from_project_name is not None and from_project_id is None:
            sys.exit(
                f"Move request references unknown from_project {from_project_name!r}"
            )

        cursor.execute(
            sql,
            (
                employee_id,
                from_project_id,
                to_project_id,
                request["reason"],
                request["expected_role"],
                request["current_project_impact"],
                request["status"],
            ),
        )
        count += 1
    return count


def main() -> None:
    parser = argparse.ArgumentParser(description="Load Atlas seed fixtures into MySQL.")
    parser.add_argument(
        "--fixture",
        type=Path,
        default=DEFAULT_FIXTURE,
        help=f"Path to the fixture JSON (default: {DEFAULT_FIXTURE}).",
    )
    args = parser.parse_args()

    load_dotenv()

    data = load_fixture(args.fixture)

    connection = get_connection()
    try:
        cursor = connection.cursor()
        project_ids = insert_projects(cursor, data["projects"])
        employee_ids = insert_employees(cursor, data["employees"])
        assignment_count = insert_project_assignments(
            cursor, data["employees"], employee_ids, project_ids
        )
        move_count = insert_move_requests(
            cursor, data["move_requests"], employee_ids, project_ids
        )
        connection.commit()
        cursor.close()
        print(
            f"Inserted {len(project_ids)} projects, {len(employee_ids)} employees, "
            f"{assignment_count} assignments, {move_count} move requests from {args.fixture}."
        )
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


if __name__ == "__main__":
    main()
