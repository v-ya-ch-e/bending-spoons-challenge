from pydantic import BaseModel, Field
from typing import Optional

from schemas.common import SkillCategory, SkillLevel, ProjectStatus


class SkillProfileSuggestRequest(BaseModel):
    github_repo_url: str
    project_status: ProjectStatus = ProjectStatus.NEW
    task_description: Optional[str] = None


class RoleRequirement(BaseModel):
    role_name: str
    count: int = Field(default=1, ge=1)
    required_skills: dict[SkillCategory, SkillLevel]
    reasoning: str


class StaffingSuggestion(BaseModel):
    roles: list[RoleRequirement]
    summary: str
    total_headcount: int


class SkillProfile(BaseModel):
    skills: dict[SkillCategory, SkillLevel]
    domain_tags: list[str] = []
    summary: str = ""
    confidence: float = Field(ge=0, le=1)
    evidence: list[str] = []
    approved: bool = False
