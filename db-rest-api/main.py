import json
import os
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import Decimal
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
    transition_started = "transition_started"
    completed = "completed"


class ApprovalStatus(str, Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class ApprovalActor(str, Enum):
    cto = "cto"
    employee = "employee"


class MatchingUseCase(str, Enum):
    portfolio_rebalance = "portfolio_rebalance"
    project_rebalance = "project_rebalance"
    project_staffing = "project_staffing"


class MatchingRunStatus(str, Enum):
    pending = "pending"
    running = "running"
    completed = "completed"
    failed = "failed"


class ProjectDocumentationStatus(str, Enum):
    pending = "pending"
    running = "running"
    ready = "ready"
    failed = "failed"


class TransitionInstructionType(str, Enum):
    onboarding = "onboarding"
    offboarding = "offboarding"


class TransitionInstructionStatus(str, Enum):
    pending = "pending"
    running = "running"
    ready = "ready"
    failed = "failed"
    solved = "solved"


class MatchingEventLevel(str, Enum):
    debug = "debug"
    info = "info"
    warning = "warning"
    error = "error"


class MatchingEventStage(str, Enum):
    request = "request"
    snapshot = "snapshot"
    strict_rules = "strict_rules"
    hiring_gap = "hiring_gap"
    llm_evaluation = "llm_evaluation"
    persistence = "persistence"
    action = "action"


class HiringUrgency(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"


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


class ProjectSkillRequirement(ApiModel):
    level_1: int = Field(ge=0)
    level_2: int = Field(ge=0)
    level_3: int = Field(ge=0)

    @model_validator(mode="before")
    @classmethod
    def normalize_legacy_requirement(cls, value: Any) -> Any:
        if isinstance(value, ProjectSkillRequirement):
            return value
        if not isinstance(value, dict):
            return value
        if {"level_1", "level_2", "level_3"} & set(value):
            return value

        count = max(0, int(value.get("count") or 0))
        minimum_level = min(3, max(0, int(value.get("minimum_level") or 0)))
        normalized = {"level_1": 0, "level_2": 0, "level_3": 0}
        if count > 0 and minimum_level > 0:
            normalized[f"level_{minimum_level}"] = count
        return normalized


class ProjectSkillRequirements(ApiModel):
    android: ProjectSkillRequirement
    ios: ProjectSkillRequirement
    web: ProjectSkillRequirement
    backend: ProjectSkillRequirement
    infrastructure: ProjectSkillRequirement
    ai: ProjectSkillRequirement

    @model_validator(mode="before")
    @classmethod
    def normalize_legacy_levels(cls, value: Any) -> Any:
        if isinstance(value, ProjectSkillRequirements):
            return value
        if not isinstance(value, dict):
            return value

        normalized: dict[str, Any] = {}
        for skill in Skills.model_fields:
            requirement = value.get(skill, 0)
            if isinstance(requirement, dict):
                normalized[skill] = requirement
                continue

            level = min(3, max(0, int(requirement or 0)))
            normalized[skill] = {
                "level_1": 1 if level == 1 else 0,
                "level_2": 1 if level == 2 else 0,
                "level_3": 1 if level == 3 else 0,
            }

        return normalized


class ProjectBase(ApiModel):
    project_name: str = Field(min_length=1, max_length=255)
    project_description: str = Field(min_length=1)
    project_phase: ProjectPhase
    icon_url: str = Field(min_length=1, max_length=2048, pattern=r"^https://")
    poster_url: str = Field(min_length=1, max_length=2048, pattern=r"^https://")
    required_people_amount: int = Field(ge=0)
    required_skills: ProjectSkillRequirements
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
    required_skills: ProjectSkillRequirements = None
    github_repositories: list[str] = None


class Project(ProjectBase):
    id: int
    current_team_member_ids: list[int]
    current_team_members: list[str]


class ProjectDocumentationCreate(ApiModel):
    project_id: int = Field(gt=0)
    status: ProjectDocumentationStatus = ProjectDocumentationStatus.pending
    content_markdown: str = ""
    source_repositories: list[str] = Field(default_factory=list)
    source_snapshot: dict[str, Any] | None = None
    model_metadata: dict[str, Any] | None = None
    last_error: str | None = None
    last_generated_at: datetime | None = None


class ProjectDocumentationUpdate(UpdateModel):
    status: ProjectDocumentationStatus = None
    content_markdown: str = None
    source_repositories: list[str] = None
    source_snapshot: dict[str, Any] | None = None
    model_metadata: dict[str, Any] | None = None
    last_error: str | None = None
    last_generated_at: datetime | None = None


class ProjectDocumentation(ProjectDocumentationCreate):
    id: int
    project_name: str
    created_at: datetime
    updated_at: datetime


class EmployeeBase(ApiModel):
    name: str = Field(min_length=1, max_length=255)
    role: str = Field(min_length=1, max_length=255)
    github_username: str = Field(
        min_length=1,
        max_length=39,
        pattern=r"^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$",
    )
    skills: Skills
    preferences: list[str]
    interests: list[str]


class EmployeeCreate(EmployeeBase):
    current_project_ids: list[int] | None = None
    current_project: str | None = Field(default=None, max_length=255)


class EmployeeUpdate(UpdateModel):
    name: str = Field(default=None, min_length=1, max_length=255)
    role: str = Field(default=None, min_length=1, max_length=255)
    github_username: str = Field(
        default=None,
        min_length=1,
        max_length=39,
        pattern=r"^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$",
    )
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
    cto_approval_status: ApprovalStatus = ApprovalStatus.pending
    cto_approved_at: datetime | None = None
    employee_approval_status: ApprovalStatus = ApprovalStatus.pending
    employee_approved_at: datetime | None = None


class MoveRequestUpdate(UpdateModel):
    employee_id: int = Field(default=None, gt=0)
    from_project_id: int | None = Field(default=None, gt=0)
    to_project_id: int = Field(default=None, gt=0)
    reason: str = Field(default=None, min_length=1)
    expected_role: str = Field(default=None, min_length=1, max_length=255)
    current_project_impact: CurrentProjectImpact = None
    status: MoveRequestStatus = None
    cto_approval_status: ApprovalStatus = None
    cto_approved_at: datetime | None = None
    employee_approval_status: ApprovalStatus = None
    employee_approved_at: datetime | None = None


class MoveRequestApproval(ApiModel):
    approver: ApprovalActor
    approval_status: ApprovalStatus


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
    cto_approval_status: ApprovalStatus
    cto_approved_at: datetime | None
    employee_approval_status: ApprovalStatus
    employee_approved_at: datetime | None
    created_at: datetime
    responded_at: datetime | None


class TransitionInstructionCreate(ApiModel):
    move_request_id: int = Field(gt=0)
    instruction_type: TransitionInstructionType
    status: TransitionInstructionStatus = TransitionInstructionStatus.pending
    content_markdown: str = ""
    input_snapshot: dict[str, Any] | None = None
    source_documentation_id: int | None = Field(default=None, gt=0)
    source_documentation_updated_at: datetime | None = None
    model_metadata: dict[str, Any] | None = None
    last_error: str | None = None
    solved_at: datetime | None = None
    solved_by_employee_id: int | None = Field(default=None, gt=0)


class TransitionInstructionUpdate(UpdateModel):
    instruction_type: TransitionInstructionType = None
    status: TransitionInstructionStatus = None
    content_markdown: str = None
    input_snapshot: dict[str, Any] | None = None
    source_documentation_id: int | None = Field(default=None, gt=0)
    source_documentation_updated_at: datetime | None = None
    model_metadata: dict[str, Any] | None = None
    last_error: str | None = None
    solved_at: datetime | None = None
    solved_by_employee_id: int | None = Field(default=None, gt=0)


class TransitionInstructionSolve(ApiModel):
    solved_by_employee_id: int | None = Field(default=None, gt=0)


class TransitionInstruction(TransitionInstructionCreate):
    id: int
    employee_id: int
    employee_name: str
    from_project_id: int | None
    from_project_name: str | None
    to_project_id: int
    to_project_name: str
    created_at: datetime
    updated_at: datetime


class PolicyCreate(ApiModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    config: dict[str, Any]
    is_active: bool = False


class PolicyUpdate(UpdateModel):
    name: str = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    config: dict[str, Any] = None
    is_active: bool = None


class Policy(ApiModel):
    id: int
    name: str
    description: str | None
    config: dict[str, Any]
    is_active: bool
    created_at: datetime
    updated_at: datetime
    activated_at: datetime | None


class MatchingRunBase(ApiModel):
    use_case: MatchingUseCase
    target_project_id: int | None = Field(default=None, gt=0)
    status: MatchingRunStatus = MatchingRunStatus.pending
    requested_by: str | None = Field(default=None, max_length=255)
    rule_config: dict[str, Any] = Field(default_factory=dict)
    input_snapshot: dict[str, Any] | None = None
    candidate_count: int = Field(default=0, ge=0)
    recommendation_count: int = Field(default=0, ge=0)
    hiring_recommendation_count: int = Field(default=0, ge=0)
    selected_candidate_plan_id: str | None = Field(default=None, max_length=64)
    summary: str | None = None
    error_message: str | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None


class MatchingRunCreate(MatchingRunBase):
    pass


class MatchingRunUpdate(UpdateModel):
    use_case: MatchingUseCase = None
    target_project_id: int | None = Field(default=None, gt=0)
    status: MatchingRunStatus = None
    requested_by: str | None = Field(default=None, max_length=255)
    rule_config: dict[str, Any] = None
    input_snapshot: dict[str, Any] | None = None
    candidate_count: int = Field(default=None, ge=0)
    recommendation_count: int = Field(default=None, ge=0)
    hiring_recommendation_count: int = Field(default=None, ge=0)
    selected_candidate_plan_id: str | None = Field(default=None, max_length=64)
    summary: str | None = None
    error_message: str | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None


class MatchingRun(MatchingRunBase):
    id: int
    created_at: datetime


class MatchingCandidateCreate(ApiModel):
    candidate_plan_id: str = Field(min_length=1, max_length=64)
    strict_score: float | None = Field(default=None, ge=0)
    hard_rule_summary: dict[str, Any] | None = None
    plan_payload: dict[str, Any]
    rejected_reason: str | None = None


class MatchingCandidate(MatchingCandidateCreate):
    id: int
    run_id: int
    created_at: datetime


class MatchingRecommendationCreate(ApiModel):
    candidate_plan_id: str = Field(min_length=1, max_length=64)
    rank: int = Field(gt=0)
    fit_score: float | None = Field(default=None, ge=0, le=1)
    summary: str = Field(min_length=1)
    explanation: str | None = None
    risks: list[str] = Field(default_factory=list)
    ramp_up_estimate: str | None = Field(default=None, max_length=255)
    suggested_moves: list[dict[str, Any]] = Field(default_factory=list)
    model_metadata: dict[str, Any] | None = None


class MatchingRecommendation(MatchingRecommendationCreate):
    id: int
    run_id: int
    created_at: datetime


class MatchingHiringRecommendationCreate(ApiModel):
    candidate_plan_id: str | None = Field(default=None, max_length=64)
    project_id: int | None = Field(default=None, gt=0)
    role_title: str = Field(min_length=1, max_length=255)
    count: int = Field(gt=0)
    required_skills: Skills
    reason: str = Field(min_length=1)
    urgency: HiringUrgency
    suggested_assignment: str | None = Field(default=None, max_length=255)


class MatchingHiringRecommendation(MatchingHiringRecommendationCreate):
    id: int
    run_id: int
    created_at: datetime


class MatchingRunEventCreate(ApiModel):
    level: MatchingEventLevel
    stage: MatchingEventStage
    event_type: str = Field(min_length=1, max_length=100)
    message: str = Field(min_length=1)
    metadata: dict[str, Any] | None = None


class MatchingRunEvent(MatchingRunEventCreate):
    id: int
    run_id: int
    created_at: datetime


class MatchingRecommendationMoveRequests(ApiModel):
    move_requests: list[MoveRequest]


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


def enum_value(value: Enum | str) -> str:
    return value.value if isinstance(value, Enum) else value


def serialize_project(
    row: dict[str, Any],
    current_team_member_ids: list[int] | None = None,
    current_team_members: list[str] | None = None,
) -> dict[str, Any]:
    project = dict(row)
    for column in ("required_skills", "github_repositories"):
        project[column] = parse_json_column(project[column])
    project["required_skills"] = ProjectSkillRequirements.model_validate(
        project["required_skills"]
    ).model_dump(mode="json")
    project["current_team_member_ids"] = current_team_member_ids or []
    project["current_team_members"] = current_team_members or []
    return project


PROJECT_DOCUMENTATION_SELECT = """
    SELECT
        doc.id,
        doc.project_id,
        project.project_name,
        doc.status,
        doc.content_markdown,
        doc.source_repositories,
        doc.source_snapshot,
        doc.model_metadata,
        doc.last_error,
        doc.last_generated_at,
        doc.created_at,
        doc.updated_at
    FROM project_documentation AS doc
    INNER JOIN projects AS project ON project.id = doc.project_id
"""


def serialize_project_documentation(row: dict[str, Any]) -> dict[str, Any]:
    documentation = dict(row)
    for column in ("source_repositories", "source_snapshot", "model_metadata"):
        documentation[column] = parse_json_column(documentation[column])
    return documentation


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


def serialize_transition_instruction(row: dict[str, Any]) -> dict[str, Any]:
    instruction = dict(row)
    for column in ("input_snapshot", "model_metadata"):
        instruction[column] = parse_json_column(instruction[column])
    return instruction


def serialize_policy(row: dict[str, Any]) -> dict[str, Any]:
    policy = dict(row)
    policy["config"] = parse_json_column(policy["config"])
    policy["is_active"] = bool(policy["is_active"])
    return policy


def numeric_value(value: Any) -> Any:
    if isinstance(value, Decimal):
        return float(value)
    return value


def serialize_matching_run(row: dict[str, Any]) -> dict[str, Any]:
    run = dict(row)
    for column in ("rule_config", "input_snapshot"):
        run[column] = parse_json_column(run[column])
    return run


def serialize_matching_candidate(row: dict[str, Any]) -> dict[str, Any]:
    candidate = dict(row)
    candidate["strict_score"] = numeric_value(candidate["strict_score"])
    for column in ("hard_rule_summary", "plan_payload"):
        candidate[column] = parse_json_column(candidate[column])
    return candidate


def serialize_matching_recommendation(row: dict[str, Any]) -> dict[str, Any]:
    recommendation = dict(row)
    recommendation["rank"] = recommendation.pop("recommendation_rank")
    recommendation["fit_score"] = numeric_value(recommendation["fit_score"])
    for column in ("risks", "suggested_moves", "model_metadata"):
        recommendation[column] = parse_json_column(recommendation[column])
    return recommendation


def serialize_matching_hiring_recommendation(row: dict[str, Any]) -> dict[str, Any]:
    recommendation = dict(row)
    recommendation["required_skills"] = parse_json_column(recommendation["required_skills"])
    return recommendation


def serialize_matching_run_event(row: dict[str, Any]) -> dict[str, Any]:
    event = dict(row)
    event["metadata"] = parse_json_column(event["metadata"])
    return event


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


def fetch_project_documentation(cursor: DictCursor, documentation_id: int) -> dict[str, Any]:
    execute_or_raise(
        cursor,
        f"{PROJECT_DOCUMENTATION_SELECT} WHERE doc.id = %s",
        (documentation_id,),
    )
    row = cursor.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Project documentation not found.")
    return serialize_project_documentation(row)


def fetch_project_documentation_by_project(
    cursor: DictCursor,
    project_id: int,
) -> dict[str, Any]:
    execute_or_raise(
        cursor,
        f"{PROJECT_DOCUMENTATION_SELECT} WHERE doc.project_id = %s",
        (project_id,),
    )
    row = cursor.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Project documentation not found.")
    return serialize_project_documentation(row)


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
        mr.cto_approval_status,
        mr.cto_approved_at,
        mr.employee_approval_status,
        mr.employee_approved_at,
        mr.created_at,
        mr.responded_at
    FROM move_requests AS mr
    INNER JOIN employees AS employee ON employee.id = mr.employee_id
    LEFT JOIN projects AS from_project ON from_project.id = mr.from_project_id
    INNER JOIN projects AS to_project ON to_project.id = mr.to_project_id
"""


TRANSITION_INSTRUCTION_SELECT = """
    SELECT
        instruction.id,
        instruction.move_request_id,
        instruction.instruction_type,
        instruction.status,
        instruction.content_markdown,
        instruction.input_snapshot,
        instruction.source_documentation_id,
        instruction.source_documentation_updated_at,
        instruction.model_metadata,
        instruction.last_error,
        instruction.solved_at,
        instruction.solved_by_employee_id,
        instruction.created_at,
        instruction.updated_at,
        mr.employee_id,
        employee.name AS employee_name,
        mr.from_project_id,
        from_project.project_name AS from_project_name,
        mr.to_project_id,
        to_project.project_name AS to_project_name
    FROM move_request_transition_instructions AS instruction
    INNER JOIN move_requests AS mr ON mr.id = instruction.move_request_id
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


def fetch_transition_instruction(
    cursor: DictCursor,
    instruction_id: int,
) -> dict[str, Any]:
    execute_or_raise(
        cursor,
        f"{TRANSITION_INSTRUCTION_SELECT} WHERE instruction.id = %s",
        (instruction_id,),
    )
    row = cursor.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Transition instruction not found.")
    return serialize_transition_instruction(row)


def fetch_transition_instruction_by_move_request(
    cursor: DictCursor,
    request_id: int,
    instruction_type: TransitionInstructionType | str,
) -> dict[str, Any]:
    execute_or_raise(
        cursor,
        f"""
        {TRANSITION_INSTRUCTION_SELECT}
        WHERE instruction.move_request_id = %s AND instruction.instruction_type = %s
        """,
        (request_id, enum_value(instruction_type)),
    )
    row = cursor.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Transition instruction not found.")
    return serialize_transition_instruction(row)


def fetch_policy(cursor: DictCursor, policy_id: int) -> dict[str, Any]:
    execute_or_raise(cursor, "SELECT * FROM policies WHERE id = %s", (policy_id,))
    row = cursor.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Policy not found.")
    return serialize_policy(row)


def fetch_active_policy(cursor: DictCursor) -> dict[str, Any]:
    execute_or_raise(
        cursor,
        "SELECT * FROM policies WHERE is_active = TRUE ORDER BY activated_at DESC, id DESC LIMIT 1",
    )
    row = cursor.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Active policy not found.")
    return serialize_policy(row)


def fetch_matching_run(cursor: DictCursor, run_id: int) -> dict[str, Any]:
    execute_or_raise(cursor, "SELECT * FROM matching_runs WHERE id = %s", (run_id,))
    row = cursor.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Matching run not found.")
    return serialize_matching_run(row)


def fetch_matching_candidate(cursor: DictCursor, candidate_id: int) -> dict[str, Any]:
    execute_or_raise(cursor, "SELECT * FROM matching_candidates WHERE id = %s", (candidate_id,))
    row = cursor.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Matching candidate not found.")
    return serialize_matching_candidate(row)


def fetch_matching_recommendation(
    cursor: DictCursor,
    recommendation_id: int,
) -> dict[str, Any]:
    execute_or_raise(
        cursor,
        "SELECT * FROM matching_recommendations WHERE id = %s",
        (recommendation_id,),
    )
    row = cursor.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Matching recommendation not found.")
    return serialize_matching_recommendation(row)


def fetch_matching_recommendation_by_plan(
    cursor: DictCursor,
    run_id: int,
    candidate_plan_id: str,
) -> dict[str, Any]:
    execute_or_raise(
        cursor,
        """
        SELECT *
        FROM matching_recommendations
        WHERE run_id = %s AND candidate_plan_id = %s
        """,
        (run_id, candidate_plan_id),
    )
    row = cursor.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Matching recommendation not found.")
    return serialize_matching_recommendation(row)


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


def project_documentation_payload(payload: dict[str, Any]) -> dict[str, Any]:
    return serialize_json_fields(
        payload,
        ("source_repositories", "source_snapshot", "model_metadata"),
    )


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


def transition_instruction_payload(payload: dict[str, Any]) -> dict[str, Any]:
    return serialize_json_fields(payload, ("input_snapshot", "model_metadata"))


def apply_move_request_approval_update(
    move_request: dict[str, Any],
    approval: MoveRequestApproval,
) -> dict[str, Any]:
    now = datetime.now(UTC).replace(tzinfo=None)
    payload: dict[str, Any] = {}
    approver = approval.approver.value if isinstance(approval.approver, Enum) else approval.approver
    approval_status = (
        approval.approval_status.value
        if isinstance(approval.approval_status, Enum)
        else approval.approval_status
    )
    status_column = f"{approver}_approval_status"
    approved_at_column = f"{approver}_approved_at"
    payload[status_column] = approval_status
    payload[approved_at_column] = (
        now if approval_status == ApprovalStatus.approved.value else None
    )

    cto_status = payload.get("cto_approval_status", move_request["cto_approval_status"])
    employee_status = payload.get(
        "employee_approval_status",
        move_request["employee_approval_status"],
    )
    if ApprovalStatus.rejected.value in {cto_status, employee_status}:
        payload["status"] = MoveRequestStatus.rejected.value
    elif (
        cto_status == ApprovalStatus.approved.value
        and employee_status == ApprovalStatus.approved.value
    ):
        payload["status"] = MoveRequestStatus.transition_started.value
    elif move_request["status"] == MoveRequestStatus.pending.value:
        payload["status"] = MoveRequestStatus.accepted.value

    return move_request_payload(payload)


def validate_move_request_can_start(move_request: dict[str, Any]) -> None:
    if (
        move_request["cto_approval_status"] != ApprovalStatus.approved.value
        or move_request["employee_approval_status"] != ApprovalStatus.approved.value
    ):
        raise HTTPException(
            status_code=409,
            detail="Move request requires CTO and employee approval before transition starts.",
        )


def transition_instructions_solved(cursor: DictCursor, request_id: int) -> bool:
    execute_or_raise(
        cursor,
        """
        SELECT instruction_type, status
        FROM move_request_transition_instructions
        WHERE move_request_id = %s
        """,
        (request_id,),
    )
    statuses = {row["instruction_type"]: row["status"] for row in cursor.fetchall()}
    return (
        statuses.get(TransitionInstructionType.onboarding.value)
        == TransitionInstructionStatus.solved.value
        and statuses.get(TransitionInstructionType.offboarding.value)
        == TransitionInstructionStatus.solved.value
    )


def maybe_complete_move_request(cursor: DictCursor, request_id: int) -> None:
    if transition_instructions_solved(cursor, request_id):
        execute_or_raise(
            cursor,
            "UPDATE move_requests SET status = %s, responded_at = %s WHERE id = %s",
            [
                MoveRequestStatus.completed.value,
                datetime.now(UTC).replace(tzinfo=None),
                request_id,
            ],
        )


def policy_payload(payload: dict[str, Any]) -> dict[str, Any]:
    return serialize_json_fields(payload, ("config",))


def serialize_json_fields(payload: dict[str, Any], columns: Sequence[str]) -> dict[str, Any]:
    prepared = dict(payload)
    for column in columns:
        if column in prepared and prepared[column] is not None:
            prepared[column] = json_column(prepared[column])
    return prepared


def matching_run_payload(payload: dict[str, Any]) -> dict[str, Any]:
    return serialize_json_fields(payload, ("rule_config", "input_snapshot"))


def matching_candidate_payload(payload: dict[str, Any]) -> dict[str, Any]:
    return serialize_json_fields(payload, ("hard_rule_summary", "plan_payload"))


def matching_recommendation_payload(payload: dict[str, Any]) -> dict[str, Any]:
    prepared = dict(payload)
    if "rank" in prepared:
        prepared["recommendation_rank"] = prepared.pop("rank")
    return serialize_json_fields(prepared, ("risks", "suggested_moves", "model_metadata"))


def matching_hiring_recommendation_payload(payload: dict[str, Any]) -> dict[str, Any]:
    return serialize_json_fields(payload, ("required_skills",))


def matching_run_event_payload(payload: dict[str, Any]) -> dict[str, Any]:
    return serialize_json_fields(payload, ("metadata",))


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
            "/project-documentation",
            "/employees",
            "/move-requests",
            "/move-request-transition-instructions",
            "/policies",
            "/matching-runs",
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


@app.get("/project-documentation", response_model=list[ProjectDocumentation])
def list_project_documentation(
    limit: int = Query(100, ge=1, le=MAX_LIST_LIMIT),
    offset: int = Query(0, ge=0),
) -> list[dict[str, Any]]:
    with open_db_connection() as connection:
        with connection.cursor() as cursor:
            execute_or_raise(
                cursor,
                f"{PROJECT_DOCUMENTATION_SELECT} ORDER BY doc.id LIMIT %s OFFSET %s",
                (limit, offset),
            )
            return [serialize_project_documentation(row) for row in cursor.fetchall()]


@app.post(
    "/project-documentation",
    response_model=ProjectDocumentation,
    status_code=status.HTTP_201_CREATED,
)
def create_project_documentation(
    documentation: ProjectDocumentationCreate,
) -> dict[str, Any]:
    payload = project_documentation_payload(model_payload(documentation))
    columns = ", ".join(payload)
    placeholders = ", ".join(["%s"] * len(payload))
    with open_db_connection() as connection:
        with connection.cursor() as cursor:
            execute_or_raise(
                cursor,
                f"INSERT INTO project_documentation ({columns}) VALUES ({placeholders})",
                list(payload.values()),
            )
            return fetch_project_documentation(cursor, cursor.lastrowid)


@app.get("/project-documentation/{documentation_id}", response_model=ProjectDocumentation)
def get_project_documentation(documentation_id: int) -> dict[str, Any]:
    with open_db_connection() as connection:
        with connection.cursor() as cursor:
            return fetch_project_documentation(cursor, documentation_id)


@app.put("/project-documentation/{documentation_id}", response_model=ProjectDocumentation)
def update_project_documentation(
    documentation_id: int,
    documentation: ProjectDocumentationUpdate,
) -> dict[str, Any]:
    payload = project_documentation_payload(model_payload(documentation, exclude_unset=True))
    assignments, values = update_fields_sql(payload)
    with open_db_connection() as connection:
        with connection.cursor() as cursor:
            execute_or_raise(
                cursor,
                f"UPDATE project_documentation SET {assignments} WHERE id = %s",
                [*values, documentation_id],
            )
            return fetch_project_documentation(cursor, documentation_id)


@app.delete("/project-documentation/{documentation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project_documentation(documentation_id: int) -> Response:
    with open_db_connection() as connection:
        with connection.cursor() as cursor:
            execute_or_raise(
                cursor,
                "DELETE FROM project_documentation WHERE id = %s",
                (documentation_id,),
            )
            if cursor.rowcount == 0:
                raise HTTPException(status_code=404, detail="Project documentation not found.")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.get("/projects/{project_id}/documentation", response_model=ProjectDocumentation)
def get_project_documentation_for_project(project_id: int) -> dict[str, Any]:
    with open_db_connection() as connection:
        with connection.cursor() as cursor:
            return fetch_project_documentation_by_project(cursor, project_id)


@app.put("/projects/{project_id}/documentation", response_model=ProjectDocumentation)
def upsert_project_documentation_for_project(
    project_id: int,
    documentation: ProjectDocumentationUpdate,
    response: Response,
) -> dict[str, Any]:
    raw_payload = model_payload(documentation, exclude_unset=True)
    payload = project_documentation_payload(raw_payload)
    assignments, values = update_fields_sql(payload)
    with open_db_connection() as connection:
        with connection.cursor() as cursor:
            try:
                fetch_project_documentation_by_project(cursor, project_id)
            except HTTPException as exc:
                if exc.status_code != 404:
                    raise
                fetch_project(cursor, project_id)
                create_payload = {
                    "project_id": project_id,
                    "status": ProjectDocumentationStatus.pending.value,
                    "content_markdown": "",
                    "source_repositories": [],
                    **raw_payload,
                }
                storage_payload = project_documentation_payload(create_payload)
                columns = ", ".join(storage_payload)
                placeholders = ", ".join(["%s"] * len(storage_payload))
                execute_or_raise(
                    cursor,
                    f"INSERT INTO project_documentation ({columns}) VALUES ({placeholders})",
                    list(storage_payload.values()),
                )
                response.status_code = status.HTTP_201_CREATED
                return fetch_project_documentation(cursor, cursor.lastrowid)

            execute_or_raise(
                cursor,
                f"UPDATE project_documentation SET {assignments} WHERE project_id = %s",
                [*values, project_id],
            )
            return fetch_project_documentation_by_project(cursor, project_id)


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


@app.get(
    "/employees/{employee_id}/transition-instructions",
    response_model=list[TransitionInstruction],
)
def list_employee_transition_instructions(
    employee_id: int,
    instruction_type: TransitionInstructionType | None = None,
    limit: int = Query(100, ge=1, le=MAX_LIST_LIMIT),
    offset: int = Query(0, ge=0),
) -> list[dict[str, Any]]:
    clauses = ["mr.employee_id = %s"]
    params: list[Any] = [employee_id]
    if instruction_type is not None:
        clauses.append("instruction.instruction_type = %s")
        params.append(instruction_type.value)
    where_clause = " AND ".join(clauses)

    with open_db_connection() as connection:
        with connection.cursor() as cursor:
            fetch_employee(cursor, employee_id)
            execute_or_raise(
                cursor,
                f"""
                {TRANSITION_INSTRUCTION_SELECT}
                WHERE {where_clause}
                ORDER BY instruction.updated_at DESC, instruction.id DESC
                LIMIT %s OFFSET %s
                """,
                [*params, limit, offset],
            )
            return [serialize_transition_instruction(row) for row in cursor.fetchall()]


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


@app.post("/move-requests/{request_id}/approval", response_model=MoveRequest)
def update_move_request_approval(
    request_id: int,
    approval: MoveRequestApproval,
) -> dict[str, Any]:
    with open_db_connection() as connection:
        with connection.cursor() as cursor:
            try:
                connection.begin()
                move_request = fetch_move_request(cursor, request_id)
                payload = apply_move_request_approval_update(move_request, approval)
                assignments, values = update_fields_sql(payload)
                execute_or_raise(
                    cursor,
                    f"UPDATE move_requests SET {assignments} WHERE id = %s",
                    [*values, request_id],
                )
                updated = fetch_move_request(cursor, request_id)
                connection.commit()
                return updated
            except Exception:
                connection.rollback()
                raise


@app.post("/move-requests/{request_id}:start-transition", response_model=MoveRequest)
def start_move_request_transition(request_id: int) -> dict[str, Any]:
    with open_db_connection() as connection:
        with connection.cursor() as cursor:
            move_request = fetch_move_request(cursor, request_id)
            validate_move_request_can_start(move_request)
            execute_or_raise(
                cursor,
                "UPDATE move_requests SET status = %s, responded_at = %s WHERE id = %s",
                [
                    MoveRequestStatus.transition_started.value,
                    datetime.now(UTC).replace(tzinfo=None),
                    request_id,
                ],
            )
            return fetch_move_request(cursor, request_id)


@app.post("/move-requests/{request_id}:complete", response_model=MoveRequest)
def complete_move_request(request_id: int) -> dict[str, Any]:
    with open_db_connection() as connection:
        with connection.cursor() as cursor:
            fetch_move_request(cursor, request_id)
            if not transition_instructions_solved(cursor, request_id):
                raise HTTPException(
                    status_code=409,
                    detail="Both onboarding and offboarding instructions must be solved first.",
                )
            execute_or_raise(
                cursor,
                "UPDATE move_requests SET status = %s, responded_at = %s WHERE id = %s",
                [
                    MoveRequestStatus.completed.value,
                    datetime.now(UTC).replace(tzinfo=None),
                    request_id,
                ],
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


@app.get(
    "/move-request-transition-instructions",
    response_model=list[TransitionInstruction],
)
def list_transition_instructions(
    limit: int = Query(100, ge=1, le=MAX_LIST_LIMIT),
    offset: int = Query(0, ge=0),
) -> list[dict[str, Any]]:
    with open_db_connection() as connection:
        with connection.cursor() as cursor:
            execute_or_raise(
                cursor,
                f"{TRANSITION_INSTRUCTION_SELECT} ORDER BY instruction.id LIMIT %s OFFSET %s",
                (limit, offset),
            )
            return [serialize_transition_instruction(row) for row in cursor.fetchall()]


@app.post(
    "/move-request-transition-instructions",
    response_model=TransitionInstruction,
    status_code=status.HTTP_201_CREATED,
)
def create_transition_instruction(
    instruction: TransitionInstructionCreate,
) -> dict[str, Any]:
    payload = transition_instruction_payload(model_payload(instruction))
    columns = ", ".join(payload)
    placeholders = ", ".join(["%s"] * len(payload))
    with open_db_connection() as connection:
        with connection.cursor() as cursor:
            fetch_move_request(cursor, payload["move_request_id"])
            execute_or_raise(
                cursor,
                f"INSERT INTO move_request_transition_instructions ({columns}) VALUES ({placeholders})",
                list(payload.values()),
            )
            return fetch_transition_instruction(cursor, cursor.lastrowid)


@app.get(
    "/move-request-transition-instructions/{instruction_id}",
    response_model=TransitionInstruction,
)
def get_transition_instruction(instruction_id: int) -> dict[str, Any]:
    with open_db_connection() as connection:
        with connection.cursor() as cursor:
            return fetch_transition_instruction(cursor, instruction_id)


@app.put(
    "/move-request-transition-instructions/{instruction_id}",
    response_model=TransitionInstruction,
)
def update_transition_instruction(
    instruction_id: int,
    instruction: TransitionInstructionUpdate,
) -> dict[str, Any]:
    payload = transition_instruction_payload(model_payload(instruction, exclude_unset=True))
    assignments, values = update_fields_sql(payload)
    with open_db_connection() as connection:
        with connection.cursor() as cursor:
            execute_or_raise(
                cursor,
                f"UPDATE move_request_transition_instructions SET {assignments} WHERE id = %s",
                [*values, instruction_id],
            )
            updated = fetch_transition_instruction(cursor, instruction_id)
            if updated["status"] == TransitionInstructionStatus.solved.value:
                maybe_complete_move_request(cursor, updated["move_request_id"])
            return fetch_transition_instruction(cursor, instruction_id)


@app.delete(
    "/move-request-transition-instructions/{instruction_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_transition_instruction(instruction_id: int) -> Response:
    with open_db_connection() as connection:
        with connection.cursor() as cursor:
            execute_or_raise(
                cursor,
                "DELETE FROM move_request_transition_instructions WHERE id = %s",
                (instruction_id,),
            )
            if cursor.rowcount == 0:
                raise HTTPException(status_code=404, detail="Transition instruction not found.")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.get(
    "/move-requests/{request_id}/transition-instructions/{instruction_type}",
    response_model=TransitionInstruction,
)
@app.get(
    "/move-requests/{request_id}/instructions/{instruction_type}",
    response_model=TransitionInstruction,
)
def get_transition_instruction_for_move_request(
    request_id: int,
    instruction_type: TransitionInstructionType,
) -> dict[str, Any]:
    with open_db_connection() as connection:
        with connection.cursor() as cursor:
            fetch_move_request(cursor, request_id)
            return fetch_transition_instruction_by_move_request(cursor, request_id, instruction_type)


@app.put(
    "/move-requests/{request_id}/transition-instructions/{instruction_type}",
    response_model=TransitionInstruction,
)
@app.put(
    "/move-requests/{request_id}/instructions/{instruction_type}",
    response_model=TransitionInstruction,
)
def upsert_transition_instruction_for_move_request(
    request_id: int,
    instruction_type: TransitionInstructionType,
    instruction: TransitionInstructionUpdate,
    response: Response,
) -> dict[str, Any]:
    raw_payload = model_payload(instruction, exclude_unset=True)
    raw_payload.pop("instruction_type", None)
    payload = transition_instruction_payload(raw_payload)
    with open_db_connection() as connection:
        with connection.cursor() as cursor:
            try:
                connection.begin()
                fetch_move_request(cursor, request_id)
                try:
                    existing = fetch_transition_instruction_by_move_request(
                        cursor,
                        request_id,
                        instruction_type,
                    )
                except HTTPException as exc:
                    if exc.status_code != 404:
                        raise
                    create_payload = {
                        "move_request_id": request_id,
                        "instruction_type": enum_value(instruction_type),
                        "status": TransitionInstructionStatus.pending.value,
                        "content_markdown": "",
                        **raw_payload,
                    }
                    storage_payload = transition_instruction_payload(create_payload)
                    columns = ", ".join(storage_payload)
                    placeholders = ", ".join(["%s"] * len(storage_payload))
                    execute_or_raise(
                        cursor,
                        f"INSERT INTO move_request_transition_instructions ({columns}) VALUES ({placeholders})",
                        list(storage_payload.values()),
                    )
                    response.status_code = status.HTTP_201_CREATED
                    created = fetch_transition_instruction(cursor, cursor.lastrowid)
                    if created["status"] == TransitionInstructionStatus.solved.value:
                        maybe_complete_move_request(cursor, request_id)
                    connection.commit()
                    return fetch_transition_instruction(cursor, created["id"])

                if payload:
                    assignments, values = update_fields_sql(payload)
                    execute_or_raise(
                        cursor,
                        f"""
                        UPDATE move_request_transition_instructions
                        SET {assignments}
                        WHERE move_request_id = %s AND instruction_type = %s
                        """,
                        [*values, request_id, enum_value(instruction_type)],
                    )
                updated = fetch_transition_instruction(cursor, existing["id"])
                if updated["status"] == TransitionInstructionStatus.solved.value:
                    maybe_complete_move_request(cursor, request_id)
                connection.commit()
                return fetch_transition_instruction(cursor, existing["id"])
            except Exception:
                connection.rollback()
                raise


@app.post(
    "/move-requests/{request_id}/transition-instructions/{instruction_type}:solve",
    response_model=TransitionInstruction,
)
@app.post(
    "/move-requests/{request_id}/instructions/{instruction_type}:solve",
    response_model=TransitionInstruction,
)
def solve_transition_instruction(
    request_id: int,
    instruction_type: TransitionInstructionType,
    solve: TransitionInstructionSolve | None = None,
) -> dict[str, Any]:
    with open_db_connection() as connection:
        with connection.cursor() as cursor:
            try:
                connection.begin()
                move_request = fetch_move_request(cursor, request_id)
                instruction = fetch_transition_instruction_by_move_request(
                    cursor,
                    request_id,
                    instruction_type,
                )
                solved_by_employee_id = (
                    solve.solved_by_employee_id
                    if solve is not None and solve.solved_by_employee_id is not None
                    else move_request["employee_id"]
                )
                if solved_by_employee_id != move_request["employee_id"]:
                    raise HTTPException(
                        status_code=400,
                        detail="Transition instructions can only be solved by the move-request employee.",
                    )
                execute_or_raise(
                    cursor,
                    """
                    UPDATE move_request_transition_instructions
                    SET status = %s, solved_at = %s, solved_by_employee_id = %s
                    WHERE id = %s
                    """,
                    [
                        TransitionInstructionStatus.solved.value,
                        datetime.now(UTC).replace(tzinfo=None),
                        solved_by_employee_id,
                        instruction["id"],
                    ],
                )
                maybe_complete_move_request(cursor, request_id)
                solved = fetch_transition_instruction(cursor, instruction["id"])
                connection.commit()
                return solved
            except Exception:
                connection.rollback()
                raise


@app.get("/policies", response_model=list[Policy])
def list_policies(
    limit: int = Query(100, ge=1, le=MAX_LIST_LIMIT),
    offset: int = Query(0, ge=0),
    name: str | None = Query(None, min_length=1, max_length=255),
) -> list[dict[str, Any]]:
    with open_db_connection() as connection:
        with connection.cursor() as cursor:
            if name is None:
                execute_or_raise(
                    cursor,
                    "SELECT * FROM policies ORDER BY id LIMIT %s OFFSET %s",
                    (limit, offset),
                )
            else:
                execute_or_raise(
                    cursor,
                    "SELECT * FROM policies WHERE name = %s ORDER BY id LIMIT %s OFFSET %s",
                    (name, limit, offset),
                )
            return [serialize_policy(row) for row in cursor.fetchall()]


@app.post("/policies", response_model=Policy, status_code=status.HTTP_201_CREATED)
def create_policy(policy: PolicyCreate) -> dict[str, Any]:
    payload = policy_payload(model_payload(policy))
    is_active = bool(payload.get("is_active"))
    if is_active:
        payload["activated_at"] = datetime.now(UTC).replace(tzinfo=None)
    columns = ", ".join(payload)
    placeholders = ", ".join(["%s"] * len(payload))
    with open_db_connection() as connection:
        with connection.cursor() as cursor:
            try:
                connection.begin()
                if is_active:
                    execute_or_raise(cursor, "UPDATE policies SET is_active = FALSE", ())
                execute_or_raise(
                    cursor,
                    f"INSERT INTO policies ({columns}) VALUES ({placeholders})",
                    list(payload.values()),
                )
                created = fetch_policy(cursor, cursor.lastrowid)
                connection.commit()
                return created
            except Exception:
                connection.rollback()
                raise


@app.get("/policies/active", response_model=Policy)
def get_active_policy() -> dict[str, Any]:
    with open_db_connection() as connection:
        with connection.cursor() as cursor:
            return fetch_active_policy(cursor)


@app.get("/policies/{policy_id}", response_model=Policy)
def get_policy(policy_id: int) -> dict[str, Any]:
    with open_db_connection() as connection:
        with connection.cursor() as cursor:
            return fetch_policy(cursor, policy_id)


@app.put("/policies/{policy_id}", response_model=Policy)
def update_policy(policy_id: int, policy: PolicyUpdate) -> dict[str, Any]:
    payload = policy_payload(model_payload(policy, exclude_unset=True))
    wants_activation = payload.get("is_active") is True
    wants_deactivation = payload.get("is_active") is False
    with open_db_connection() as connection:
        with connection.cursor() as cursor:
            try:
                connection.begin()
                existing = fetch_policy(cursor, policy_id)
                if wants_deactivation and existing["is_active"]:
                    raise HTTPException(
                        status_code=409,
                        detail="Cannot deactivate the active policy without activating another policy.",
                    )
                if wants_activation:
                    execute_or_raise(cursor, "UPDATE policies SET is_active = FALSE", ())
                    payload["activated_at"] = datetime.now(UTC).replace(tzinfo=None)
                assignments, values = update_fields_sql(payload)
                execute_or_raise(
                    cursor,
                    f"UPDATE policies SET {assignments} WHERE id = %s",
                    [*values, policy_id],
                )
                updated = fetch_policy(cursor, policy_id)
                connection.commit()
                return updated
            except Exception:
                connection.rollback()
                raise


@app.post("/policies/{policy_id}:activate", response_model=Policy)
def activate_policy(policy_id: int) -> dict[str, Any]:
    with open_db_connection() as connection:
        with connection.cursor() as cursor:
            try:
                connection.begin()
                fetch_policy(cursor, policy_id)
                execute_or_raise(cursor, "UPDATE policies SET is_active = FALSE", ())
                execute_or_raise(
                    cursor,
                    "UPDATE policies SET is_active = %s, activated_at = %s WHERE id = %s",
                    [True, datetime.now(UTC).replace(tzinfo=None), policy_id],
                )
                activated = fetch_policy(cursor, policy_id)
                connection.commit()
                return activated
            except Exception:
                connection.rollback()
                raise


@app.delete("/policies/{policy_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_policy(policy_id: int) -> Response:
    with open_db_connection() as connection:
        with connection.cursor() as cursor:
            policy = fetch_policy(cursor, policy_id)
            if policy["is_active"]:
                raise HTTPException(status_code=409, detail="Active policy cannot be deleted.")
            execute_or_raise(cursor, "DELETE FROM policies WHERE id = %s", (policy_id,))
            if cursor.rowcount == 0:
                raise HTTPException(status_code=404, detail="Policy not found.")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.get("/matching-runs", response_model=list[MatchingRun])
def list_matching_runs(
    use_case: MatchingUseCase | None = None,
    target_project_id: int | None = Query(default=None, gt=0),
    status_filter: MatchingRunStatus | None = Query(default=None, alias="status"),
    limit: int = Query(100, ge=1, le=MAX_LIST_LIMIT),
    offset: int = Query(0, ge=0),
) -> list[dict[str, Any]]:
    clauses: list[str] = []
    params: list[Any] = []
    if use_case is not None:
        clauses.append("use_case = %s")
        params.append(use_case.value)
    if target_project_id is not None:
        clauses.append("target_project_id = %s")
        params.append(target_project_id)
    if status_filter is not None:
        clauses.append("status = %s")
        params.append(status_filter.value)
    where_clause = f" WHERE {' AND '.join(clauses)}" if clauses else ""
    with open_db_connection() as connection:
        with connection.cursor() as cursor:
            execute_or_raise(
                cursor,
                f"SELECT * FROM matching_runs{where_clause} ORDER BY id LIMIT %s OFFSET %s",
                [*params, limit, offset],
            )
            return [serialize_matching_run(row) for row in cursor.fetchall()]


@app.post("/matching-runs", response_model=MatchingRun, status_code=status.HTTP_201_CREATED)
def create_matching_run(run: MatchingRunCreate) -> dict[str, Any]:
    payload = matching_run_payload(model_payload(run))
    columns = ", ".join(payload)
    placeholders = ", ".join(["%s"] * len(payload))
    with open_db_connection() as connection:
        with connection.cursor() as cursor:
            execute_or_raise(
                cursor,
                f"INSERT INTO matching_runs ({columns}) VALUES ({placeholders})",
                list(payload.values()),
            )
            return fetch_matching_run(cursor, cursor.lastrowid)


@app.get("/matching-runs/latest", response_model=MatchingRun)
def get_latest_matching_run(
    use_case: MatchingUseCase | None = None,
    target_project_id: int | None = Query(default=None, gt=0),
) -> dict[str, Any]:
    clauses: list[str] = []
    params: list[Any] = []
    if use_case is not None:
        clauses.append("use_case = %s")
        params.append(use_case.value)
    if target_project_id is not None:
        clauses.append("target_project_id = %s")
        params.append(target_project_id)
    where_clause = f" WHERE {' AND '.join(clauses)}" if clauses else ""
    with open_db_connection() as connection:
        with connection.cursor() as cursor:
            execute_or_raise(
                cursor,
                f"SELECT * FROM matching_runs{where_clause} ORDER BY created_at DESC, id DESC LIMIT 1",
                params,
            )
            row = cursor.fetchone()
            if row is None:
                raise HTTPException(status_code=404, detail="Matching run not found.")
            return serialize_matching_run(row)


@app.get("/projects/{project_id}/matching/latest", response_model=MatchingRun)
def get_latest_project_matching_run(project_id: int) -> dict[str, Any]:
    return get_latest_matching_run(target_project_id=project_id)


@app.get("/matching-runs/{run_id}", response_model=MatchingRun)
def get_matching_run(run_id: int) -> dict[str, Any]:
    with open_db_connection() as connection:
        with connection.cursor() as cursor:
            return fetch_matching_run(cursor, run_id)


@app.put("/matching-runs/{run_id}", response_model=MatchingRun)
def update_matching_run(run_id: int, run: MatchingRunUpdate) -> dict[str, Any]:
    payload = matching_run_payload(model_payload(run, exclude_unset=True))
    assignments, values = update_fields_sql(payload)
    with open_db_connection() as connection:
        with connection.cursor() as cursor:
            execute_or_raise(
                cursor,
                f"UPDATE matching_runs SET {assignments} WHERE id = %s",
                [*values, run_id],
            )
            return fetch_matching_run(cursor, run_id)


@app.delete("/matching-runs/{run_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_matching_run(run_id: int) -> Response:
    with open_db_connection() as connection:
        with connection.cursor() as cursor:
            execute_or_raise(cursor, "DELETE FROM matching_runs WHERE id = %s", (run_id,))
            if cursor.rowcount == 0:
                raise HTTPException(status_code=404, detail="Matching run not found.")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.get("/matching-runs/{run_id}/candidates", response_model=list[MatchingCandidate])
def list_matching_candidates(
    run_id: int,
    limit: int = Query(100, ge=1, le=MAX_LIST_LIMIT),
    offset: int = Query(0, ge=0),
) -> list[dict[str, Any]]:
    with open_db_connection() as connection:
        with connection.cursor() as cursor:
            fetch_matching_run(cursor, run_id)
            execute_or_raise(
                cursor,
                "SELECT * FROM matching_candidates WHERE run_id = %s ORDER BY id LIMIT %s OFFSET %s",
                (run_id, limit, offset),
            )
            return [serialize_matching_candidate(row) for row in cursor.fetchall()]


@app.post(
    "/matching-runs/{run_id}/candidates",
    response_model=MatchingCandidate,
    status_code=status.HTTP_201_CREATED,
)
def create_matching_candidate(
    run_id: int,
    candidate: MatchingCandidateCreate,
) -> dict[str, Any]:
    payload = matching_candidate_payload(model_payload(candidate))
    payload["run_id"] = run_id
    columns = ", ".join(payload)
    placeholders = ", ".join(["%s"] * len(payload))
    with open_db_connection() as connection:
        with connection.cursor() as cursor:
            fetch_matching_run(cursor, run_id)
            execute_or_raise(
                cursor,
                f"INSERT INTO matching_candidates ({columns}) VALUES ({placeholders})",
                list(payload.values()),
            )
            return fetch_matching_candidate(cursor, cursor.lastrowid)


@app.get("/matching-candidates/{candidate_id}", response_model=MatchingCandidate)
def get_matching_candidate(candidate_id: int) -> dict[str, Any]:
    with open_db_connection() as connection:
        with connection.cursor() as cursor:
            return fetch_matching_candidate(cursor, candidate_id)


@app.get("/matching-runs/{run_id}/recommendations", response_model=list[MatchingRecommendation])
def list_matching_recommendations(
    run_id: int,
    limit: int = Query(100, ge=1, le=MAX_LIST_LIMIT),
    offset: int = Query(0, ge=0),
) -> list[dict[str, Any]]:
    with open_db_connection() as connection:
        with connection.cursor() as cursor:
            fetch_matching_run(cursor, run_id)
            execute_or_raise(
                cursor,
                """
                SELECT *
                FROM matching_recommendations
                WHERE run_id = %s
                ORDER BY recommendation_rank
                LIMIT %s OFFSET %s
                """,
                (run_id, limit, offset),
            )
            return [serialize_matching_recommendation(row) for row in cursor.fetchall()]


@app.post(
    "/matching-runs/{run_id}/recommendations",
    response_model=MatchingRecommendation,
    status_code=status.HTTP_201_CREATED,
)
def create_matching_recommendation(
    run_id: int,
    recommendation: MatchingRecommendationCreate,
) -> dict[str, Any]:
    payload = matching_recommendation_payload(model_payload(recommendation))
    payload["run_id"] = run_id
    columns = ", ".join(payload)
    placeholders = ", ".join(["%s"] * len(payload))
    with open_db_connection() as connection:
        with connection.cursor() as cursor:
            fetch_matching_run(cursor, run_id)
            execute_or_raise(
                cursor,
                f"INSERT INTO matching_recommendations ({columns}) VALUES ({placeholders})",
                list(payload.values()),
            )
            return fetch_matching_recommendation(cursor, cursor.lastrowid)


@app.get("/matching-recommendations/{recommendation_id}", response_model=MatchingRecommendation)
def get_matching_recommendation(recommendation_id: int) -> dict[str, Any]:
    with open_db_connection() as connection:
        with connection.cursor() as cursor:
            return fetch_matching_recommendation(cursor, recommendation_id)


@app.get(
    "/matching-runs/{run_id}/hiring-recommendations",
    response_model=list[MatchingHiringRecommendation],
)
def list_matching_hiring_recommendations(
    run_id: int,
    limit: int = Query(100, ge=1, le=MAX_LIST_LIMIT),
    offset: int = Query(0, ge=0),
) -> list[dict[str, Any]]:
    with open_db_connection() as connection:
        with connection.cursor() as cursor:
            fetch_matching_run(cursor, run_id)
            execute_or_raise(
                cursor,
                """
                SELECT *
                FROM matching_hiring_recommendations
                WHERE run_id = %s
                ORDER BY id
                LIMIT %s OFFSET %s
                """,
                (run_id, limit, offset),
            )
            return [
                serialize_matching_hiring_recommendation(row) for row in cursor.fetchall()
            ]


@app.post(
    "/matching-runs/{run_id}/hiring-recommendations",
    response_model=MatchingHiringRecommendation,
    status_code=status.HTTP_201_CREATED,
)
def create_matching_hiring_recommendation(
    run_id: int,
    recommendation: MatchingHiringRecommendationCreate,
) -> dict[str, Any]:
    payload = matching_hiring_recommendation_payload(model_payload(recommendation))
    payload["run_id"] = run_id
    columns = ", ".join(payload)
    placeholders = ", ".join(["%s"] * len(payload))
    with open_db_connection() as connection:
        with connection.cursor() as cursor:
            fetch_matching_run(cursor, run_id)
            execute_or_raise(
                cursor,
                f"INSERT INTO matching_hiring_recommendations ({columns}) VALUES ({placeholders})",
                list(payload.values()),
            )
            execute_or_raise(
                cursor,
                "SELECT * FROM matching_hiring_recommendations WHERE id = %s",
                (cursor.lastrowid,),
            )
            row = cursor.fetchone()
            if row is None:
                raise HTTPException(status_code=404, detail="Matching hiring recommendation not found.")
            return serialize_matching_hiring_recommendation(row)


@app.get("/matching-runs/{run_id}/events", response_model=list[MatchingRunEvent])
def list_matching_run_events(
    run_id: int,
    limit: int = Query(100, ge=1, le=MAX_LIST_LIMIT),
    offset: int = Query(0, ge=0),
) -> list[dict[str, Any]]:
    with open_db_connection() as connection:
        with connection.cursor() as cursor:
            fetch_matching_run(cursor, run_id)
            execute_or_raise(
                cursor,
                """
                SELECT *
                FROM matching_run_events
                WHERE run_id = %s
                ORDER BY id
                LIMIT %s OFFSET %s
                """,
                (run_id, limit, offset),
            )
            return [serialize_matching_run_event(row) for row in cursor.fetchall()]


@app.post(
    "/matching-runs/{run_id}/events",
    response_model=MatchingRunEvent,
    status_code=status.HTTP_201_CREATED,
)
def create_matching_run_event(run_id: int, event: MatchingRunEventCreate) -> dict[str, Any]:
    payload = matching_run_event_payload(model_payload(event))
    payload["run_id"] = run_id
    columns = ", ".join(payload)
    placeholders = ", ".join(["%s"] * len(payload))
    with open_db_connection() as connection:
        with connection.cursor() as cursor:
            fetch_matching_run(cursor, run_id)
            execute_or_raise(
                cursor,
                f"INSERT INTO matching_run_events ({columns}) VALUES ({placeholders})",
                list(payload.values()),
            )
            execute_or_raise(
                cursor,
                "SELECT * FROM matching_run_events WHERE id = %s",
                (cursor.lastrowid,),
            )
            row = cursor.fetchone()
            if row is None:
                raise HTTPException(status_code=404, detail="Matching run event not found.")
            return serialize_matching_run_event(row)


@app.post(
    "/matching-runs/{run_id}/recommendations/{candidate_plan_id}/move-requests",
    response_model=MatchingRecommendationMoveRequests,
    status_code=status.HTTP_201_CREATED,
)
def create_move_requests_from_matching_recommendation(
    run_id: int,
    candidate_plan_id: str,
) -> dict[str, list[dict[str, Any]]]:
    with open_db_connection() as connection:
        with connection.cursor() as cursor:
            try:
                connection.begin()
                recommendation = fetch_matching_recommendation_by_plan(
                    cursor,
                    run_id,
                    candidate_plan_id,
                )
                suggested_moves = recommendation["suggested_moves"]
                if not suggested_moves:
                    raise HTTPException(
                        status_code=400,
                        detail="Recommendation does not contain suggested moves.",
                    )
                created: list[dict[str, Any]] = []
                for move in suggested_moves:
                    try:
                        payload = MoveRequestCreate(
                            employee_id=move["employee_id"],
                            from_project_id=move.get("from_project_id"),
                            to_project_id=move["to_project_id"],
                            reason=move.get("move_request_reason")
                            or move.get("reason")
                            or recommendation["summary"],
                            expected_role=move.get("suggested_role") or move["expected_role"],
                            current_project_impact=move["current_project_impact"],
                        )
                    except Exception as exc:
                        raise HTTPException(
                            status_code=400,
                            detail="Recommendation suggested_moves cannot be converted to move requests.",
                        ) from exc
                    storage_payload = move_request_payload(model_payload(payload))
                    columns = ", ".join(storage_payload)
                    placeholders = ", ".join(["%s"] * len(storage_payload))
                    execute_or_raise(
                        cursor,
                        f"INSERT INTO move_requests ({columns}) VALUES ({placeholders})",
                        list(storage_payload.values()),
                    )
                    created.append(fetch_move_request(cursor, cursor.lastrowid))
                connection.commit()
                return {"move_requests": created}
            except Exception:
                connection.rollback()
                raise
