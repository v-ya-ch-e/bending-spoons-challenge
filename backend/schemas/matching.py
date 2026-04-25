from typing import Literal

from pydantic import BaseModel, Field

from schemas.common import Skills


Impact = Literal["low", "medium", "high"]
Urgency = Literal["low", "medium", "high"]


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
    from_project_id: int = Field(gt=0)
    from_project_name: str
    to_project_id: int = Field(gt=0)
    to_project_name: str
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
    from_project_id: int = Field(gt=0)
    to_project_id: int = Field(gt=0)
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
