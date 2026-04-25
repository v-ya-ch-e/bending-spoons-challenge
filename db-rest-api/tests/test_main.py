import json
import sys
from contextlib import contextmanager
from copy import deepcopy
from datetime import datetime
from pathlib import Path
from typing import Any

import pymysql
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import main as api  # noqa: E402


SKILLS = {
    "android": 0,
    "ios": 0,
    "web": 2,
    "backend": 3,
    "infrastructure": 1,
    "ai": 1,
}


def project_payload(name: str = "Atlas Staffing") -> dict[str, Any]:
    return {
        "project_name": name,
        "project_description": "Internal staffing platform.",
        "project_phase": "growth",
        "icon_url": "https://www.google.com/s2/favicons?domain=evernote.com&sz=128",
        "poster_url": "https://image.thum.io/get/width/1200/crop/630/https://evernote.com",
        "required_people_amount": 3,
        "required_skills": deepcopy(SKILLS),
        "github_repositories": ["https://github.com/bendingspoons/atlas-staffing"],
    }


def employee_payload(name: str = "Marco Bianchi") -> dict[str, Any]:
    return {
        "name": name,
        "role": "Backend engineer",
        "skills": deepcopy(SKILLS),
        "preferences": ["Atlas Staffing"],
        "interests": ["platform reliability", "internal tools"],
    }


def move_request_payload(employee_id: int, to_project_id: int) -> dict[str, Any]:
    return {
        "employee_id": employee_id,
        "from_project_id": None,
        "to_project_id": to_project_id,
        "reason": "Backend and infrastructure experience match the project needs.",
        "expected_role": "Backend/platform engineer",
        "current_project_impact": "low",
    }


class FakeCursor:
    def __init__(self, database: "InMemoryDatabase") -> None:
        self.database = database
        self._one: dict[str, Any] | None = None
        self._many: list[dict[str, Any]] = []
        self.lastrowid: int | None = None
        self.rowcount = 0

    def __enter__(self) -> "FakeCursor":
        return self

    def __exit__(self, *_exc: object) -> None:
        return None

    def execute(self, sql: str, params: tuple[Any, ...] | list[Any] = ()) -> None:
        self.database.execute(self, sql, list(params))

    def fetchone(self) -> dict[str, Any] | None:
        return self._one

    def fetchall(self) -> list[dict[str, Any]]:
        return self._many


class FakeConnection:
    def __init__(self, database: "InMemoryDatabase") -> None:
        self.database = database
        self.closed = False

    def cursor(self) -> FakeCursor:
        return FakeCursor(self.database)

    def begin(self) -> None:
        return None

    def commit(self) -> None:
        return None

    def rollback(self) -> None:
        return None

    def close(self) -> None:
        self.closed = True


