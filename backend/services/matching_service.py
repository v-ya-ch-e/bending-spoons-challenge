from __future__ import annotations

from schemas import MatchingRunRequest, MatchingRunResponse
from services.matching import run_matching_pipeline
from services.matching.models import MatchingUseCase


def run_matching(
    *,
    use_case: MatchingUseCase,
    target_project_id: int | None,
    request: MatchingRunRequest,
) -> MatchingRunResponse:
    return run_matching_pipeline(
        use_case=use_case,
        target_project_id=target_project_id,
        request=request,
    )
