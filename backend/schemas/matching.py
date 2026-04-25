from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from schemas.common import Skills


MatchingUseCase = Literal[
    "portfolio_rebalance",
    "project_rebalance",
    "project_staffing",
]

Impact = Literal["low", "medium", "high"]
Urgency = Literal["low", "medium", "high"]


# --- Matching run request/response schemas ---

class MatchingRunRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    requested_by: str | None = Field(default=None, max_length=255)


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


class MatchingRecommendationResponse(BaseModel):
    candidate_plan_id: str
    rank: int = Field(gt=0)
    fit_score: float | None = Field(default=None, ge=0.0, le=1.0)
    summary: str
    explanation: str | None = None
    risks: list[str]
    ramp_up_estimate: str | None = None
    suggested_moves: list[dict[str, Any]]
    model_metadata: dict[str, Any] | None = None


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
    selected_candidate_plan_id: str | None = None
    summary: str
    candidates: list[MatchingCandidateResponse]
    recommendations: list[MatchingRecommendationResponse]
    hiring_recommendations: list[MatchingHiringRecommendationResponse]
    logs: list[MatchingRunEventResponse]


# --- Input to the LLM evaluator ---


class TargetProject(BaseModel):
    id: int = Field(gt=0)
    name: str
    phase: str
    required_people_amount: int = Field(ge=0)
    required_skills: Skills


class GapClosingMove(BaseModel):
    employee_id: int = Field(gt=0)
    name: str
    role: str
    from_project_id: int | None = None
    from_project_name: str | None = None
    to_project_id: int = Field(gt=0)
    to_project_name: str
    action: Literal["assign", "move", "add_assignment"] = "move"
    skills: Skills
    preferences: list[str]
    interests: list[str]


class BenchMove(BaseModel):
    employee_id: int = Field(gt=0)
    name: str
    role: str
    to_project_id: int = Field(gt=0)
    to_project_name: str
    skills: Skills
    interests: list[str]


class CoverageAfter(BaseModel):
    headcount_gap: int = Field(ge=0)
    skill_gap: Skills


class SourceProjectImpact(BaseModel):
    project_id: int = Field(gt=0)
    project_name: str
    impact: Impact


class CandidatePlan(BaseModel):
    candidate_plan_id: str = Field(min_length=1)
    gap_closing_moves: list[GapClosingMove]
    bench_moves: list[BenchMove]
    coverage_after: CoverageAfter
    source_project_impacts: list[SourceProjectImpact]


class HiringGapHint(BaseModel):
    project_id: int = Field(gt=0)
    role_title: str
    count: int = Field(gt=0)
    required_skills: Skills


class MatchingLlmRequest(BaseModel):
    use_case: str
    target_project: TargetProject
    candidate_plans: list[CandidatePlan] = Field(min_length=1)
    hiring_gap_hints: list[HiringGapHint]


# --- Output from the LLM evaluator (Structured Outputs schema) ---


class RecommendedMove(BaseModel):
    employee_id: int = Field(gt=0)
    from_project_id: int | None = None
    to_project_id: int = Field(gt=0)
    action: Literal["assign", "move", "add_assignment"]
    suggested_role: str
    current_project_impact: Impact


class RecommendedBenchMove(BaseModel):
    employee_id: int = Field(gt=0)
    to_project_id: int = Field(gt=0)
    suggested_role: str
    reason: str


class BestPlan(BaseModel):
    candidate_plan_id: str = Field(min_length=1)
    fit_score: float = Field(ge=0.0, le=1.0)
    reason: str
    moves: list[RecommendedMove]
    bench_moves: list[RecommendedBenchMove]
    risks: list[str]


class AlternativePlan(BaseModel):
    candidate_plan_id: str = Field(min_length=1)
    fit_score: float = Field(ge=0.0, le=1.0)
    reason: str
    tradeoff: str = Field(min_length=1)
    moves: list[RecommendedMove]
    bench_moves: list[RecommendedBenchMove]
    risks: list[str]


class HiringRecommendation(BaseModel):
    project_id: int = Field(gt=0)
    role_title: str
    count: int = Field(gt=0)
    required_skills: Skills
    urgency: Urgency
    reason: str


class MatchingLlmResponse(BaseModel):
    best: BestPlan
    alternatives: list[AlternativePlan] = Field(max_length=2)
    hiring_recommendations: list[HiringRecommendation]
