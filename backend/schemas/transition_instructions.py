from typing import Literal

from pydantic import BaseModel


TransitionInstructionType = Literal["onboarding", "offboarding"]
TransitionInstructionStatus = Literal["pending", "running", "ready", "failed", "solved"]


class TransitionInstructionResponse(BaseModel):
    id: int
    move_request_id: int
    instruction_type: TransitionInstructionType
    status: TransitionInstructionStatus
    content_markdown: str
    input_snapshot: dict | None = None
    source_documentation_id: int | None = None
    source_documentation_updated_at: str | None = None
    model_metadata: dict | None = None
    last_error: str | None = None
    solved_at: str | None = None
    solved_by_employee_id: int | None = None
    employee_id: int
    employee_name: str
    from_project_id: int | None = None
    from_project_name: str | None = None
    to_project_id: int
    to_project_name: str
    created_at: str
    updated_at: str
