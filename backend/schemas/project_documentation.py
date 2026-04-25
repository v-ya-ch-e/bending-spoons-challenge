from typing import Literal

from pydantic import BaseModel, Field


DocumentationStatus = Literal["pending", "running", "ready", "failed"]


class ProjectDocumentationResponse(BaseModel):
    id: int
    project_id: int
    project_name: str
    status: DocumentationStatus
    content_markdown: str
    source_repositories: list[str]
    source_snapshot: dict | None = None
    model_metadata: dict | None = None
    last_error: str | None = None
    last_generated_at: str | None = None
    created_at: str
    updated_at: str


class DocumentationChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1)


class ProjectDocumentationChatRequest(BaseModel):
    message: str = Field(min_length=1)
    history: list[DocumentationChatMessage] = Field(default_factory=list)
    mode: Literal["ask", "edit"] = "ask"


class ProjectDocumentationChatResponse(BaseModel):
    answer: str
    updated_content_markdown: str | None = None
