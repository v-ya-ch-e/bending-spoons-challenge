import json
import os
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import UTC, datetime
from enum import Enum
from functools import lru_cache
from pathlib import Path
from typing import Any, Iterator, Sequence

import pymysql
from pymysql.connections import Connection
from pymysql.cursors import DictCursor
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query, Response, status
from pydantic import BaseModel, ConfigDict, Field, model_validator


load_dotenv(Path(__file__).resolve().parent.parent / ".env")


SERVICE_NAME = "db-rest-api"
APP_VERSION = os.getenv("APP_VERSION", "0.1.0")
ROOT_PATH = os.getenv("ROOT_PATH", "/db-api")
REQUIRED_DB_ENV_VARS = ("DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD")
MAX_LIST_LIMIT = 500


class ProjectPhase(str, Enum):
    new_acquisition = "new acquisition"
    growth = "growth"
    maintenance = "maintenance"


class CurrentProjectImpact(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"


class MoveRequestStatus(str, Enum):
    pending = "pending"
    accepted = "accepted"
    rejected = "rejected"
    clarification_requested = "clarification_requested"


class ApiModel(BaseModel):
    model_config = ConfigDict(extra="forbid", use_enum_values=True)


class UpdateModel(ApiModel):
    @model_validator(mode="after")
    def require_at_least_one_field(self) -> "UpdateModel":
        if not self.model_fields_set:
            raise ValueError("At least one field must be provided.")
        return self


class Skills(ApiModel):
    android: int = Field(ge=0, le=3)
    ios: int = Field(ge=0, le=3)
    web: int = Field(ge=0, le=3)
    backend: int = Field(ge=0, le=3)
    infrastructure: int = Field(ge=0, le=3)
    ai: int = Field(ge=0, le=3)


class ProjectBase(ApiModel):
    project_name: str = Field(min_length=1, max_length=255)
    project_description: str = Field(min_length=1)
    project_phase: ProjectPhase
    icon_url: str = Field(min_length=1, max_length=2048, pattern=r"^https://")
    poster_url: str = Field(min_length=1, max_length=2048, pattern=r"^https://")
    required_people_amount: int = Field(ge=0)
    required_skills: Skills
    github_repositories: list[str]


class ProjectCreate(ProjectBase):
    current_team_member_ids: list[int] | None = None
    current_team_members: list[str] | None = None


class ProjectUpdate(UpdateModel):
    project_name: str = Field(default=None, min_length=1, max_length=255)
    project_description: str = Field(default=None, min_length=1)
    project_phase: ProjectPhase = None
    icon_url: str = Field(default=None, min_length=1, max_length=2048, pattern=r"^https://")
    poster_url: str = Field(default=None, min_length=1, max_length=2048, pattern=r"^https://")
    current_team_member_ids: list[int] | None = None
    current_team_members: list[str] | None = None
    required_people_amount: int = Field(default=None, ge=0)
    required_skills: Skills = None
    github_repositories: list[str] = None


class Project(ProjectBase):
    id: int
    current_team_member_ids: list[int]
    current_team_members: list[str]


class EmployeeBase(ApiModel):
    name: str = Field(min_length=1, max_length=255)
    role: str = Field(min_length=1, max_length=255)
    skills: Skills
    preferences: list[str]
    interests: list[str]


class EmployeeCreate(EmployeeBase):
    current_project_ids: list[int] | None = None
    current_project: str | None = Field(default=None, max_length=255)


class EmployeeUpdate(UpdateModel):
    name: str = Field(default=None, min_length=1, max_length=255)
    role: str = Field(default=None, min_length=1, max_length=255)
    current_project_ids: list[int] | None = None
    current_project: str | None = Field(default=None, max_length=255)
    skills: Skills = None
    preferences: list[str] = None
    interests: list[str] = None


class Employee(EmployeeBase):
    id: int
    current_project_ids: list[int]
    current_project_names: list[str]
    current_project: str | None


class MoveRequestCreate(ApiModel):
    employee_id: int = Field(gt=0)
    from_project_id: int | None = Field(default=None, gt=0)
    to_project_id: int = Field(gt=0)
    reason: str = Field(min_length=1)
    expected_role: str = Field(min_length=1, max_length=255)
    current_project_impact: CurrentProjectImpact
    status: MoveRequestStatus = MoveRequestStatus.pending


class MoveRequestUpdate(UpdateModel):
    employee_id: int = Field(default=None, gt=0)
    from_project_id: int | None = Field(default=None, gt=0)
    to_project_id: int = Field(default=None, gt=0)
    reason: str = Field(default=None, min_length=1)
    expected_role: str = Field(default=None, min_length=1, max_length=255)
    current_project_impact: CurrentProjectImpact = None
    status: MoveRequestStatus = None


class MoveRequest(ApiModel):
    id: int
    employee_id: int
    employee_name: str
    from_project_id: int | None
    from_project_name: str | None
    to_project_id: int
    to_project_name: str
    reason: str
    expected_role: str
    current_project_impact: CurrentProjectImpact
    status: MoveRequestStatus
    created_at: datetime
    responded_at: datetime | None


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


def json_column(value: Any) -> str:
    if isinstance(value, BaseModel):
        value = value.model_dump(mode="json")
    return json.dumps(value)


def parse_json_column(value: Any) -> Any:
    if value is None or isinstance(value, (dict, list)):
        return value
    if isinstance(value, bytes):
        value = value.decode("utf-8")
    return json.loads(value)


def map_database_error(exc: pymysql.MySQLError) -> HTTPException:
    code = exc.args[0] if exc.args else None
    if isinstance(exc, pymysql.err.IntegrityError):
        if code == 1062:
            return HTTPException(status_code=409, detail="A record with that unique value already exists.")
        if code == 1451:
            return HTTPException(status_code=409, detail="Record is referenced by another record.")
        if code == 1452:
            return HTTPException(status_code=400, detail="Referenced record does not exist.")
        return HTTPException(status_code=400, detail="Database constraint failed.")
    if isinstance(exc, pymysql.err.OperationalError):
        return HTTPException(status_code=503, detail="Database operation failed.")
    return HTTPException(status_code=500, detail="Database operation failed.")


def execute_or_raise(cursor: DictCursor, sql: str, params: Sequence[Any] = ()) -> None:
    try:
        cursor.execute(sql, params)
    except pymysql.MySQLError as exc:
        raise map_database_error(exc) from exc


def unique_int_ids(values: list[int]) -> list[int]:
    unique_values: list[int] = []
    seen = set()
    for value in values:
        if value <= 0:
            raise HTTPException(status_code=422, detail="Project and employee IDs must be positive.")
        if value in seen:
            continue
        unique_values.append(value)
        seen.add(value)
    return unique_values


def serialize_project(
    row: dict[str, Any],
    current_team_member_ids: list[int] | None = None,
    current_team_members: list[str] | None = None,
) -> dict[str, Any]:
    project = dict(row)
    for column in ("required_skills", "github_repositories"):
        project[column] = parse_json_column(project[column])
    project["current_team_member_ids"] = current_team_member_ids or []
    project["current_team_members"] = current_team_members or []
    return project


def serialize_employee(
    row: dict[str, Any],
    current_project_ids: list[int] | None = None,
    current_project_names: list[str] | None = None,
) -> dict[str, Any]:
    employee = dict(row)
    for column in ("skills", "preferences", "interests"):
        employee[column] = parse_json_column(employee[column])
    project_ids = current_project_ids or []
    project_names = current_project_names or []
    employee["current_project_ids"] = project_ids
    employee["current_project_names"] = project_names
    employee["current_project"] = project_names[0] if project_names else None
    return employee


def serialize_move_request(row: dict[str, Any]) -> dict[str, Any]:
    return dict(row)


def fetch_project_assignments(cursor: DictCursor, project_id: int) -> tuple[list[int], list[str]]:
    execute_or_raise(
        cursor,
        """
        SELECT employee.id, employee.name
        FROM project_assignments AS assignment
        INNER JOIN employees AS employee ON employee.id = assignment.employee_id
        WHERE assignment.project_id = %s
        ORDER BY employee.id
        """,
        (project_id,),
    )
    rows = cursor.fetchall()
    return [row["id"] for row in rows], [row["name"] for row in rows]


def fetch_employee_assignments(cursor: DictCursor, employee_id: int) -> tuple[list[int], list[str]]:
    execute_or_raise(
        cursor,
        """
        SELECT project.id, project.project_name
        FROM project_assignments AS assignment
        INNER JOIN projects AS project ON project.id = assignment.project_id
        WHERE assignment.employee_id = %s
        ORDER BY project.id
        """,
        (employee_id,),
    )
    rows = cursor.fetchall()
    return [row["id"] for row in rows], [row["project_name"] for row in rows]


def fetch_project(cursor: DictCursor, project_id: int) -> dict[str, Any]:
    execute_or_raise(cursor, "SELECT * FROM projects WHERE id = %s", (project_id,))
    row = cursor.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Project not found.")
    member_ids, member_names = fetch_project_assignments(cursor, project_id)
    return serialize_project(row, member_ids, member_names)


def fetch_employee(cursor: DictCursor, employee_id: int) -> dict[str, Any]:
    execute_or_raise(cursor, "SELECT * FROM employees WHERE id = %s", (employee_id,))
    row = cursor.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Employee not found.")
    project_ids, project_names = fetch_employee_assignments(cursor, employee_id)
    return serialize_employee(row, project_ids, project_names)


def resolve_employee_ids(cursor: DictCursor, employee_names: list[str] | None) -> list[int]:
    if employee_names is None:
        return []
    employee_ids: list[int] = []
    for employee_name in employee_names:
        execute_or_raise(cursor, "SELECT id FROM employees WHERE name = %s", (employee_name,))
        row = cursor.fetchone()
        if row is None:
            raise HTTPException(status_code=400, detail=f"Unknown employee name: {employee_name}")
        employee_ids.append(row["id"])
    return unique_int_ids(employee_ids)


def resolve_project_ids(cursor: DictCursor, project_names: list[str] | None) -> list[int]:
    if project_names is None:
        return []
    project_ids: list[int] = []
    for project_name in project_names:
        execute_or_raise(cursor, "SELECT id FROM projects WHERE project_name = %s", (project_name,))
        row = cursor.fetchone()
        if row is None:
            raise HTTPException(status_code=400, detail=f"Unknown project name: {project_name}")
        project_ids.append(row["id"])
    return unique_int_ids(project_ids)


MOVE_REQUEST_SELECT = """
    SELECT
        mr.id,
        mr.employee_id,
        employee.name AS employee_name,
        mr.from_project_id,
        from_project.project_name AS from_project_name,
        mr.to_project_id,
        to_project.project_name AS to_project_name,
        mr.reason,
        mr.expected_role,
        mr.current_project_impact,
        mr.status,
        mr.created_at,
        mr.responded_at
    FROM move_requests AS mr
    INNER JOIN employees AS employee ON employee.id = mr.employee_id
    LEFT JOIN projects AS from_project ON from_project.id = mr.from_project_id
    INNER JOIN projects AS to_project ON to_project.id = mr.to_project_id
"""


def fetch_move_request(cursor: DictCursor, request_id: int) -> dict[str, Any]:
    execute_or_raise(
        cursor,
        f"{MOVE_REQUEST_SELECT} WHERE mr.id = %s",
        (request_id,),
    )
    row = cursor.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Move request not found.")
    return serialize_move_request(row)


def model_payload(model: BaseModel, *, exclude_unset: bool = False) -> dict[str, Any]:
    return model.model_dump(mode="json", exclude_unset=exclude_unset)


def update_fields_sql(payload: dict[str, Any]) -> tuple[str, list[Any]]:
    assignments = ", ".join(f"{column} = %s" for column in payload)
    return assignments, list(payload.values())


def extract_project_member_ids(cursor: DictCursor, payload: dict[str, Any]) -> list[int] | None:
    missing = object()
    member_ids = payload.pop("current_team_member_ids", missing)
    member_names = payload.pop("current_team_members", missing)
    if member_ids is not missing:
        if member_ids is None:
            return []
        return unique_int_ids(member_ids)
    if member_names is not missing:
        return resolve_employee_ids(cursor, member_names)
    return None


def extract_employee_project_ids(cursor: DictCursor, payload: dict[str, Any]) -> list[int] | None:
    missing = object()
    project_ids = payload.pop("current_project_ids", missing)
    current_project = payload.pop("current_project", missing)
    if project_ids is not missing:
        if project_ids is None:
            return []
        return unique_int_ids(project_ids)
    if current_project is not missing:
        if current_project is None:
            return []
        return resolve_project_ids(cursor, [current_project])
    return None


def project_payload(payload: dict[str, Any]) -> dict[str, Any]:
    prepared = dict(payload)
    for column in ("required_skills", "github_repositories"):
        if column in prepared:
            prepared[column] = json_column(prepared[column])
    return prepared


def employee_payload(payload: dict[str, Any]) -> dict[str, Any]:
    prepared = dict(payload)
    for column in ("skills", "preferences", "interests"):
        if column in prepared:
            prepared[column] = json_column(prepared[column])
    return prepared


def move_request_payload(payload: dict[str, Any]) -> dict[str, Any]:
    prepared = dict(payload)
    if prepared.get("status") is not None:
        prepared["responded_at"] = (
            None
            if prepared["status"] == MoveRequestStatus.pending.value
            else datetime.now(UTC).replace(tzinfo=None)
        )
    return prepared


def sync_project_members(cursor: DictCursor, project_id: int, employee_ids: list[int]) -> None:
    execute_or_raise(
        cursor,
        "DELETE FROM project_assignments WHERE project_id = %s",
        (project_id,),
    )
    for employee_id in employee_ids:
        execute_or_raise(
            cursor,
            "INSERT INTO project_assignments (employee_id, project_id) VALUES (%s, %s)",
            (employee_id, project_id),
        )


def sync_employee_projects(cursor: DictCursor, employee_id: int, project_ids: list[int]) -> None:
    execute_or_raise(
        cursor,
        "DELETE FROM project_assignments WHERE employee_id = %s",
        (employee_id,),
    )
    for project_id in project_ids:
        execute_or_raise(
            cursor,
            "INSERT INTO project_assignments (employee_id, project_id) VALUES (%s, %s)",
            (employee_id, project_id),
        )

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
        "endpoints": [
            "/health",
            "/health/db",
            "/version",
            "/projects",
            "/employees",
            "/move-requests",
            "/docs",
        ],
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


@app.get("/projects", response_model=list[Project])
def list_projects(
    limit: int = Query(100, ge=1, le=MAX_LIST_LIMIT),
    offset: int = Query(0, ge=0),
) -> list[dict[str, Any]]:
    with open_db_connection() as connection:
        with connection.cursor() as cursor:
            execute_or_raise(
                cursor,
                "SELECT * FROM projects ORDER BY id LIMIT %s OFFSET %s",
                (limit, offset),
            )
            projects = []
            for row in cursor.fetchall():
                member_ids, member_names = fetch_project_assignments(cursor, row["id"])
                projects.append(serialize_project(row, member_ids, member_names))
            return projects


@app.post("/projects", response_model=Project, status_code=status.HTTP_201_CREATED)
def create_project(project: ProjectCreate) -> dict[str, Any]:
    payload = model_payload(project, exclude_unset=True)
    with open_db_connection() as connection:
        with connection.cursor() as cursor:
            try:
                connection.begin()
                member_ids = extract_project_member_ids(cursor, payload) or []
                storage_payload = project_payload(payload)
                columns = ", ".join(storage_payload)
                placeholders = ", ".join(["%s"] * len(storage_payload))
                execute_or_raise(
                    cursor,
                    f"INSERT INTO projects ({columns}) VALUES ({placeholders})",
                    list(storage_payload.values()),
                )
                project_id = cursor.lastrowid
                sync_project_members(cursor, project_id, member_ids)
                created_project = fetch_project(cursor, project_id)
                connection.commit()
                return created_project
            except Exception:
                connection.rollback()
                raise


@app.get("/projects/{project_id}", response_model=Project)
def get_project(project_id: int) -> dict[str, Any]:
    with open_db_connection() as connection:
        with connection.cursor() as cursor:
            return fetch_project(cursor, project_id)


@app.put("/projects/{project_id}", response_model=Project)
def update_project(project_id: int, project: ProjectUpdate) -> dict[str, Any]:
    payload = model_payload(project, exclude_unset=True)
    with open_db_connection() as connection:
        with connection.cursor() as cursor:
            try:
                connection.begin()
                member_ids = extract_project_member_ids(cursor, payload)
                storage_payload = project_payload(payload)
                if storage_payload:
                    assignments, values = update_fields_sql(storage_payload)
                    execute_or_raise(
                        cursor,
                        f"UPDATE projects SET {assignments} WHERE id = %s",
                        [*values, project_id],
                    )
                if member_ids is not None:
                    sync_project_members(cursor, project_id, member_ids)
                updated_project = fetch_project(cursor, project_id)
                connection.commit()
                return updated_project
            except Exception:
                connection.rollback()
                raise


@app.delete("/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(project_id: int) -> Response:
    with open_db_connection() as connection:
        with connection.cursor() as cursor:
            execute_or_raise(cursor, "DELETE FROM projects WHERE id = %s", (project_id,))
            if cursor.rowcount == 0:
                raise HTTPException(status_code=404, detail="Project not found.")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.get("/employees", response_model=list[Employee])
def list_employees(
    limit: int = Query(100, ge=1, le=MAX_LIST_LIMIT),
    offset: int = Query(0, ge=0),
) -> list[dict[str, Any]]:
    with open_db_connection() as connection:
        with connection.cursor() as cursor:
            execute_or_raise(
                cursor,
                "SELECT * FROM employees ORDER BY id LIMIT %s OFFSET %s",
                (limit, offset),
            )
            employees = []
            for row in cursor.fetchall():
                project_ids, project_names = fetch_employee_assignments(cursor, row["id"])
                employees.append(serialize_employee(row, project_ids, project_names))
            return employees


@app.post("/employees", response_model=Employee, status_code=status.HTTP_201_CREATED)
def create_employee(employee: EmployeeCreate) -> dict[str, Any]:
    payload = model_payload(employee, exclude_unset=True)
    with open_db_connection() as connection:
        with connection.cursor() as cursor:
            try:
                connection.begin()
                project_ids = extract_employee_project_ids(cursor, payload) or []
                storage_payload = employee_payload(payload)
                columns = ", ".join(storage_payload)
                placeholders = ", ".join(["%s"] * len(storage_payload))
                execute_or_raise(
                    cursor,
                    f"INSERT INTO employees ({columns}) VALUES ({placeholders})",
                    list(storage_payload.values()),
                )
                employee_id = cursor.lastrowid
                sync_employee_projects(cursor, employee_id, project_ids)
                created_employee = fetch_employee(cursor, employee_id)
                connection.commit()
                return created_employee
            except Exception:
                connection.rollback()
                raise


@app.get("/employees/{employee_id}", response_model=Employee)
def get_employee(employee_id: int) -> dict[str, Any]:
    with open_db_connection() as connection:
        with connection.cursor() as cursor:
            return fetch_employee(cursor, employee_id)


@app.put("/employees/{employee_id}", response_model=Employee)
def update_employee(employee_id: int, employee: EmployeeUpdate) -> dict[str, Any]:
    payload = model_payload(employee, exclude_unset=True)
    with open_db_connection() as connection:
        with connection.cursor() as cursor:
            try:
                connection.begin()
                project_ids = extract_employee_project_ids(cursor, payload)
                storage_payload = employee_payload(payload)
                if storage_payload:
                    assignments, values = update_fields_sql(storage_payload)
                    execute_or_raise(
                        cursor,
                        f"UPDATE employees SET {assignments} WHERE id = %s",
                        [*values, employee_id],
                    )
                if project_ids is not None:
                    sync_employee_projects(cursor, employee_id, project_ids)
                updated_employee = fetch_employee(cursor, employee_id)
                connection.commit()
                return updated_employee
            except Exception:
                connection.rollback()
                raise


@app.delete("/employees/{employee_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_employee(employee_id: int) -> Response:
    with open_db_connection() as connection:
        with connection.cursor() as cursor:
            execute_or_raise(cursor, "DELETE FROM employees WHERE id = %s", (employee_id,))
            if cursor.rowcount == 0:
                raise HTTPException(status_code=404, detail="Employee not found.")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.get("/move-requests", response_model=list[MoveRequest])
def list_move_requests(
    limit: int = Query(100, ge=1, le=MAX_LIST_LIMIT),
    offset: int = Query(0, ge=0),
) -> list[dict[str, Any]]:
    with open_db_connection() as connection:
        with connection.cursor() as cursor:
            execute_or_raise(
                cursor,
                f"{MOVE_REQUEST_SELECT} ORDER BY mr.id LIMIT %s OFFSET %s",
                (limit, offset),
            )
            return [serialize_move_request(row) for row in cursor.fetchall()]


@app.post("/move-requests", response_model=MoveRequest, status_code=status.HTTP_201_CREATED)
def create_move_request(move_request: MoveRequestCreate) -> dict[str, Any]:
    payload = move_request_payload(model_payload(move_request))
    columns = ", ".join(payload)
    placeholders = ", ".join(["%s"] * len(payload))
    with open_db_connection() as connection:
        with connection.cursor() as cursor:
            execute_or_raise(
                cursor,
                f"INSERT INTO move_requests ({columns}) VALUES ({placeholders})",
                list(payload.values()),
            )
            return fetch_move_request(cursor, cursor.lastrowid)


@app.get("/move-requests/{request_id}", response_model=MoveRequest)
def get_move_request(request_id: int) -> dict[str, Any]:
    with open_db_connection() as connection:
        with connection.cursor() as cursor:
            return fetch_move_request(cursor, request_id)


@app.put("/move-requests/{request_id}", response_model=MoveRequest)
def update_move_request(request_id: int, move_request: MoveRequestUpdate) -> dict[str, Any]:
    payload = move_request_payload(model_payload(move_request, exclude_unset=True))
    assignments, values = update_fields_sql(payload)
    with open_db_connection() as connection:
        with connection.cursor() as cursor:
            execute_or_raise(
                cursor,
                f"UPDATE move_requests SET {assignments} WHERE id = %s",
                [*values, request_id],
            )
            return fetch_move_request(cursor, request_id)


@app.delete("/move-requests/{request_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_move_request(request_id: int) -> Response:
    with open_db_connection() as connection:
        with connection.cursor() as cursor:
            execute_or_raise(
                cursor,
                "DELETE FROM move_requests WHERE id = %s",
                (request_id,),
            )
            if cursor.rowcount == 0:
                raise HTTPException(status_code=404, detail="Move request not found.")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
