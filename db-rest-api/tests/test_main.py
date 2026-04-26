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

MISSING = object()


SKILLS = {
    "android": 0,
    "ios": 0,
    "web": 2,
    "backend": 3,
    "infrastructure": 1,
    "ai": 1,
}
PROJECT_SKILL_REQUIREMENTS = {
    "android": {"level_1": 0, "level_2": 0, "level_3": 0},
    "ios": {"level_1": 0, "level_2": 0, "level_3": 0},
    "web": {"level_1": 0, "level_2": 1, "level_3": 0},
    "backend": {"level_1": 0, "level_2": 0, "level_3": 1},
    "infrastructure": {"level_1": 1, "level_2": 0, "level_3": 0},
    "ai": {"level_1": 1, "level_2": 0, "level_3": 0},
}

DEFAULT_POLICY_CONFIG = {
    "max_candidate_plans": 25,
    "max_moves": 3,
    "max_projects_in_scope": 8,
    "max_employees_in_scope": 60,
    "max_employee_project_count": 2,
    "minimum_remaining_project_coverage": 0.75,
    "minimum_target_coverage_improvement": 0.1,
    "allow_unassigned_employees": True,
    "allow_multi_project_assignment": True,
    "allow_understaff_current_project": False,
    "exclude_pending_move_requests": True,
    "prefer_employee_preferences": True,
    "emit_hiring_gaps": True,
}
CONSERVATIVE_POLICY_CONFIG = {
    **DEFAULT_POLICY_CONFIG,
    "max_moves": 1,
    "minimum_remaining_project_coverage": 0.85,
}
BALANCED_POLICY_CONFIG = {
    **DEFAULT_POLICY_CONFIG,
    "max_moves": 2,
}
AGGRESSIVE_POLICY_CONFIG = {
    **DEFAULT_POLICY_CONFIG,
    "minimum_remaining_project_coverage": 0.6,
    "allow_understaff_current_project": True,
}


def project_payload(name: str = "Atlas Staffing") -> dict[str, Any]:
    return {
        "project_name": name,
        "project_description": "Internal staffing platform.",
        "project_phase": "growth",
        "icon_url": "https://www.google.com/s2/favicons?domain=evernote.com&sz=128",
        "poster_url": "https://image.thum.io/get/width/1200/crop/630/https://evernote.com",
        "required_people_amount": 3,
        "required_skills": deepcopy(PROJECT_SKILL_REQUIREMENTS),
        "github_repositories": ["https://github.com/bendingspoons/atlas-staffing"],
    }


def documentation_payload(project_id: int) -> dict[str, Any]:
    return {
        "project_id": project_id,
        "status": "running",
        "content_markdown": "",
        "source_repositories": ["https://github.com/bendingspoons/atlas-staffing"],
        "source_snapshot": {"repositories": []},
        "model_metadata": {"model": "gpt-4o"},
    }


def employee_payload(
    name: str = "Marco Bianchi",
    *,
    github_username: str | None | object = "marco-bianchi",
) -> dict[str, Any]:
    payload = {
        "name": name,
        "role": "Backend engineer",
        "skills": deepcopy(SKILLS),
        "preferences": ["Atlas Staffing"],
        "interests": ["platform reliability", "internal tools"],
    }
    if github_username is not MISSING:
        payload["github_username"] = github_username
    return payload


def move_request_payload(employee_id: int, to_project_id: int) -> dict[str, Any]:
    return {
        "employee_id": employee_id,
        "from_project_id": None,
        "to_project_id": to_project_id,
        "reason": "Backend and infrastructure experience match the project needs.",
        "expected_role": "Backend/platform engineer",
        "current_project_impact": "low",
    }


def transition_instruction_payload(
    request_id: int,
    instruction_type: str = "onboarding",
) -> dict[str, Any]:
    return {
        "move_request_id": request_id,
        "instruction_type": instruction_type,
        "status": "ready",
        "content_markdown": "# Transition steps\n\n- Read the docs.",
        "input_snapshot": {"source": "test"},
        "model_metadata": {"model": "gpt-4o"},
    }


def matching_run_payload(target_project_id: int | None = None) -> dict[str, Any]:
    return {
        "use_case": "project_rebalance",
        "target_project_id": target_project_id,
        "status": "pending",
        "requested_by": "cto@example.com",
        "rule_config": {"max_moves": 2},
        "input_snapshot": {"projects": [target_project_id] if target_project_id else []},
    }


def policy_payload(name: str = "Experimental strict matching") -> dict[str, Any]:
    return {
        "name": name,
        "description": "Experimental matching defaults for staffing recommendations.",
        "config": {**DEFAULT_POLICY_CONFIG, "max_moves": 2},
        "is_active": False,
    }


def matching_candidate_payload() -> dict[str, Any]:
    return {
        "candidate_plan_id": "plan_01",
        "strict_score": 0.82,
        "hard_rule_summary": {"valid": True},
        "plan_payload": {"moves": []},
    }


