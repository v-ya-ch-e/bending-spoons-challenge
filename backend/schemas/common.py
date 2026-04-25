"""Shared enums and value types matching the DB API contract.

Keep field names, enum values, and skill keys identical to those documented in
``docs/DB_API_DOCUMENTATION.md`` so request/response bodies pass through to
``db-rest-api`` without translation.
"""

from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field


class ProjectPhase(str, Enum):
    NEW_ACQUISITION = "new acquisition"
    GROWTH = "growth"
    MAINTENANCE = "maintenance"


class CurrentProjectImpact(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class MoveRequestStatus(str, Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    CLARIFICATION_REQUESTED = "clarification_requested"


SkillKey = Literal["android", "ios", "web", "backend", "infrastructure", "ai"]
SkillLevel = Literal[0, 1, 2, 3]


class Skills(BaseModel):
    """The six-key skill object used by both employees and projects.

    All keys are required; values are integers 0-3 per the documented scale.
    """

    android: int = Field(ge=0, le=3)
    ios: int = Field(ge=0, le=3)
    web: int = Field(ge=0, le=3)
    backend: int = Field(ge=0, le=3)
    infrastructure: int = Field(ge=0, le=3)
    ai: int = Field(ge=0, le=3)
