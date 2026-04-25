from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal


CANONICAL_SKILLS = (
    "android",
    "ios",
    "web",
    "backend",
    "infrastructure",
    "ai",
)

SkillMap = dict[str, int]
MatchingUseCase = Literal[
    "portfolio_rebalance",
    "project_rebalance",
    "project_staffing",
]
MoveAction = Literal["assign", "move", "add_assignment"]
Impact = Literal["low", "medium", "high"]
Urgency = Literal["low", "medium", "high"]


@dataclass(frozen=True)
class ProjectSnapshot:
    id: int
    name: str
    project_phase: str
    required_people_amount: int
    required_skills: SkillMap
    current_team_member_ids: tuple[int, ...]


@dataclass(frozen=True)
class EmployeeSnapshot:
    id: int
    name: str
    role: str
    skills: SkillMap
    preferences: tuple[str, ...]
    interests: tuple[str, ...]
    current_project_ids: tuple[int, ...]


@dataclass(frozen=True)
class MoveRequestSnapshot:
    id: int
    employee_id: int
    from_project_id: int | None
    to_project_id: int
    status: str


@dataclass(frozen=True)
class MatchingSnapshot:
    projects: dict[int, ProjectSnapshot]
    employees: dict[int, EmployeeSnapshot]
    move_requests: tuple[MoveRequestSnapshot, ...] = ()


@dataclass(frozen=True)
class ProjectCoverage:
    project_id: int
    team_member_ids: tuple[int, ...]
    available_skills: SkillMap
    skill_gap: SkillMap
    headcount_gap: int
    coverage_ratio: float

    @property
    def skill_gap_total(self) -> int:
        return sum(self.skill_gap.values())

    @property
    def total_gap(self) -> float:
        return float(self.headcount_gap) + (self.skill_gap_total / 3.0)


@dataclass(frozen=True)
class ScopedSnapshot:
    projects: dict[int, ProjectSnapshot]
    employees: dict[int, EmployeeSnapshot]
    target_project_ids: tuple[int, ...]
    blocked_employee_ids: frozenset[int]
    blocked_project_ids: frozenset[int]
    current_coverage: dict[int, ProjectCoverage]


@dataclass(frozen=True)
class CandidateMove:
    employee_id: int
    from_project_id: int | None
    to_project_id: int
    action: MoveAction
    suggested_role: str
    current_project_impact: Impact
    hard_rule_reasons: tuple[str, ...]
    reason: str

    def to_payload(self) -> dict:
        return {
            "employee_id": self.employee_id,
            "from_project_id": self.from_project_id,
            "to_project_id": self.to_project_id,
            "action": self.action,
            "suggested_role": self.suggested_role,
            "current_project_impact": self.current_project_impact,
            "hard_rule_reasons": list(self.hard_rule_reasons),
            "reason": self.reason,
        }


@dataclass(frozen=True)
class CandidatePlan:
    candidate_plan_id: str
    strict_score: float
    summary: str
    moves: tuple[CandidateMove, ...]
    risks: tuple[str, ...]
    hard_rule_summary: dict
    project_coverage_after: dict[int, ProjectCoverage]

    def plan_payload(self) -> dict:
        return {
            "summary": self.summary,
            "moves": [move.to_payload() for move in self.moves],
            "risks": list(self.risks),
            "project_coverage_after": {
                str(project_id): {
                    "headcount_gap": coverage.headcount_gap,
                    "skill_gap": coverage.skill_gap,
                    "available_skills": coverage.available_skills,
                    "coverage_ratio": coverage.coverage_ratio,
                }
                for project_id, coverage in self.project_coverage_after.items()
            },
        }


@dataclass(frozen=True)
class HiringGap:
    project_id: int
    role_title: str
    count: int
    required_skills: SkillMap
    reason: str
    urgency: Urgency
    candidate_plan_id: str | None = None
    suggested_assignment: str = "Hire directly into the target project."

    def to_payload(self) -> dict:
        return {
            "candidate_plan_id": self.candidate_plan_id,
            "project_id": self.project_id,
            "role_title": self.role_title,
            "count": self.count,
            "required_skills": self.required_skills,
            "reason": self.reason,
            "urgency": self.urgency,
            "suggested_assignment": self.suggested_assignment,
        }


@dataclass(frozen=True)
class StrictRulesResult:
    candidate_plans: tuple[CandidatePlan, ...]
    hiring_gaps: tuple[HiringGap, ...]
    scoped_project_ids: tuple[int, ...]
    scoped_employee_ids: tuple[int, ...]
    coverage_before: dict[int, ProjectCoverage]
    metadata: dict = field(default_factory=dict)
