"""Apply db-rest-api/db/schema.sql to the configured MySQL database."""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

import mysql.connector
from dotenv import load_dotenv

SCHEMA_PATH = Path(__file__).resolve().parent.parent / "db" / "schema.sql"
TABLES_IN_DROP_ORDER = [
    "matching_run_events",
    "matching_hiring_recommendations",
    "matching_recommendations",
    "matching_candidates",
    "matching_runs",
    "policies",
    "move_request_transition_instructions",
    "move_requests",
    "project_documentation",
    "project_assignments",
    "employees",
    "projects",
]


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


def split_statements(sql: str) -> list[str]:
    return [stmt.strip() for stmt in sql.split(";") if stmt.strip()]


def reset_tables(cursor) -> None:
    cursor.execute("SET FOREIGN_KEY_CHECKS = 0")
    for table in TABLES_IN_DROP_ORDER:
        cursor.execute(f"DROP TABLE IF EXISTS {table}")
    cursor.execute("SET FOREIGN_KEY_CHECKS = 1")


def ensure_employee_github_username_column(cursor) -> bool:
    cursor.execute("SHOW COLUMNS FROM employees LIKE 'github_username'")
    if cursor.fetchone() is not None:
        return False

    cursor.execute(
        "ALTER TABLE employees "
        "ADD COLUMN github_username VARCHAR(255) NULL AFTER role"
    )
    return True


def ensure_move_requests_nullable_target(cursor) -> bool:
    cursor.execute("SHOW COLUMNS FROM move_requests LIKE 'to_project_id'")
    column = cursor.fetchone()
    if column is None:
        return False

    cursor.execute(
        """
        SELECT rc.CONSTRAINT_NAME, rc.DELETE_RULE
        FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS AS rc
        INNER JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE AS kcu
            ON kcu.CONSTRAINT_SCHEMA = rc.CONSTRAINT_SCHEMA
            AND kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
        WHERE kcu.TABLE_SCHEMA = DATABASE()
            AND kcu.TABLE_NAME = 'move_requests'
            AND kcu.COLUMN_NAME = 'to_project_id'
            AND kcu.REFERENCED_TABLE_NAME = 'projects'
        LIMIT 1
        """
    )
    constraint = cursor.fetchone()
    constraint_name = constraint[0] if constraint else None
    delete_rule = constraint[1] if constraint else None
    is_nullable = column[2] == "YES"

    if is_nullable and delete_rule == "SET NULL":
        return False

    if constraint_name is not None:
        cursor.execute(f"ALTER TABLE move_requests DROP FOREIGN KEY {constraint_name}")
    if not is_nullable:
        cursor.execute("ALTER TABLE move_requests MODIFY COLUMN to_project_id INT NULL")
    cursor.execute(
        "ALTER TABLE move_requests "
        "ADD CONSTRAINT fk_move_requests_to_project "
        "FOREIGN KEY (to_project_id) REFERENCES projects(id) ON DELETE SET NULL"
    )
    return True


def main() -> None:
    parser = argparse.ArgumentParser(description="Initialize the Atlas demo database.")
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Drop demo tables before recreating them.",
    )
    args = parser.parse_args()

    load_dotenv()

    if not SCHEMA_PATH.exists():
        sys.exit(f"Schema file not found: {SCHEMA_PATH}")

    schema_sql = SCHEMA_PATH.read_text()
    statements = split_statements(schema_sql)

    connection = get_connection()
    try:
        cursor = connection.cursor()
        if args.reset:
            print("Dropping existing demo tables...")
            reset_tables(cursor)
        for statement in statements:
            cursor.execute(statement)
        column_added = ensure_employee_github_username_column(cursor)
        move_target_updated = ensure_move_requests_nullable_target(cursor)
        connection.commit()
        cursor.close()
        print(f"Applied {len(statements)} statement(s) from {SCHEMA_PATH.name}.")
        if column_added:
            print("Added missing employees.github_username column.")
        if move_target_updated:
            print("Updated move_requests.to_project_id to allow offboarding-only requests.")
    finally:
        connection.close()


if __name__ == "__main__":
    main()
