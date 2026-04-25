from schemas import MatchingResult, MatchRequest


def run_matching(project_id: int, payload: MatchRequest) -> MatchingResult:
    raise NotImplementedError("Matching is not implemented yet")


def get_latest_matching_result(project_id: int) -> MatchingResult:
    raise NotImplementedError("Matching result lookup is not implemented yet")
