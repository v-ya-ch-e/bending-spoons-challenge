import os
from contextlib import contextmanager
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Iterator

import pymysql
from pymysql.connections import Connection
from pymysql.cursors import DictCursor
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException


load_dotenv(Path(__file__).resolve().parent.parent / ".env")


SERVICE_NAME = "db-rest-api"
APP_VERSION = os.getenv("APP_VERSION", "0.1.0")
ROOT_PATH = os.getenv("ROOT_PATH", "/db-api")
REQUIRED_DB_ENV_VARS = ("DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD")


@dataclass(frozen=True)
class DatabaseSettings:
    host: str
    port: int
    database: str
    user: str
    password: str

    def connect_kwargs(self) -> dict[str, object]:
        return {
            "host": self.host,
            "port": self.port,
            "database": self.database,
            "user": self.user,
            "password": self.password,
            "connect_timeout": 5,
            "cursorclass": DictCursor,
            "charset": "utf8mb4",
            "autocommit": True,
        }


@lru_cache
def get_database_settings() -> DatabaseSettings:
    missing = [name for name in REQUIRED_DB_ENV_VARS if not os.getenv(name)]
    if missing:
        names = ", ".join(missing)
        raise RuntimeError(f"Missing required database environment variables: {names}")

    try:
        port = int(os.environ["DB_PORT"])
    except ValueError as exc:
        raise RuntimeError("DB_PORT must be an integer") from exc

    return DatabaseSettings(
        host=os.environ["DB_HOST"],
        port=port,
        database=os.environ["DB_NAME"],
        user=os.environ["DB_USER"],
        password=os.environ["DB_PASSWORD"],
    )


@contextmanager
def open_db_connection() -> Iterator[Connection]:
    settings = get_database_settings()
    connection = pymysql.connect(**settings.connect_kwargs())
    try:
        yield connection
    finally:
        connection.close()


def get_db_connection() -> Iterator[Connection]:
    with open_db_connection() as connection:
        yield connection

app = FastAPI(
    title="DB REST API",
    version=APP_VERSION,
    root_path=ROOT_PATH,
)


@app.get("/")
def read_root() -> dict[str, Any]:
    return {
        "service": SERVICE_NAME,
        "status": "ok",
        "endpoints": ["/health", "/health/db", "/version", "/docs"],
    }


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/version")
def read_version() -> dict[str, str]:
    return {
        "service": SERVICE_NAME,
        "version": APP_VERSION,
    }


@app.get("/health/db")
def database_health_check() -> dict[str, str]:
    try:
        with open_db_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Database connection failed") from exc

    return {"status": "ok"}
