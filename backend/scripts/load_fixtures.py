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
    return data


def insert_projects(cursor, projects: list[dict[str, Any]]) -> dict[str, int]:
    sql = """
        INSERT INTO projects (
            project_name, project_description, project_phase,
            current_team_members, required_people_amount,
            required_skills, github_repositories
        ) VALUES (%s, %s, %s, %s, %s, %s, %s)
    """
    name_to_id: dict[str, int] = {}
    for project in projects:
        cursor.execute(
            sql,
            (
                project["project_name"],
                project["project_description"],
                project["project_phase"],
                json.dumps(project["current_team_members"]),
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
            name, role, current_project, skills, preferences, interests
        ) VALUES (%s, %s, %s, %s, %s, %s)
    """
    name_to_id: dict[str, int] = {}
    for employee in employees:
        cursor.execute(
            sql,
            (
                employee["name"],
                employee["role"],
                employee.get("current_project"),
                json.dumps(employee["skills"]),
                json.dumps(employee["preferences"]),
                json.dumps(employee["interests"]),
            ),
        )
        name_to_id[employee["name"]] = cursor.lastrowid
    return name_to_id


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
        move_count = insert_move_requests(
            cursor, data["move_requests"], employee_ids, project_ids
        )
        connection.commit()
        cursor.close()
        print(
            f"Inserted {len(project_ids)} projects, {len(employee_ids)} employees, "
            f"{move_count} move requests from {args.fixture}."
        )
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


if __name__ == "__main__":
    main()
