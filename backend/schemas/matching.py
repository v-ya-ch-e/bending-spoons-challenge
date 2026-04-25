from pydantic import BaseModel, Field


class MatchRequest(BaseModel):
    team_size: int = Field(default=3, ge=1)


class EmployeeRecommendation(BaseModel):
    employee_id: int
    name: str
    fit_score: float = Field(ge=0, le=1)
    explanation: str
    risks: list[str] = []
    ramp_up_estimate: str
    suggested_role: str


class MatchingResult(BaseModel):
    project_id: int
    recommendations: list[EmployeeRecommendation]
    summary: str