class InMemoryDatabase:
    def __init__(self) -> None:
        self.projects: list[dict[str, Any]] = []
        self.employees: list[dict[str, Any]] = []
        self.project_assignments: list[dict[str, int]] = []
        self.move_requests: list[dict[str, Any]] = []
        self.next_ids = {"projects": 1, "employees": 1, "move_requests": 1}

    def execute(self, cursor: FakeCursor, sql: str, params: list[Any]) -> None:
        normalized = " ".join(sql.lower().split())
        cursor._one = None
        cursor._many = []
        cursor.lastrowid = None
        cursor.rowcount = 0

        if normalized == "select 1":
            cursor._one = {"1": 1}
            return

        if normalized.startswith("select * from projects order by id"):
            cursor._many = self._limited(self.projects, params)
            return
        if normalized.startswith("select * from projects where id"):
            cursor._one = self._find(self.projects, params[0])
            return
        if normalized.startswith("select id from projects where project_name"):
            cursor._one = next(
                (
                    {"id": project["id"]}
                    for project in self.projects
                    if project["project_name"] == params[0]
                ),
                None,
            )
            return
        if normalized.startswith("insert into projects"):
            self._insert(cursor, sql, params, "projects", unique_field="project_name")
            return
        if normalized.startswith("update projects set"):
            self._update(cursor, sql, params, self.projects)
            return
        if normalized.startswith("delete from projects where id"):
            self._delete(cursor, params[0], self.projects)
            return

        if normalized.startswith("select * from employees order by id"):
            cursor._many = self._limited(self.employees, params)
            return
        if normalized.startswith("select * from employees where id"):
            cursor._one = self._find(self.employees, params[0])
            return
        if normalized.startswith("select id from employees where name"):
            cursor._one = next(
                (
                    {"id": employee["id"]}
                    for employee in self.employees
                    if employee["name"] == params[0]
                ),
                None,
            )
            return
        if normalized.startswith("insert into employees"):
            self._insert(cursor, sql, params, "employees", unique_field="name")
            return
        if normalized.startswith("update employees set"):
            self._update(cursor, sql, params, self.employees)
            return
        if normalized.startswith("delete from employees where id"):
            self._delete(cursor, params[0], self.employees)
            return

        if normalized.startswith("select employee.id, employee.name from project_assignments"):
            cursor._many = self._project_assignment_employees(params[0])
            return
        if normalized.startswith("select project.id, project.project_name from project_assignments"):
            cursor._many = self._project_assignment_projects(params[0])
            return
        if normalized.startswith("delete from project_assignments where project_id"):
            self._delete_project_assignments(cursor, "project_id", params[0])
            return
        if normalized.startswith("delete from project_assignments where employee_id"):
            self._delete_project_assignments(cursor, "employee_id", params[0])
            return
        if normalized.startswith("insert into project_assignments"):
            self._insert_project_assignment(cursor, params)
            return

        if "from move_requests as mr" in normalized and "where mr.id" in normalized:
            cursor._one = self._move_request_row(params[0])
            return
        if "from move_requests as mr" in normalized and "order by mr.id" in normalized:
            cursor._many = self._limited(
                [self._move_request_row(row["id"]) for row in self.move_requests],
                params,
            )
            return
        if normalized.startswith("insert into move_requests"):
            self._insert_move_request(cursor, sql, params)
            return
        if normalized.startswith("update move_requests set"):
            self._update(cursor, sql, params, self.move_requests)
            return
        if normalized.startswith("delete from move_requests where id"):
            self._delete(cursor, params[0], self.move_requests)
            return

        raise AssertionError(f"Unhandled SQL in test fake: {sql}")

    def _limited(self, rows: list[dict[str, Any]], params: list[Any]) -> list[dict[str, Any]]:
        limit, offset = params
        return [deepcopy(row) for row in rows[offset : offset + limit]]

    def _find(self, rows: list[dict[str, Any]], row_id: int) -> dict[str, Any] | None:
        for row in rows:
            if row["id"] == row_id:
                return deepcopy(row)
        return None

    def _insert(
        self,
        cursor: FakeCursor,
        sql: str,
        params: list[Any],
        table: str,
        *,
        unique_field: str,
    ) -> None:
        columns = self._insert_columns(sql)
        row = dict(zip(columns, params, strict=True))
        if any(existing[unique_field] == row[unique_field] for existing in getattr(self, table)):
            raise pymysql.err.IntegrityError(1062, "Duplicate entry")
        row["id"] = self.next_ids[table]
        self.next_ids[table] += 1
        getattr(self, table).append(row)
        cursor.lastrowid = row["id"]
        cursor.rowcount = 1

    def _insert_move_request(self, cursor: FakeCursor, sql: str, params: list[Any]) -> None:
        columns = self._insert_columns(sql)
        row = dict(zip(columns, params, strict=True))
        if self._find(self.employees, row["employee_id"]) is None:
            raise pymysql.err.IntegrityError(1452, "Missing employee")
        if row.get("from_project_id") is not None and self._find(self.projects, row["from_project_id"]) is None:
            raise pymysql.err.IntegrityError(1452, "Missing source project")
        if self._find(self.projects, row["to_project_id"]) is None:
            raise pymysql.err.IntegrityError(1452, "Missing target project")
        row.setdefault("created_at", datetime(2026, 4, 25, 12, 0, 0))
        row.setdefault("responded_at", None)
        row["id"] = self.next_ids["move_requests"]
        self.next_ids["move_requests"] += 1
        self.move_requests.append(row)
        cursor.lastrowid = row["id"]
        cursor.rowcount = 1

    def _update(
        self,
        cursor: FakeCursor,
        sql: str,
        params: list[Any],
        rows: list[dict[str, Any]],
    ) -> None:
        row_id = params[-1]
        row = next((item for item in rows if item["id"] == row_id), None)
        if row is None:
            cursor.rowcount = 0
            return
        columns = self._update_columns(sql)
        for column, value in zip(columns, params[:-1], strict=True):
            row[column] = value
        cursor.rowcount = 1

    def _delete(self, cursor: FakeCursor, row_id: int, rows: list[dict[str, Any]]) -> None:
        original_count = len(rows)
        rows[:] = [row for row in rows if row["id"] != row_id]
        cursor.rowcount = original_count - len(rows)

    def _project_assignment_employees(self, project_id: int) -> list[dict[str, Any]]:
        rows = []
        for assignment in sorted(self.project_assignments, key=lambda row: row["employee_id"]):
            if assignment["project_id"] != project_id:
                continue
            employee = self._find(self.employees, assignment["employee_id"])
            if employee is not None:
                rows.append({"id": employee["id"], "name": employee["name"]})
        return rows

    def _project_assignment_projects(self, employee_id: int) -> list[dict[str, Any]]:
        rows = []
        for assignment in sorted(self.project_assignments, key=lambda row: row["project_id"]):
            if assignment["employee_id"] != employee_id:
                continue
            project = self._find(self.projects, assignment["project_id"])
            if project is not None:
                rows.append({"id": project["id"], "project_name": project["project_name"]})
        return rows

    def _delete_project_assignments(
        self,
        cursor: FakeCursor,
        field: str,
        value: int,
    ) -> None:
        original_count = len(self.project_assignments)
        self.project_assignments[:] = [
            row for row in self.project_assignments if row[field] != value
        ]
        cursor.rowcount = original_count - len(self.project_assignments)

    def _insert_project_assignment(self, cursor: FakeCursor, params: list[Any]) -> None:
        employee_id, project_id = params
        if self._find(self.employees, employee_id) is None:
            raise pymysql.err.IntegrityError(1452, "Missing employee")
        if self._find(self.projects, project_id) is None:
            raise pymysql.err.IntegrityError(1452, "Missing project")
        assignment = {"employee_id": employee_id, "project_id": project_id}
        if assignment not in self.project_assignments:
            self.project_assignments.append(assignment)
        cursor.rowcount = 1

    def _move_request_row(self, request_id: int) -> dict[str, Any] | None:
        request = self._find(self.move_requests, request_id)
        if request is None:
            return None
        employee = self._find(self.employees, request["employee_id"])
        to_project = self._find(self.projects, request["to_project_id"])
        from_project = (
            self._find(self.projects, request["from_project_id"])
            if request.get("from_project_id") is not None
            else None
        )
        if employee is None or to_project is None:
            return None
        return {
            **request,
            "employee_name": employee["name"],
            "from_project_name": from_project["project_name"] if from_project else None,
            "to_project_name": to_project["project_name"],
        }

    def _insert_columns(self, sql: str) -> list[str]:
        start = sql.index("(") + 1
        end = sql.index(")", start)
        return [column.strip(" `\n") for column in sql[start:end].split(",")]

    def _update_columns(self, sql: str) -> list[str]:
        lower_sql = sql.lower()
        start = lower_sql.index(" set ") + len(" set ")
        end = lower_sql.index(" where ", start)
        assignments = sql[start:end].split(",")
        return [assignment.split("=")[0].strip(" `\n") for assignment in assignments]