def matching_recommendation_payload(
    employee_id: int,
    from_project_id: int | None,
    to_project_id: int,
) -> dict[str, Any]:
    return {
        "candidate_plan_id": "plan_01",
        "rank": 1,
        "fit_score": 0.91,
        "summary": "Best low-disruption staffing option.",
        "explanation": "Covers the target backend gap.",
        "risks": ["Source project remains covered."],
        "ramp_up_estimate": "3-5 days",
        "suggested_moves": [
            {
                "employee_id": employee_id,
                "from_project_id": from_project_id,
                "to_project_id": to_project_id,
                "suggested_role": "Backend/platform engineer",
                "current_project_impact": "low",
                "move_request_reason": "Backend skills match the target project.",
            }
        ],
        "model_metadata": {"model": "gpt-4o", "prompt_version": "matching_llm_evaluator_v1"},
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
        self.project_documentation: list[dict[str, Any]] = []
        self.employees: list[dict[str, Any]] = []
        self.project_assignments: list[dict[str, int]] = []
        self.move_requests: list[dict[str, Any]] = []
        self.move_request_transition_instructions: list[dict[str, Any]] = []
        self.matching_runs: list[dict[str, Any]] = []
        self.matching_candidates: list[dict[str, Any]] = []
        self.matching_recommendations: list[dict[str, Any]] = []
        self.matching_hiring_recommendations: list[dict[str, Any]] = []
        self.matching_run_events: list[dict[str, Any]] = []
        self.policies: list[dict[str, Any]] = [
            {
                "id": 1,
                "name": "Conservative strict matching",
                "description": "Minimizes disruption by limiting moves and protecting current project coverage.",
                "config": deepcopy(CONSERVATIVE_POLICY_CONFIG),
                "is_active": False,
                "created_at": datetime(2026, 4, 25, 12, 0, 0),
                "updated_at": datetime(2026, 4, 25, 12, 0, 0),
                "activated_at": None,
            },
            {
                "id": 2,
                "name": "Balanced strict matching",
                "description": "Balanced matching defaults for demos and normal staffing planning.",
                "config": deepcopy(BALANCED_POLICY_CONFIG),
                "is_active": True,
                "created_at": datetime(2026, 4, 25, 12, 0, 0),
                "updated_at": datetime(2026, 4, 25, 12, 0, 0),
                "activated_at": datetime(2026, 4, 25, 12, 0, 0),
            },
            {
                "id": 3,
                "name": "Aggressive strict matching",
                "description": "Prioritizes urgent strategic staffing by allowing more source-project risk.",
                "config": deepcopy(AGGRESSIVE_POLICY_CONFIG),
                "is_active": False,
                "created_at": datetime(2026, 4, 25, 12, 0, 0),
                "updated_at": datetime(2026, 4, 25, 12, 0, 0),
                "activated_at": None,
            },
        ]
        self.next_ids = {
            "projects": 1,
            "project_documentation": 1,
            "employees": 1,
            "move_requests": 1,
            "move_request_transition_instructions": 1,
            "policies": 4,
            "matching_runs": 1,
            "matching_candidates": 1,
            "matching_recommendations": 1,
            "matching_hiring_recommendations": 1,
            "matching_run_events": 1,
        }

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

        if "from project_documentation as doc" in normalized:
            if "where doc.id" in normalized:
                cursor._one = self._project_documentation_row(
                    next(
                        (row for row in self.project_documentation if row["id"] == params[0]),
                        None,
                    )
                )
            elif "where doc.project_id" in normalized:
                cursor._one = self._project_documentation_row(
                    next(
                        (
                            row
                            for row in self.project_documentation
                            if row["project_id"] == params[0]
                        ),
                        None,
                    )
                )
            else:
                cursor._many = self._limited(
                    [
                        row
                        for row in (
                            self._project_documentation_row(doc)
                            for doc in self.project_documentation
                        )
                        if row is not None
                    ],
                    params,
                )
            return
        if normalized.startswith("insert into project_documentation"):
            self._insert_project_documentation(cursor, sql, params)
            return
        if normalized.startswith("update project_documentation set") and "where project_id" in normalized:
            self._update_project_documentation_by_project(cursor, sql, params)
            return
        if normalized.startswith("update project_documentation set"):
            self._update(cursor, sql, params, self.project_documentation)
            return
        if normalized.startswith("delete from project_documentation where id"):
            self._delete(cursor, params[0], self.project_documentation)
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

        if "from move_request_transition_instructions as instruction" in normalized:
            if "where instruction.id" in normalized:
                cursor._one = self._transition_instruction_row(
                    next(
                        (
                            row
                            for row in self.move_request_transition_instructions
                            if row["id"] == params[0]
                        ),
                        None,
                    )
                )
            elif "where mr.employee_id" in normalized:
                employee_id = params[0]
                param_index = 1
                instruction_type = None
                if "instruction.instruction_type" in normalized:
                    instruction_type = params[param_index]
                    param_index += 1
                excluded_status = None
                if "mr.status !=" in normalized:
                    excluded_status = params[param_index]
                    param_index += 1
                limit_params = params[param_index:]
                rows = [
                    row
                    for row in (
                        self._transition_instruction_row(instruction)
                        for instruction in self.move_request_transition_instructions
                    )
                    if row is not None
                    and row["employee_id"] == employee_id
                    and (
                        instruction_type is None
                        or row["instruction_type"] == instruction_type
                    )
                    and (
                        excluded_status is None
                        or self._find(self.move_requests, row["move_request_id"])["status"]
                        != excluded_status
                    )
                ]
                cursor._many = self._limited(rows, limit_params)
            elif "where instruction.move_request_id" in normalized:
                cursor._one = self._transition_instruction_row(
                    next(
                        (
                            row
                            for row in self.move_request_transition_instructions
                            if row["move_request_id"] == params[0]
                            and row["instruction_type"] == params[1]
                        ),
                        None,
                    )
                )
            else:
                cursor._many = self._limited(
                    [
                        row
                        for row in (
                            self._transition_instruction_row(instruction)
                            for instruction in self.move_request_transition_instructions
                        )
                        if row is not None
                    ],
                    params,
                )
            return
        if normalized.startswith("select instruction_type, status from move_request_transition_instructions"):
            cursor._many = [
                {
                    "instruction_type": row["instruction_type"],
                    "status": row["status"],
                }
                for row in self.move_request_transition_instructions
                if row["move_request_id"] == params[0]
            ]
            return
        if normalized.startswith("insert into move_request_transition_instructions"):
            self._insert_transition_instruction(cursor, sql, params)
            return
        if (
            normalized.startswith("update move_request_transition_instructions set")
            and "where move_request_id" in normalized
        ):
            self._update_transition_instruction_by_move_request(cursor, sql, params)
            return
        if normalized.startswith("update move_request_transition_instructions set"):
            self._update(cursor, sql, params, self.move_request_transition_instructions)
            return
        if normalized.startswith("delete from move_request_transition_instructions where id"):
            self._delete(cursor, params[0], self.move_request_transition_instructions)
            return

        if normalized.startswith("select * from policies where is_active"):
            active_policies = [row for row in self.policies if row["is_active"]]
            cursor._one = deepcopy(
                sorted(active_policies, key=lambda row: row["id"])[-1]
            ) if active_policies else None
            return
        if normalized.startswith("select * from policies where name"):
            rows = [row for row in self.policies if row["name"] == params[0]]
            cursor._many = self._limited(rows, params[1:])
            return
        if normalized.startswith("select * from policies order by id"):
            cursor._many = self._limited(self.policies, params)
            return
        if normalized.startswith("select * from policies where id"):
            cursor._one = self._find(self.policies, params[0])
            return
        if normalized.startswith("insert into policies"):
            self._insert_policy(cursor, sql, params)
            return
        if normalized.startswith("update policies set is_active = false") and "where" not in normalized:
            for policy in self.policies:
                policy["is_active"] = False
            cursor.rowcount = len(self.policies)
            return
        if normalized.startswith("update policies set"):
            self._update(cursor, sql, params, self.policies)
            return
        if normalized.startswith("delete from policies where id"):
            self._delete(cursor, params[0], self.policies)
            return

        if normalized.startswith("select * from matching_runs where id"):
            cursor._one = self._find(self.matching_runs, params[0])
            return
        if normalized.startswith("select * from matching_runs where use_case"):
            rows = [row for row in self.matching_runs if row["use_case"] == params[0]]
            if "target_project_id" in normalized:
                rows = [row for row in rows if row.get("target_project_id") == params[1]]
            if "order by created_at desc" in normalized:
                cursor._one = deepcopy(sorted(rows, key=lambda row: row["id"])[-1]) if rows else None
            else:
                cursor._many = self._limited(rows, params[-2:])
            return
        if normalized.startswith("select * from matching_runs where target_project_id"):
            rows = [
                row for row in self.matching_runs if row.get("target_project_id") == params[0]
            ]
            cursor._one = deepcopy(sorted(rows, key=lambda row: row["id"])[-1]) if rows else None
            return
        if normalized.startswith("select * from matching_runs order by id"):
            cursor._many = self._limited(self.matching_runs, params)
            return
        if normalized.startswith("insert into matching_runs"):
            self._insert_matching_row(cursor, sql, params, "matching_runs")
            return
        if normalized.startswith("update matching_runs set"):
            self._update(cursor, sql, params, self.matching_runs)
            return
        if normalized.startswith("delete from matching_runs where id"):
            self._delete_matching_run(cursor, params[0])
            return

        if normalized.startswith("select * from matching_candidates where id"):
            cursor._one = self._find(self.matching_candidates, params[0])
            return
        if normalized.startswith("select * from matching_candidates where run_id"):
            rows = [row for row in self.matching_candidates if row["run_id"] == params[0]]
            cursor._many = self._limited(rows, params[1:])
            return
        if normalized.startswith("insert into matching_candidates"):
            self._insert_matching_child(cursor, sql, params, "matching_candidates")
            return

        if normalized.startswith("select * from matching_recommendations where id"):
            cursor._one = self._find(self.matching_recommendations, params[0])
            return
        if normalized.startswith(
            "select * from matching_recommendations where run_id = %s and candidate_plan_id"
        ):
            cursor._one = next(
                (
                    deepcopy(row)
                    for row in self.matching_recommendations
                    if row["run_id"] == params[0] and row["candidate_plan_id"] == params[1]
                ),
                None,
            )
            return
        if normalized.startswith("select * from matching_recommendations where run_id"):
            rows = [row for row in self.matching_recommendations if row["run_id"] == params[0]]
            rows = sorted(rows, key=lambda row: row["recommendation_rank"])
            cursor._many = self._limited(rows, params[1:])
            return
        if normalized.startswith("insert into matching_recommendations"):
            self._insert_matching_child(cursor, sql, params, "matching_recommendations")
            return

        if normalized.startswith("select * from matching_hiring_recommendations where id"):
            cursor._one = self._find(self.matching_hiring_recommendations, params[0])
            return
        if normalized.startswith("select * from matching_hiring_recommendations where run_id"):
            rows = [
                row for row in self.matching_hiring_recommendations if row["run_id"] == params[0]
            ]
            cursor._many = self._limited(rows, params[1:])
            return
        if normalized.startswith("insert into matching_hiring_recommendations"):
            self._insert_matching_child(
                cursor,
                sql,
                params,
                "matching_hiring_recommendations",
                project_field="project_id",
            )
            return

        if normalized.startswith("select * from matching_run_events where id"):
            cursor._one = self._find(self.matching_run_events, params[0])
            return
        if normalized.startswith("select * from matching_run_events where run_id"):
            rows = [row for row in self.matching_run_events if row["run_id"] == params[0]]
            cursor._many = self._limited(rows, params[1:])
            return
        if normalized.startswith("insert into matching_run_events"):
            self._insert_matching_child(cursor, sql, params, "matching_run_events")
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

    def _insert_project_documentation(
        self,
        cursor: FakeCursor,
        sql: str,
        params: list[Any],
    ) -> None:
        columns = self._insert_columns(sql)
        row = dict(zip(columns, params, strict=True))
        if self._find(self.projects, row["project_id"]) is None:
            raise pymysql.err.IntegrityError(1452, "Missing project")
        if any(existing["project_id"] == row["project_id"] for existing in self.project_documentation):
            raise pymysql.err.IntegrityError(1062, "Duplicate entry")
        row.setdefault("status", "pending")
        row.setdefault("content_markdown", "")
        row.setdefault("source_repositories", json.dumps([]))
        row.setdefault("source_snapshot", None)
        row.setdefault("model_metadata", None)
        row.setdefault("last_error", None)
        row.setdefault("last_generated_at", None)
        row.setdefault("created_at", datetime(2026, 4, 25, 12, 0, 0))
        row.setdefault("updated_at", datetime(2026, 4, 25, 12, 0, 0))
        row["id"] = self.next_ids["project_documentation"]
        self.next_ids["project_documentation"] += 1
        self.project_documentation.append(row)
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
        row.setdefault("cto_approval_status", "pending")
        row.setdefault("cto_approved_at", None)
        row.setdefault("employee_approval_status", "pending")
        row.setdefault("employee_approved_at", None)
        row.setdefault("created_at", datetime(2026, 4, 25, 12, 0, 0))
        row.setdefault("responded_at", None)
        row["id"] = self.next_ids["move_requests"]
        self.next_ids["move_requests"] += 1
        self.move_requests.append(row)
        cursor.lastrowid = row["id"]
        cursor.rowcount = 1

    def _insert_transition_instruction(
        self,
        cursor: FakeCursor,
        sql: str,
        params: list[Any],
    ) -> None:
        columns = self._insert_columns(sql)
        row = dict(zip(columns, params, strict=True))
        if self._find(self.move_requests, row["move_request_id"]) is None:
            raise pymysql.err.IntegrityError(1452, "Missing move request")
        if any(
            existing["move_request_id"] == row["move_request_id"]
            and existing["instruction_type"] == row["instruction_type"]
            for existing in self.move_request_transition_instructions
        ):
            raise pymysql.err.IntegrityError(1062, "Duplicate entry")
        row.setdefault("status", "pending")
        row.setdefault("content_markdown", "")
        row.setdefault("input_snapshot", None)
        row.setdefault("source_documentation_id", None)
        row.setdefault("source_documentation_updated_at", None)
        row.setdefault("model_metadata", None)
        row.setdefault("last_error", None)
        row.setdefault("solved_at", None)
        row.setdefault("solved_by_employee_id", None)
        row.setdefault("created_at", datetime(2026, 4, 25, 12, 0, 0))
        row.setdefault("updated_at", datetime(2026, 4, 25, 12, 0, 0))
        row["id"] = self.next_ids["move_request_transition_instructions"]
        self.next_ids["move_request_transition_instructions"] += 1
        self.move_request_transition_instructions.append(row)
        cursor.lastrowid = row["id"]
        cursor.rowcount = 1

    def _insert_policy(self, cursor: FakeCursor, sql: str, params: list[Any]) -> None:
        columns = self._insert_columns(sql)
        row = dict(zip(columns, params, strict=True))
        if any(existing["name"] == row["name"] for existing in self.policies):
            raise pymysql.err.IntegrityError(1062, "Duplicate entry")
        row.setdefault("description", None)
        row.setdefault("is_active", False)
        row.setdefault("created_at", datetime(2026, 4, 25, 12, 0, 0))
        row.setdefault("updated_at", datetime(2026, 4, 25, 12, 0, 0))
        row.setdefault("activated_at", None)
        row["id"] = self.next_ids["policies"]
        self.next_ids["policies"] += 1
        self.policies.append(row)
        cursor.lastrowid = row["id"]
        cursor.rowcount = 1

    def _insert_matching_row(
        self,
        cursor: FakeCursor,
        sql: str,
        params: list[Any],
        table: str,
    ) -> None:
        columns = self._insert_columns(sql)
        row = dict(zip(columns, params, strict=True))
        if row.get("target_project_id") is not None and self._find(self.projects, row["target_project_id"]) is None:
            raise pymysql.err.IntegrityError(1452, "Missing target project")
        row.setdefault("candidate_count", 0)
        row.setdefault("recommendation_count", 0)
        row.setdefault("hiring_recommendation_count", 0)
        row.setdefault("created_at", datetime(2026, 4, 25, 12, 0, 0))
        row.setdefault("started_at", None)
        row.setdefault("completed_at", None)
        row.setdefault("summary", None)
        row.setdefault("error_message", None)
        row.setdefault("selected_candidate_plan_id", None)
        row["id"] = self.next_ids[table]
        self.next_ids[table] += 1
        getattr(self, table).append(row)
        cursor.lastrowid = row["id"]
        cursor.rowcount = 1

    def _insert_matching_child(
        self,
        cursor: FakeCursor,
        sql: str,
        params: list[Any],
        table: str,
        *,
        project_field: str | None = None,
    ) -> None:
        columns = self._insert_columns(sql)
        row = dict(zip(columns, params, strict=True))
        if self._find(self.matching_runs, row["run_id"]) is None:
            raise pymysql.err.IntegrityError(1452, "Missing matching run")
        if project_field and row.get(project_field) is not None and self._find(self.projects, row[project_field]) is None:
            raise pymysql.err.IntegrityError(1452, "Missing project")
        row.setdefault("created_at", datetime(2026, 4, 25, 12, 0, 0))
        row["id"] = self.next_ids[table]
        self.next_ids[table] += 1
        getattr(self, table).append(row)
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

    def _update_project_documentation_by_project(
        self,
        cursor: FakeCursor,
        sql: str,
        params: list[Any],
    ) -> None:
        project_id = params[-1]
        row = next(
            (item for item in self.project_documentation if item["project_id"] == project_id),
            None,
        )
        if row is None:
            cursor.rowcount = 0
            return
        columns = self._update_columns(sql)
        for column, value in zip(columns, params[:-1], strict=True):
            row[column] = value
        cursor.rowcount = 1

    def _update_transition_instruction_by_move_request(
        self,
        cursor: FakeCursor,
        sql: str,
        params: list[Any],
    ) -> None:
        move_request_id = params[-2]
        instruction_type = params[-1]
        row = next(
            (
                item
                for item in self.move_request_transition_instructions
                if item["move_request_id"] == move_request_id
                and item["instruction_type"] == instruction_type
            ),
            None,
        )
        if row is None:
            cursor.rowcount = 0
            return
        columns = self._update_columns(sql)
        for column, value in zip(columns, params[:-2], strict=True):
            row[column] = value
        cursor.rowcount = 1

    def _delete(self, cursor: FakeCursor, row_id: int, rows: list[dict[str, Any]]) -> None:
        original_count = len(rows)
        rows[:] = [row for row in rows if row["id"] != row_id]
        cursor.rowcount = original_count - len(rows)

    def _delete_matching_run(self, cursor: FakeCursor, run_id: int) -> None:
        self.matching_candidates[:] = [
            row for row in self.matching_candidates if row["run_id"] != run_id
        ]
        self.matching_recommendations[:] = [
            row for row in self.matching_recommendations if row["run_id"] != run_id
        ]
        self.matching_hiring_recommendations[:] = [
            row for row in self.matching_hiring_recommendations if row["run_id"] != run_id
        ]
        self.matching_run_events[:] = [
            row for row in self.matching_run_events if row["run_id"] != run_id
        ]
        self._delete(cursor, run_id, self.matching_runs)

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

    def _project_documentation_row(
        self,
        documentation: dict[str, Any] | None,
    ) -> dict[str, Any] | None:
        if documentation is None:
            return None
        project = self._find(self.projects, documentation["project_id"])
        if project is None:
            return None
        return {
            **deepcopy(documentation),
            "project_name": project["project_name"],
        }

    def _transition_instruction_row(
        self,
        instruction: dict[str, Any] | None,
    ) -> dict[str, Any] | None:
        if instruction is None:
            return None
        move_request = self._move_request_row(instruction["move_request_id"])
        if move_request is None:
            return None
        return {
            **deepcopy(instruction),
            "employee_id": move_request["employee_id"],
            "employee_name": move_request["employee_name"],
            "from_project_id": move_request["from_project_id"],
            "from_project_name": move_request["from_project_name"],
            "to_project_id": move_request["to_project_id"],
            "to_project_name": move_request["to_project_name"],
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
    for path in (
        "/projects",
        "/project-documentation",
        "/projects/{project_id}/documentation",
        "/employees",
        "/employees/{employee_id}/transition-instructions",
        "/move-requests",
        "/move-requests/{request_id}/approval",
        "/move-request-transition-instructions",
        "/move-requests/{request_id}/transition-instructions/{instruction_type}",
        "/move-requests/{request_id}/transition-instructions/{instruction_type}:solve",
        "/policies",
        "/policies/active",
        "/matching-runs",
        "/matching-runs/{run_id}/recommendations",
    ):
        assert path in openapi.json()["paths"]


def test_policy_crud_activation_and_active_delete_rejection(client: TestClient) -> None:
    active_policy = client.get("/policies/active")
    assert active_policy.status_code == 200
    assert active_policy.json()["name"] == "Balanced strict matching"
    assert active_policy.json()["config"] == BALANCED_POLICY_CONFIG
    assert client.get("/policies", params={"name": "Balanced strict matching"}).json() == [
        active_policy.json()
    ]

    create_response = client.post("/policies", json=policy_payload())
    assert create_response.status_code == 201
    policy = create_response.json()
    assert policy["id"] == 4
    assert policy["config"]["max_moves"] == 2
    assert policy["is_active"] is False

    policies = client.get("/policies").json()
    assert [policy["name"] for policy in policies] == [
        "Conservative strict matching",
        "Balanced strict matching",
        "Aggressive strict matching",
        "Experimental strict matching",
    ]
    assert client.get("/policies/4").json() == policy

    update_response = client.put(
        "/policies/4",
        json={
            "description": "More conservative moves.",
            "config": {**DEFAULT_POLICY_CONFIG, "max_moves": 1},
        },
    )
    assert update_response.status_code == 200
    assert update_response.json()["description"] == "More conservative moves."
    assert update_response.json()["config"]["max_moves"] == 1

    activate_response = client.post("/policies/4:activate")
    assert activate_response.status_code == 200
    assert activate_response.json()["is_active"] is True
    assert client.get("/policies/active").json()["id"] == 4
    assert client.get("/policies/2").json()["is_active"] is False

    active_delete = client.delete("/policies/4")
    assert active_delete.status_code == 409
    assert active_delete.json() == {"detail": "Active policy cannot be deleted."}

    inactive_delete = client.delete("/policies/1")
    assert inactive_delete.status_code == 204
    assert client.get("/policies/1").status_code == 404


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
    assert project["required_skills"] == PROJECT_SKILL_REQUIREMENTS

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


def test_project_documentation_crud_and_project_upsert(client: TestClient) -> None:
    project_id = client.post("/projects", json=project_payload()).json()["id"]

    create_response = client.post(
        "/project-documentation",
        json=documentation_payload(project_id),
    )
    assert create_response.status_code == 201
    documentation = create_response.json()
    assert documentation["id"] == 1
    assert documentation["project_id"] == project_id
    assert documentation["project_name"] == "Atlas Staffing"
    assert documentation["status"] == "running"
    assert documentation["source_repositories"] == [
        "https://github.com/bendingspoons/atlas-staffing"
    ]
    assert documentation["source_snapshot"] == {"repositories": []}

    assert client.get("/project-documentation").json() == [documentation]
    assert client.get("/project-documentation/1").json() == documentation
    assert client.get(f"/projects/{project_id}/documentation").json() == documentation

    ready_response = client.put(
        f"/projects/{project_id}/documentation",
        json={
            "status": "ready",
            "content_markdown": "# Atlas Staffing\n\nGenerated docs.",
            "source_snapshot": {"repositories": [{"name": "atlas-staffing"}]},
            "last_error": None,
        },
    )
    assert ready_response.status_code == 200
    ready = ready_response.json()
    assert ready["status"] == "ready"
    assert ready["content_markdown"].startswith("# Atlas Staffing")
    assert ready["source_snapshot"] == {"repositories": [{"name": "atlas-staffing"}]}

    duplicate = client.post("/project-documentation", json=documentation_payload(project_id))
    assert duplicate.status_code == 409

    second_project_id = client.post("/projects", json=project_payload("Second")).json()["id"]
    upsert_create = client.put(
        f"/projects/{second_project_id}/documentation",
        json={"status": "pending", "content_markdown": "Queued."},
    )
    assert upsert_create.status_code == 201
    assert upsert_create.json()["project_id"] == second_project_id

    missing_project = client.put(
        "/projects/999/documentation",
        json={"status": "pending"},
    )
    assert missing_project.status_code == 404

    delete_response = client.delete("/project-documentation/1")
    assert delete_response.status_code == 204
    assert client.get("/project-documentation/1").status_code == 404


def test_employee_crud_and_validation(client: TestClient) -> None:
    create_response = client.post("/employees", json=employee_payload())
    assert create_response.status_code == 201
    employee = create_response.json()
    assert employee["id"] == 1
    assert employee["github_username"] == "marco-bianchi"
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


def test_employee_github_username_is_optional_and_normalized(client: TestClient) -> None:
    create_without_username = client.post(
        "/employees",
        json=employee_payload("Giulia Rossi", github_username=MISSING),
    )
    assert create_without_username.status_code == 201
    assert create_without_username.json()["github_username"] is None

    create_with_at_prefix = client.post(
        "/employees",
        json=employee_payload("Luca Fontana", github_username="@luca-fontana"),
    )
    assert create_with_at_prefix.status_code == 201
    assert create_with_at_prefix.json()["github_username"] == "luca-fontana"

    cleared = client.put("/employees/2", json={"github_username": "   "})
    assert cleared.status_code == 200
    assert cleared.json()["github_username"] is None


def test_employee_list_strips_unexpected_columns_from_raw_rows(
    client: TestClient,
    fake_db: InMemoryDatabase,
) -> None:
    fake_db.employees.append(
        {
            "id": 1,
            "name": "Luca Fontana",
            "role": "Backend engineer",
            "github_username": "luca-fontana",
            "skills": json.dumps(SKILLS),
            "preferences": json.dumps(["Atlas Staffing"]),
            "interests": json.dumps(["platform reliability"]),
            "unexpected_column": "ignored",
        }
    )

    employees = client.get("/employees").json()
    assert employees == [
        {
            "id": 1,
            "name": "Luca Fontana",
            "role": "Backend engineer",
            "github_username": "luca-fontana",
            "skills": SKILLS,
            "preferences": ["Atlas Staffing"],
            "interests": ["platform reliability"],
            "current_project_ids": [],
            "current_project_names": [],
            "current_project": None,
        }
    ]


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
    assert move_request["cto_approval_status"] == "pending"
    assert move_request["employee_approval_status"] == "pending"
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

    cto_approval = client.post(
        "/move-requests/1/approval",
        json={"approver": "cto", "approval_status": "approved"},
    )
    assert cto_approval.status_code == 200
    assert cto_approval.json()["status"] == "accepted"
    assert cto_approval.json()["cto_approval_status"] == "approved"
    assert cto_approval.json()["cto_approved_at"] is not None

    employee_approval = client.post(
        "/move-requests/1/approval",
        json={"approver": "employee", "approval_status": "approved"},
    )
    assert employee_approval.status_code == 200
    assert employee_approval.json()["status"] == "transition_started"
    assert employee_approval.json()["employee_approval_status"] == "approved"

    start_response = client.post("/move-requests/1:start-transition")
    assert start_response.status_code == 200
    assert start_response.json()["status"] == "transition_started"

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


def test_transition_instruction_crud_solve_and_completion(client: TestClient) -> None:
    employee_id = client.post("/employees", json=employee_payload()).json()["id"]
    source_project_id = client.post("/projects", json=project_payload("Source")).json()["id"]
    project_id = client.post("/projects", json=project_payload()).json()["id"]
    client.put(f"/employees/{employee_id}", json={"current_project_ids": [source_project_id]})
    request_payload = move_request_payload(employee_id, project_id)
    request_payload["from_project_id"] = source_project_id
    request_id = client.post(
        "/move-requests",
        json=request_payload,
    ).json()["id"]

    create_response = client.post(
        "/move-request-transition-instructions",
        json=transition_instruction_payload(request_id, "onboarding"),
    )
    assert create_response.status_code == 201
    onboarding = create_response.json()
    assert onboarding["id"] == 1
    assert onboarding["move_request_id"] == request_id
    assert onboarding["employee_name"] == "Marco Bianchi"
    assert onboarding["to_project_name"] == "Atlas Staffing"
    assert onboarding["input_snapshot"] == {"source": "test"}

    assert client.get("/move-request-transition-instructions").json() == [onboarding]
    assert client.get("/move-request-transition-instructions/1").json() == onboarding
    employee_instructions = client.get(
        f"/employees/{employee_id}/transition-instructions",
        params={"instruction_type": "onboarding"},
    )
    assert employee_instructions.status_code == 200
    assert employee_instructions.json() == [onboarding]
    assert (
        client.get(f"/move-requests/{request_id}/instructions/onboarding").json()
        == onboarding
    )
    assert (
        client.get(
            f"/move-requests/{request_id}/transition-instructions/onboarding"
        ).json()
        == onboarding
    )

    duplicate = client.post(
        "/move-request-transition-instructions",
        json=transition_instruction_payload(request_id, "onboarding"),
    )
    assert duplicate.status_code == 409

    offboarding_create = client.put(
        f"/move-requests/{request_id}/transition-instructions/offboarding",
        json={
            "status": "ready",
            "content_markdown": "# Offboarding\n\n- Handoff ownership.",
        },
    )
    assert offboarding_create.status_code == 201
    offboarding = offboarding_create.json()
    assert offboarding["instruction_type"] == "offboarding"

    updated = client.put(
        f"/move-requests/{request_id}/instructions/onboarding",
        json={"content_markdown": "# Updated onboarding"},
    )
    assert updated.status_code == 200
    assert updated.json()["content_markdown"] == "# Updated onboarding"

    solve_onboarding = client.post(
        f"/move-requests/{request_id}/transition-instructions/onboarding:solve"
    )
    assert solve_onboarding.status_code == 200
    assert solve_onboarding.json()["status"] == "solved"
    assert solve_onboarding.json()["solved_by_employee_id"] == employee_id
    assert client.get(f"/move-requests/{request_id}").json()["status"] == "pending"

    incomplete_complete = client.post(f"/move-requests/{request_id}:complete")
    assert incomplete_complete.status_code == 409

    solve_offboarding = client.post(
        f"/move-requests/{request_id}/instructions/offboarding:solve"
    )
    assert solve_offboarding.status_code == 200
    assert client.get(f"/move-requests/{request_id}").json()["status"] == "completed"
    assert client.get(f"/employees/{employee_id}").json()["current_project_ids"] == [project_id]
    assert (
        client.get(
            f"/employees/{employee_id}/transition-instructions",
            params={"instruction_type": "onboarding"},
        ).json()
        == []
    )
    assert client.get(
        f"/employees/{employee_id}/transition-instructions",
        params={"instruction_type": "onboarding", "include_completed": True},
    ).json() == [solve_onboarding.json()]

    delete_response = client.delete("/move-request-transition-instructions/2")
    assert delete_response.status_code == 204
    assert client.get("/move-request-transition-instructions/2").status_code == 404


def test_bench_move_completes_with_onboarding_only(client: TestClient) -> None:
    employee_id = client.post("/employees", json=employee_payload()).json()["id"]
    project_id = client.post("/projects", json=project_payload()).json()["id"]
    request_id = client.post(
        "/move-requests",
        json=move_request_payload(employee_id, project_id),
    ).json()["id"]

    onboarding_create = client.post(
        "/move-request-transition-instructions",
        json=transition_instruction_payload(request_id, "onboarding"),
    )
    assert onboarding_create.status_code == 201

    solve_onboarding = client.post(
        f"/move-requests/{request_id}/transition-instructions/onboarding:solve"
    )
    assert solve_onboarding.status_code == 200
    assert client.get(f"/move-requests/{request_id}").json()["status"] == "completed"
    assert client.get(f"/employees/{employee_id}").json()["current_project_ids"] == [
        project_id
    ]
    assert (
        client.post(f"/move-requests/{request_id}:complete").json()["status"]
        == "completed"
    )


def test_matching_run_crud_latest_and_cascade(client: TestClient, fake_db: InMemoryDatabase) -> None:
    project_id = client.post("/projects", json=project_payload()).json()["id"]

    create_response = client.post("/matching-runs", json=matching_run_payload(project_id))
    assert create_response.status_code == 201
    run = create_response.json()
    assert run["id"] == 1
    assert run["rule_config"] == {"max_moves": 2}
    assert run["input_snapshot"] == {"projects": [project_id]}

    assert client.get("/matching-runs").json() == [run]
    assert client.get("/matching-runs/1").json() == run
    assert client.get(f"/projects/{project_id}/matching/latest").json() == run

    update_response = client.put(
        "/matching-runs/1",
        json={
            "status": "completed",
            "candidate_count": 1,
            "recommendation_count": 1,
            "hiring_recommendation_count": 1,
            "selected_candidate_plan_id": "plan_01",
            "summary": "Completed matching run.",
        },
    )
    assert update_response.status_code == 200
    assert update_response.json()["status"] == "completed"
    assert update_response.json()["candidate_count"] == 1

    candidate = client.post(
        "/matching-runs/1/candidates",
        json=matching_candidate_payload(),
    ).json()
    assert candidate["plan_payload"] == {"moves": []}

    hiring = client.post(
        "/matching-runs/1/hiring-recommendations",
        json={
            "candidate_plan_id": "plan_01",
            "project_id": project_id,
            "role_title": "Senior backend/platform engineer",
            "count": 1,
            "required_skills": SKILLS,
            "reason": "No safe reassignment can close the gap.",
            "urgency": "high",
            "suggested_assignment": "Hire into Atlas Staffing.",
        },
    ).json()
    assert hiring["required_skills"] == SKILLS

    event = client.post(
        "/matching-runs/1/events",
        json={
            "level": "info",
            "stage": "strict_rules",
            "event_type": "strict_rules.completed",
            "message": "Generated one valid candidate plan.",
            "metadata": {"candidate_count": 1},
        },
    ).json()
    assert event["metadata"] == {"candidate_count": 1}

    assert client.get("/matching-runs/1/candidates").json() == [candidate]
    assert client.get("/matching-runs/1/hiring-recommendations").json() == [hiring]
    assert client.get("/matching-runs/1/events").json() == [event]

    delete_response = client.delete("/matching-runs/1")
    assert delete_response.status_code == 204
    assert fake_db.matching_candidates == []
    assert fake_db.matching_hiring_recommendations == []
    assert fake_db.matching_run_events == []
    assert client.get("/matching-runs/1").status_code == 404


def test_matching_recommendation_creates_move_requests_without_assignments(
    client: TestClient,
    fake_db: InMemoryDatabase,
) -> None:
    source_project_id = client.post("/projects", json=project_payload("Source")).json()["id"]
    target_project_id = client.post("/projects", json=project_payload("Target")).json()["id"]
    employee_id = client.post(
        "/employees",
        json={**employee_payload(), "current_project_ids": [source_project_id]},
    ).json()["id"]
    run_id = client.post("/matching-runs", json=matching_run_payload(target_project_id)).json()["id"]
    recommendation = client.post(
        f"/matching-runs/{run_id}/recommendations",
        json=matching_recommendation_payload(
            employee_id,
            source_project_id,
            target_project_id,
        ),
    ).json()
    assert recommendation["suggested_moves"][0]["employee_id"] == employee_id

    before_assignments = deepcopy(fake_db.project_assignments)
    action_response = client.post(
        f"/matching-runs/{run_id}/recommendations/plan_01/move-requests"
    )
    assert action_response.status_code == 201
    created_requests = action_response.json()["move_requests"]
    assert len(created_requests) == 1
    assert created_requests[0]["employee_id"] == employee_id
    assert created_requests[0]["from_project_id"] == source_project_id
    assert created_requests[0]["to_project_id"] == target_project_id
    assert fake_db.project_assignments == before_assignments


def test_json_column_helpers_round_trip_bytes_and_models() -> None:
    encoded = api.json_column(api.Skills(**SKILLS))
    assert json.loads(encoded) == SKILLS
    assert api.parse_json_column(encoded.encode("utf-8")) == SKILLS
