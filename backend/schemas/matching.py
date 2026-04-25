from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


MatchingUseCase = Literal[
    "portfolio_rebalance",
    "project_rebalance",
    "project_staffing",
]


class MatchingRuleConfigRequest(BaseModel):
    max_moves: int | None = Field(default=None, ge=1, le=3)
    max_projects_in_scope: int | None = Field(default=None, ge=1)
    max_employees_in_scope: int | None = Field(default=None, ge=1)
    max_employee_project_count: int | None = Field(default=None, ge=1)
    minimum_remaining_project_coverage: float | None = Field(
        default=None, ge=0.0, le=1.0
    )
    minimum_target_coverage_improvement: float | None = Field(
        default=None, ge=0.0, le=1.0
    )
    allow_unassigned_employees: bool | None = None
    allow_multi_project_assignment: bool | None = None
    allow_understaff_current_project: bool | None = None
    exclude_pending_move_requests: bool | None = None
    prefer_employee_preferences: bool | None = None
    emit_hiring_gaps: bool | None = None


class MatchingRunRequest(BaseModel):
    max_recommendations: int = Field(default=5, ge=1, le=25)
    max_candidate_plans: int = Field(default=25, ge=1, le=100)
    dry_run: bool = True
    requested_by: str | None = Field(default=None, max_length=255)
    rule_config: MatchingRuleConfigRequest | None = None


class MatchingMoveResponse(BaseModel):
    employee_id: int
    from_project_id: int | None = None
    to_project_id: int
    action: Literal["assign", "move", "add_assignment"]
    suggested_role: str
    current_project_impact: Literal["low", "medium", "high"]
    hard_rule_reasons: list[str]
    reason: str


class MatchingCandidateResponse(BaseModel):
    candidate_plan_id: str
    strict_score: float
    summary: str
    moves: list[MatchingMoveResponse]
    risks: list[str]
    hard_rule_summary: dict[str, Any]
    plan_payload: dict[str, Any]


class MatchingHiringRecommendationResponse(BaseModel):
    candidate_plan_id: str | None = None
    project_id: int
    role_title: str
    count: int = Field(ge=1)
    required_skills: dict[str, int]
    reason: str
    urgency: Literal["low", "medium", "high"]
    suggested_assignment: str | None = None


class MatchingRunEventResponse(BaseModel):
    level: Literal["info", "warning", "error"]
    stage: str
    event_type: str
    message: str
    metadata: dict[str, Any] | None = None


class MatchingRunResponse(BaseModel):
    run_id: int
    use_case: MatchingUseCase
    status: Literal["pending", "running", "completed", "failed"]
    target_project_id: int | None = None
    candidate_count: int
    recommendation_count: int
    hiring_recommendation_count: int
    summary: str
    candidates: list[MatchingCandidateResponse]
    hiring_recommendations: list[MatchingHiringRecommendationResponse]
    logs: list[MatchingRunEventResponse]