@pytest.fixture
def fake_db(monkeypatch: pytest.MonkeyPatch) -> InMemoryDatabase:
    database = InMemoryDatabase()

    @contextmanager
    def fake_open_db_connection() -> Any:
        connection = FakeConnection(database)
        try:
            yield connection
        finally:
            connection.close()

    monkeypatch.setattr(api, "open_db_connection", fake_open_db_connection)
    return database


@pytest.fixture
def client(fake_db: InMemoryDatabase) -> TestClient:
    return TestClient(api.app)


def test_metadata_and_openapi_endpoints(client: TestClient) -> None:
    root = client.get("/")
    assert root.status_code == 200
    assert root.json()["service"] == "db-rest-api"
    assert "/projects" in root.json()["endpoints"]

    assert client.get("/health").json() == {"status": "ok"}
    assert client.get("/version").json()["service"] == "db-rest-api"

    openapi = client.get("/openapi.json")
    assert openapi.status_code == 200
    for path in ("/projects", "/employees", "/move-requests"):
        assert path in openapi.json()["paths"]


def test_database_health_success_and_failure(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    assert client.get("/health/db").json() == {"status": "ok"}

    @contextmanager
    def failing_connection() -> Any:
        raise RuntimeError("connection failed")
        yield

    monkeypatch.setattr(api, "open_db_connection", failing_connection)
    response = client.get("/health/db")
    assert response.status_code == 503
    assert response.json() == {"detail": "Database connection failed"}


def test_project_crud_and_validation(client: TestClient) -> None:
    create_response = client.post("/projects", json=project_payload())
    assert create_response.status_code == 201
    project = create_response.json()
    assert project["id"] == 1
    assert project["required_skills"] == SKILLS

    assert client.get("/projects").json() == [project]
    assert client.get("/projects/1").json() == project

    update_response = client.put("/projects/1", json={"project_phase": "maintenance"})
    assert update_response.status_code == 200
    assert update_response.json()["project_phase"] == "maintenance"

    empty_update = client.put("/projects/1", json={})
    assert empty_update.status_code == 422

    duplicate = client.post("/projects", json=project_payload())
    assert duplicate.status_code == 409

    delete_response = client.delete("/projects/1")
    assert delete_response.status_code == 204
    assert client.get("/projects/1").status_code == 404


def test_employee_crud_and_validation(client: TestClient) -> None:
    create_response = client.post("/employees", json=employee_payload())
    assert create_response.status_code == 201
    employee = create_response.json()
    assert employee["id"] == 1
    assert employee["skills"] == SKILLS

    assert client.get("/employees").json() == [employee]
    assert client.get("/employees/1").json() == employee

    update_response = client.put("/employees/1", json={"current_project": None})
    assert update_response.status_code == 200
    assert update_response.json()["current_project"] is None

    invalid_skills = employee_payload("Giulia Rossi")
    invalid_skills["skills"]["backend"] = 4
    assert client.post("/employees", json=invalid_skills).status_code == 422

    duplicate = client.post("/employees", json=employee_payload())
    assert duplicate.status_code == 409

    delete_response = client.delete("/employees/1")
    assert delete_response.status_code == 204
    assert client.get("/employees/1").status_code == 404


def test_move_request_crud_joined_response_and_status_timestamps(client: TestClient) -> None:
    employee_id = client.post("/employees", json=employee_payload()).json()["id"]
    project_id = client.post("/projects", json=project_payload()).json()["id"]

    create_response = client.post(
        "/move-requests",
        json=move_request_payload(employee_id, project_id),
    )
    assert create_response.status_code == 201
    move_request = create_response.json()
    assert move_request["status"] == "pending"
    assert move_request["responded_at"] is None
    assert move_request["employee_name"] == "Marco Bianchi"
    assert move_request["to_project_name"] == "Atlas Staffing"

    assert client.get("/move-requests").json() == [move_request]
    assert client.get("/move-requests/1").json() == move_request

    accepted = client.put("/move-requests/1", json={"status": "accepted"})
    assert accepted.status_code == 200
    assert accepted.json()["status"] == "accepted"
    assert accepted.json()["responded_at"] is not None

    pending = client.put("/move-requests/1", json={"status": "pending"})
    assert pending.status_code == 200
    assert pending.json()["status"] == "pending"
    assert pending.json()["responded_at"] is None

    delete_response = client.delete("/move-requests/1")
    assert delete_response.status_code == 204
    assert client.get("/move-requests/1").status_code == 404


def test_move_request_rejects_missing_foreign_keys(client: TestClient) -> None:
    response = client.post(
        "/move-requests",
        json=move_request_payload(employee_id=999, to_project_id=999),
    )
    assert response.status_code == 400
    assert response.json() == {"detail": "Referenced record does not exist."}


def test_json_column_helpers_round_trip_bytes_and_models() -> None:
    encoded = api.json_column(api.Skills(**SKILLS))
    assert json.loads(encoded) == SKILLS
    assert api.parse_json_column(encoded.encode("utf-8")) == SKILLS
