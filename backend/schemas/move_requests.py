from datetime import datetime

from pydantic import BaseModel, Field

from schemas.common import CurrentProjectImpact, MoveRequestStatus


class MoveRequestBase(BaseModel):
    employee_id: int
    from_project_id: int | None = None
    to_project_id: int
    reason: str
    expected_role: str = Field(max_length=255)
    current_project_impact: CurrentProjectImpact


class MoveRequestCreate(MoveRequestBase):
    status: MoveRequestStatus = MoveRequestStatus.PENDING


class MoveRequestUpdate(BaseModel):
    employee_id: int | None = None
    from_project_id: int | None = None
    to_project_id: int | None = None
    reason: str | None = None
    expected_role: str | None = Field(default=None, max_length=255)
    current_project_impact: CurrentProjectImpact | None = None
    status: MoveRequestStatus | None = None


class MoveRequest(MoveRequestBase):
    id: int
    status: MoveRequestStatus
    created_at: datetime
    responded_at: datetime | None = None
    employee_name: str
    from_project_name: str | None = None
    to_project_name: str
