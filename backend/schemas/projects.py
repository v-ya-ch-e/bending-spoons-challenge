from pydantic import BaseModel


class ProjectBase(BaseModel):
    name: str
    description: str = ""
    github_repo_url: str | None = None


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    github_repo_url: str | None = None


class Project(ProjectBase):
    id: int
