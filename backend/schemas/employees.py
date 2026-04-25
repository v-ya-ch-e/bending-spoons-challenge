from pydantic import BaseModel, Field

from schemas.common import Skills


class EmployeeBase(BaseModel):
    name: str = Field(max_length=255)
    role: str = Field(max_length=255)
    skills: Skills
    preferences: list[str]
    interests: list[str]


class EmployeeCreate(EmployeeBase):
    # Assignments are optional on create; ids win if both are provided.
    current_project_ids: list[int] | None = None
    current_project: str | None = Field(default=None, max_length=255)


class EmployeeUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=255)
    role: str | None = Field(default=None, max_length=255)
    skills: Skills | None = None
    preferences: list[str] | None = None
    interests: list[str] | None = None
    current_project_ids: list[int] | None = None
    current_project: str | None = Field(default=None, max_length=255)


class Employee(EmployeeBase):
    id: int
    current_project_ids: list[int]
    current_project_names: list[str]
    # Legacy display alias: first assigned project name, or null.
    current_project: str | None = None
