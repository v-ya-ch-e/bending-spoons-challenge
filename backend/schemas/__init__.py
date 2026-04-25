"""Pydantic API request/response schemas, mirroring the db-rest-api contract."""

from schemas.common import (
    CurrentProjectImpact,
    MoveRequestStatus,
    ProjectPhase,
    SkillKey,
    SkillLevel,
    Skills,
)
from schemas.employees import Employee, EmployeeCreate, EmployeeUpdate
from schemas.matching import EmployeeRecommendation, MatchingResult, MatchRequest
from schemas.move_requests import (
    MoveRequest,
    MoveRequestCreate,
    MoveRequestUpdate,
)
from schemas.projects import Project, ProjectCreate, ProjectUpdate
from schemas.skill_profiles import (
    RoleRequirement,
    SkillProfile,
    SkillProfileSuggestRequest,
    StaffingSuggestion,
)

__all__ = [
    "CurrentProjectImpact",
    "Employee",
    "EmployeeCreate",
    "EmployeeRecommendation",
    "EmployeeUpdate",
    "MatchRequest",
    "MatchingResult",
    "MoveRequest",
    "MoveRequestCreate",
    "MoveRequestStatus",
    "MoveRequestUpdate",
    "Project",
    "ProjectCreate",
    "ProjectPhase",
    "ProjectUpdate",
    "RoleRequirement",
    "SkillKey",
    "SkillLevel",
    "SkillProfile",
    "SkillProfileSuggestRequest",
    "Skills",
    "StaffingSuggestion",
]
