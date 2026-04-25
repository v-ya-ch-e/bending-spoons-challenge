from pydantic import BaseModel, Field

from schemas.common import ProjectPhase, ProjectSkillRequirements


class ProjectBase(BaseModel):
    project_name: str = Field(max_length=255)
    project_description: str
    project_phase: ProjectPhase
    icon_url: str = Field(min_length=1, max_length=2048, pattern=r"^https://")
    poster_url: str = Field(min_length=1, max_length=2048, pattern=r"^https://")
    required_people_amount: int = Field(ge=0)
    required_skills: ProjectSkillRequirements
    github_repositories: list[str]


class ProjectCreate(ProjectBase):
    # Assignments are optional on create; ids win if both are provided.
    current_team_member_ids: list[int] | None = None
    current_team_members: list[str] | None = None


class ProjectUpdate(BaseModel):
    project_name: str | None = Field(default=None, max_length=255)
    project_description: str | None = None
    project_phase: ProjectPhase | None = None
    icon_url: str | None = Field(
        default=None, min_length=1, max_length=2048, pattern=r"^https://"
    )
    poster_url: str | None = Field(
        default=None, min_length=1, max_length=2048, pattern=r"^https://"
    )
    required_people_amount: int | None = Field(default=None, ge=0)
    required_skills: ProjectSkillRequirements | None = None
    github_repositories: list[str] | None = None
    current_team_member_ids: list[int] | None = None
    current_team_members: list[str] | None = None


class Project(ProjectBase):
    id: int
    current_team_member_ids: list[int]
    current_team_members: list[str]
