from pydantic import BaseModel, Field


class Skills(BaseModel):
    """The six-key skill object. Values are integers 0-3."""

    android: int = Field(ge=0, le=3)
    ios: int = Field(ge=0, le=3)
    web: int = Field(ge=0, le=3)
    backend: int = Field(ge=0, le=3)
    infrastructure: int = Field(ge=0, le=3)
    ai: int = Field(ge=0, le=3)


class ProjectSkillRequirement(BaseModel):
    level_1: int = Field(ge=0)
    level_2: int = Field(ge=0)
    level_3: int = Field(ge=0)


class ProjectSkillRequirements(BaseModel):
    android: ProjectSkillRequirement
    ios: ProjectSkillRequirement
    web: ProjectSkillRequirement
    backend: ProjectSkillRequirement
    infrastructure: ProjectSkillRequirement
    ai: ProjectSkillRequirement
