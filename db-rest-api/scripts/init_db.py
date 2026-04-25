"""Apply db-rest-api/db/schema.sql to the configured MySQL database."""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

import mysql.connector
from dotenv import load_dotenv

SCHEMA_PATH = Path(__file__).resolve().parent.parent / "db" / "schema.sql"
TABLES_IN_DROP_ORDER = ["move_requests", "project_assignments", "employees", "projects"]


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
        connection.commit()
        cursor.close()
        print(f"Applied {len(statements)} statement(s) from {SCHEMA_PATH.name}.")
    finally:
        connection.close()


if __name__ == "__main__":
    main()
