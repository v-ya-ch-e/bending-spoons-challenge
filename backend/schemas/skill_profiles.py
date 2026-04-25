from pydantic import BaseModel, Field, model_validator

from schemas.common import ProjectPhase, ProjectSkillRequirements, Skills


class SkillProfileSuggestRequest(BaseModel):
    github_repo_url: str | None = None
    github_repo_urls: list[str] = Field(default_factory=list, max_length=5)
    project_phase: ProjectPhase = ProjectPhase.NEW_ACQUISITION
    task_description: str | None = None

    @model_validator(mode="after")
    def require_repository_url(self) -> "SkillProfileSuggestRequest":
        if not self.github_repo_url and not self.github_repo_urls:
            raise ValueError("At least one GitHub repository URL is required")

        return self


class RoleRequirement(BaseModel):
    role_name: str
    count: int = Field(default=1, ge=1)
    required_skills: Skills
    reasoning: str


class StaffingSuggestion(BaseModel):
    roles: list[RoleRequirement]
    required_skills: ProjectSkillRequirements
    summary: str
    total_headcount: int


class SkillProfile(BaseModel):
    skills: Skills
    domain_tags: list[str] = []
    summary: str = ""
    confidence: float = Field(ge=0, le=1)
    evidence: list[str] = []
    approved: bool = False
