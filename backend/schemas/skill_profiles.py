from pydantic import BaseModel, Field

from schemas.common import ProjectPhase, Skills


class SkillProfileSuggestRequest(BaseModel):
    github_repo_url: str
    project_phase: ProjectPhase = ProjectPhase.NEW_ACQUISITION
    task_description: str | None = None


class RoleRequirement(BaseModel):
    role_name: str
    count: int = Field(default=1, ge=1)
    required_skills: Skills
    reasoning: str


class StaffingSuggestion(BaseModel):
    roles: list[RoleRequirement]
    summary: str
    total_headcount: int


class SkillProfile(BaseModel):
    skills: Skills
    domain_tags: list[str] = []
    summary: str = ""
    confidence: float = Field(ge=0, le=1)
    evidence: list[str] = []
    approved: bool = False
