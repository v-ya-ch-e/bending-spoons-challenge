"""Load Atlas seed fixtures into the configured MySQL database."""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

import mysql.connector
from dotenv import load_dotenv

DEFAULT_FIXTURE = Path(__file__).resolve().parent.parent / "fixtures" / "seed_data.json"
SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from mock_documentation import (  # noqa: E402
    build_mock_documentation_payload,
    is_mock_documentation_project,
)

SKILL_KEYS = ("android", "ios", "web", "backend", "infrastructure", "ai")
PROJECT_SKILL_LEVEL_KEYS = ("level_1", "level_2", "level_3")
FIXTURE_TIMESTAMP = datetime(2026, 4, 25, 12, 0, 0)


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
) -> list[dict[str, Any]]:
    sql = """
        INSERT INTO move_requests (
            employee_id, from_project_id, to_project_id,
            reason, expected_role,
            current_project_impact, status,
            cto_approval_status, cto_approved_at,
            employee_approval_status, employee_approved_at,
            responded_at
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """
    created: list[dict[str, Any]] = []
    for index, request in enumerate(move_requests):
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

        cto_approval_status, employee_approval_status = approval_statuses_for_request(request)
        cto_approved_at = approval_timestamp(index, 0) if cto_approval_status == "approved" else None
        employee_approved_at = (
            approval_timestamp(index, 1) if employee_approval_status == "approved" else None
        )
        responded_at = (
            None
            if request["status"] == "pending"
            else approval_timestamp(index, 2)
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
                cto_approval_status,
                cto_approved_at,
                employee_approval_status,
                employee_approved_at,
                responded_at,
            ),
        )
        created.append(
            {
                **request,
                "id": cursor.lastrowid,
                "employee_id": employee_id,
                "from_project_id": from_project_id,
                "to_project_id": to_project_id,
            }
        )
    return created


def approval_statuses_for_request(request: dict[str, Any]) -> tuple[str, str]:
    cto_status = request.get("cto_approval_status")
    employee_status = request.get("employee_approval_status")
    if cto_status and employee_status:
        return cto_status, employee_status

    status = request["status"]
    if status in {"transition_started", "completed"}:
        return "approved", "approved"
    if status == "accepted":
        return "approved", "pending"
    if status == "rejected":
        return "rejected", "pending"
    return "pending", "pending"


def approval_timestamp(index: int, offset_minutes: int) -> datetime:
    return FIXTURE_TIMESTAMP + timedelta(minutes=(index * 3) + offset_minutes)


def insert_mock_transition_instructions(cursor, move_requests: list[dict[str, Any]]) -> int:
    sql = """
        INSERT INTO move_request_transition_instructions (
            move_request_id, instruction_type, status, content_markdown,
            input_snapshot, model_metadata, solved_at, solved_by_employee_id
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
    """
    count = 0
    for request in move_requests:
        if request["status"] not in {"transition_started", "completed"}:
            continue
        instruction_status = "solved" if request["status"] == "completed" else "ready"
        solved_at = approval_timestamp(request["id"], 0) if instruction_status == "solved" else None
        for instruction_type in ("onboarding", "offboarding"):
            project_name = (
                request["to_project_name"]
                if instruction_type == "onboarding"
                else request.get("from_project_name") or request["to_project_name"]
            )
            cursor.execute(
                sql,
                (
                    request["id"],
                    instruction_type,
                    instruction_status,
                    mock_transition_markdown(request, instruction_type, project_name),
                    json.dumps(
                        {
                            "generated_from": "fixture",
                            "source_project": request.get("from_project_name"),
                            "target_project": request["to_project_name"],
                        }
                    ),
                    json.dumps({"source": "mock_transition_seed"}),
                    solved_at,
                    request["employee_id"] if instruction_status == "solved" else None,
                ),
            )
            count += 1
    return count


def mock_transition_markdown(
    request: dict[str, Any],
    instruction_type: str,
    project_name: str,
) -> str:
    title = "Onboarding" if instruction_type == "onboarding" else "Offboarding"
    return (
        f"# {title}: {project_name}\n\n"
        f"- Review the move reason for {request['employee_name']}: {request['reason']}\n"
        f"- Confirm ownership, documentation links, and first-week checkpoints.\n"
        f"- Expected role: {request['expected_role']}."
    )


def insert_mock_project_documentation(
    cursor,
    projects: list[dict[str, Any]],
    project_ids: dict[str, int],
) -> int:
    sql = """
        INSERT INTO project_documentation (
            project_id, status, content_markdown, source_repositories,
            source_snapshot, model_metadata, last_error, last_generated_at
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE
            status = VALUES(status),
            content_markdown = VALUES(content_markdown),
            source_repositories = VALUES(source_repositories),
            source_snapshot = VALUES(source_snapshot),
            model_metadata = VALUES(model_metadata),
            last_error = VALUES(last_error),
            last_generated_at = VALUES(last_generated_at)
    """
    count = 0
    for project in projects:
        if not is_mock_documentation_project(project):
            continue
        project_id = project_ids[project["project_name"]]
        payload = build_mock_documentation_payload(project)
        cursor.execute(
            sql,
            (
                project_id,
                payload["status"],
                payload["content_markdown"],
                json.dumps(payload["source_repositories"]),
                json.dumps(payload["source_snapshot"]),
                json.dumps(payload["model_metadata"]),
                payload["last_error"],
                payload["last_generated_at"],
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
        move_requests = insert_move_requests(
            cursor, data["move_requests"], employee_ids, project_ids
        )
        documentation_count = insert_mock_project_documentation(
            cursor, data["projects"], project_ids
        )
        transition_instruction_count = insert_mock_transition_instructions(
            cursor, move_requests
        )
        connection.commit()
        cursor.close()
        print(
            f"Inserted {len(project_ids)} projects, {len(employee_ids)} employees, "
            f"{assignment_count} assignments, {len(move_requests)} move requests, "
            f"{documentation_count} mock documentation rows, "
            f"{transition_instruction_count} transition instructions from {args.fixture}."
        )
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


if __name__ == "__main__":
    main()
