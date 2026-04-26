"""Upsert mock project documentation into the configured database."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

from load_fixtures import get_connection
from mock_documentation import (
    build_mock_documentation_payload,
    is_mock_documentation_project,
)

REPO_ROOT = Path(__file__).resolve().parents[2]


def decode_json(value: Any) -> Any:
    if isinstance(value, str):
        return json.loads(value)
    return value


def list_projects(cursor) -> list[dict[str, Any]]:
    cursor.execute(
        """
        SELECT
            id, project_name, project_description, project_phase,
            required_people_amount, required_skills, github_repositories
        FROM projects
        ORDER BY id
        """
    )
    projects = []
    for row in cursor.fetchall():
        project = dict(row)
        project["required_skills"] = decode_json(project["required_skills"])
        project["github_repositories"] = decode_json(project["github_repositories"])
        projects.append(project)
    return projects


def upsert_mock_documentation(cursor, projects: list[dict[str, Any]], dry_run: bool) -> list[str]:
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
    updated_projects: list[str] = []
    for project in projects:
        if not is_mock_documentation_project(project):
            continue
        payload = build_mock_documentation_payload(project)
        updated_projects.append(project["project_name"])
        if dry_run:
            continue
        cursor.execute(
            sql,
            (
                project["id"],
                payload["status"],
                payload["content_markdown"],
                json.dumps(payload["source_repositories"]),
                json.dumps(payload["source_snapshot"]),
                json.dumps(payload["model_metadata"]),
                payload["last_error"],
                payload["last_generated_at"],
            ),
        )
    return updated_projects


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Seed ready mock documentation for all non-Mixing Spoons projects."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="List projects that would be updated without writing rows.",
    )
    args = parser.parse_args()

    load_dotenv(REPO_ROOT / ".env")

    connection = get_connection()
    try:
        cursor = connection.cursor(dictionary=True)
        updated_projects = upsert_mock_documentation(
            cursor,
            list_projects(cursor),
            dry_run=args.dry_run,
        )
        if args.dry_run:
            connection.rollback()
        else:
            connection.commit()
        cursor.close()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()

    action = "Would upsert" if args.dry_run else "Upserted"
    print(f"{action} {len(updated_projects)} mock documentation rows.")
    if updated_projects:
        print("Projects: " + ", ".join(updated_projects))


if __name__ == "__main__":
    main()
