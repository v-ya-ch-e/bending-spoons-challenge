from pydantic import BaseModel, Field

from schemas.common import SkillCategory, SkillLevel


class SkillProfileSuggestRequest(BaseModel):
    github_repo_url: str


class SkillProfile(BaseModel):
    skills: dict[SkillCategory, SkillLevel]
    domain_tags: list[str] = []
    summary: str = ""
    confidence: float = Field(ge=0, le=1)
    evidence: list[str] = []
    approved: bool = False
