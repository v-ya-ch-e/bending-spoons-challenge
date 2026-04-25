from pydantic import BaseModel, Field

from schemas.common import Skills


class SkillProfileRequest(BaseModel):
    project_id: int = Field(gt=0)
    github_page: str = Field(min_length=1)
    project_description: str = Field(min_length=1)


class SkillProfileResponse(BaseModel):
    required_people_amount: int = Field(ge=0)
    required_skills_per_person: list[Skills]
