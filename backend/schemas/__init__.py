"""Pydantic API request/response schemas."""

from schemas.common import Skills
from schemas.matching import (
    MatchingCandidateResponse,
    MatchingHiringRecommendationResponse,
    MatchingHiringSuggestionResponse,
    MatchingLlmRequest,
    MatchingLlmResponse,
    MatchingMoveResponse,
    MatchingRecommendationResponse,
    MatchingRunEventResponse,
    MatchingRunDiagnosticsResponse,
    MatchingRunRequest,
    MatchingRunResponse,
    MatchingRunSummaryResponse,
    MatchingSuggestionImpactResponse,
    MatchingSuggestionMoveResponse,
    MatchingSuggestionResponse,
)
from schemas.project_documentation import (
    DocumentationChatMessage,
    ProjectDocumentationChatRequest,
    ProjectDocumentationChatResponse,
    ProjectDocumentationResponse,
)
from schemas.skill_profiles import SkillProfileRequest, SkillProfileResponse

__all__ = [
    "DocumentationChatMessage",
    "MatchingCandidateResponse",
    "MatchingHiringRecommendationResponse",
    "MatchingHiringSuggestionResponse",
    "MatchingLlmRequest",
    "MatchingLlmResponse",
    "MatchingMoveResponse",
    "MatchingRecommendationResponse",
    "MatchingRunEventResponse",
    "MatchingRunDiagnosticsResponse",
    "MatchingRunRequest",
    "MatchingRunResponse",
    "MatchingRunSummaryResponse",
    "MatchingSuggestionImpactResponse",
    "MatchingSuggestionMoveResponse",
    "MatchingSuggestionResponse",
    "ProjectDocumentationChatRequest",
    "ProjectDocumentationChatResponse",
    "ProjectDocumentationResponse",
    "SkillProfileRequest",
    "SkillProfileResponse",
    "Skills",
]
