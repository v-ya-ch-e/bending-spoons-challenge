from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from clients import DbApiClient
from schemas import (
    MatchingCandidateResponse,
    MatchingHiringRecommendationResponse,
    MatchingMoveResponse,
    MatchingRunEventResponse,
    MatchingRunRequest,
    MatchingRunResponse,
)
from services.matching.config import build_rule_config
from services.matching.logging import event_payload
from services.matching.models import CandidatePlan, MatchingUseCase, StrictRulesResult
from services.matching.strict_rules import normalize_snapshot, run_strict_rules


def run_matching_pipeline(
    *,
    use_case: MatchingUseCase,
    target_project_id: int | None,
    request: MatchingRunRequest,
    db_client: DbApiClient | None = None,
) -> MatchingRunResponse:
    owns_client = db_client is None
    client = db_client or DbApiClient()
    run_id: int | None = None
    logs: list[dict[str, Any]] = []

    try:
        active_policy = client.get_active_policy()
        config = build_rule_config(
            policy_config=active_policy["config"],
        )
        raw_projects = _list_all(client.list_projects)
        raw_employees = _list_all(client.list_employees)
        raw_move_requests = _list_all(client.list_move_requests)
        input_snapshot = _input_snapshot_payload(
            raw_projects,
            raw_employees,
            raw_move_requests,
            target_project_id=target_project_id,
        )
        final_config = config.to_dict()
        effective_rule_config = {
            **final_config,
            "policy_id": active_policy["id"],
            "policy_name": active_policy["name"],
            "policy_config": active_policy["config"],
            "effective_config": final_config,
        }

        run = client.create_matching_run(
            {
                "use_case": use_case,
                "target_project_id": target_project_id,
                "status": "running",
                "requested_by": request.requested_by,
                "rule_config": effective_rule_config,
                "input_snapshot": input_snapshot,
                "started_at": _now(),
            }
        )
        run_id = int(run["id"])

        _emit(
            client,
            run_id,
            logs,
            event_payload(
                event_type="strict_rules.started",
                message="Started deterministic strict-rule matching.",
                metadata={
                    "use_case": use_case,
                    "target_project_id": target_project_id,
                },
            ),
        )

        snapshot = normalize_snapshot(raw_projects, raw_employees, raw_move_requests)
        result = run_strict_rules(
            use_case=use_case,
            target_project_id=target_project_id,
            snapshot=snapshot,
            config=config,
        )

        _persist_strict_result(client, run_id, logs, result)
        selected_candidate_plan_id = (
            result.candidate_plans[0].candidate_plan_id
            if result.candidate_plans
            else None
        )
        summary = _summary(result)
        completed_run = client.update_matching_run(
            run_id,
            {
                "status": "completed",
                "candidate_count": len(result.candidate_plans),
                "recommendation_count": 0,
                "hiring_recommendation_count": len(result.hiring_gaps),
                "selected_candidate_plan_id": selected_candidate_plan_id,
                "summary": summary,
                "completed_at": _now(),
            },
        )

        return _response_from_result(
            run=completed_run,
            use_case=use_case,
            target_project_id=target_project_id,
            result=result,
            logs=logs,
            max_returned_candidates=config.max_candidate_plans,
            summary=summary,
        )
    except Exception as exc:
        if run_id is not None:
            error_payload = event_payload(
                event_type="strict_rules.failed",
                message="Strict-rule matching failed.",
                level="error",
                metadata={"error": str(exc)},
            )
            try:
                _emit(client, run_id, logs, error_payload)
                client.update_matching_run(
                    run_id,
                    {
                        "status": "failed",
                        "error_message": str(exc),
                        "completed_at": _now(),
                    },
                )
            except Exception:
                pass
        raise
    finally:
        if owns_client:
            client.close()


def _persist_strict_result(
    client: DbApiClient,
    run_id: int,
    logs: list[dict[str, Any]],
    result: StrictRulesResult,
) -> None:
    _emit(
        client,
        run_id,
        logs,
        event_payload(
            event_type="strict_rules.scope_selected",
            message=(
                f"Selected {len(result.scoped_project_ids)} projects and "
                f"{len(result.scoped_employee_ids)} employees for strict rules."
            ),
            metadata={
                "projects_in_scope": len(result.scoped_project_ids),
                "employees_in_scope": len(result.scoped_employee_ids),
                "project_ids": list(result.scoped_project_ids),
                "employee_ids": list(result.scoped_employee_ids),
            },
        ),
    )
    _emit(
        client,
        run_id,
        logs,
        event_payload(
            event_type="strict_rules.coverage_computed",
            message="Computed current coverage for scoped projects.",
            metadata={
                str(project_id): {
                    "headcount_gap": coverage.headcount_gap,
                    "skill_gap": coverage.skill_gap,
                    "coverage_ratio": coverage.coverage_ratio,
                }
                for project_id, coverage in result.coverage_before.items()
            },
        ),
    )

    for candidate in result.candidate_plans:
        client.create_matching_candidate(
            run_id,
            {
                "candidate_plan_id": candidate.candidate_plan_id,
                "strict_score": candidate.strict_score,
                "hard_rule_summary": candidate.hard_rule_summary,
                "plan_payload": candidate.plan_payload(),
            },
        )

    _emit(
        client,
        run_id,
        logs,
        event_payload(
            event_type="strict_rules.candidates_generated",
            message=f"Generated {result.metadata['generated_candidate_count']} valid candidate plans.",
            metadata={
                "generated_candidate_count": result.metadata["generated_candidate_count"],
                "persisted_candidate_count": len(result.candidate_plans),
            },
        ),
    )
    _emit(
        client,
        run_id,
        logs,
        event_payload(
            event_type="strict_rules.candidates_pruned",
            message=f"Kept top {len(result.candidate_plans)} strict-rule candidates.",
            metadata={"candidate_count": len(result.candidate_plans)},
        ),
    )

    for hiring_gap in result.hiring_gaps:
        client.create_matching_hiring_recommendation(run_id, hiring_gap.to_payload())

    if result.hiring_gaps:
        _emit(
            client,
            run_id,
            logs,
            event_payload(
                event_type="strict_rules.hiring_gaps_detected",
                message=f"Detected {len(result.hiring_gaps)} hiring gaps.",
                stage="hiring_gap",
                level="warning",
                metadata={"hiring_gap_count": len(result.hiring_gaps)},
            ),
        )

    if result.candidate_plans:
        _emit(
            client,
            run_id,
            logs,
            event_payload(
                event_type="strict_rules.completed",
                message=f"Completed strict rules with {len(result.candidate_plans)} candidates.",
                metadata={"candidate_count": len(result.candidate_plans)},
            ),
        )
    else:
        _emit(
            client,
            run_id,
            logs,
            event_payload(
                event_type="strict_rules.no_candidates",
                message="No strict-rule candidate plans were found.",
                level="warning",
                metadata={"hiring_gap_count": len(result.hiring_gaps)},
            ),
        )


def _emit(
    client: DbApiClient,
    run_id: int,
    logs: list[dict[str, Any]],
    payload: dict[str, Any],
) -> None:
    client.create_matching_run_event(run_id, payload)
    logs.append(payload)


def _list_all(method: Any, *, page_size: int = 100) -> list[dict]:
    items: list[dict] = []
    offset = 0
    while True:
        page = method(limit=page_size, offset=offset)
        items.extend(page)
        if len(page) < page_size:
            return items
        offset += page_size


def _input_snapshot_payload(
    projects: list[dict],
    employees: list[dict],
    move_requests: list[dict],
    *,
    target_project_id: int | None,
) -> dict[str, Any]:
    return {
        "target_project_id": target_project_id,
        "project_ids": [project["id"] for project in projects],
        "employee_ids": [employee["id"] for employee in employees],
        "move_request_ids": [request["id"] for request in move_requests],
        "projects": projects,
        "employees": employees,
        "move_requests": move_requests,
    }


def _response_from_result(
    *,
    run: dict,
    use_case: MatchingUseCase,
    target_project_id: int | None,
    result: StrictRulesResult,
    logs: list[dict[str, Any]],
    max_returned_candidates: int,
    summary: str,
) -> MatchingRunResponse:
    return MatchingRunResponse(
        run_id=int(run["id"]),
        use_case=use_case,
        status=run.get("status", "completed"),
        target_project_id=target_project_id,
        candidate_count=len(result.candidate_plans),
        recommendation_count=0,
        hiring_recommendation_count=len(result.hiring_gaps),
        summary=summary,
        candidates=[
            _candidate_response(candidate)
            for candidate in result.candidate_plans[:max_returned_candidates]
        ],
        hiring_recommendations=[
            MatchingHiringRecommendationResponse(**gap.to_payload())
            for gap in result.hiring_gaps
        ],
        logs=[MatchingRunEventResponse(**log) for log in logs],
    )


def _candidate_response(candidate: CandidatePlan) -> MatchingCandidateResponse:
    return MatchingCandidateResponse(
        candidate_plan_id=candidate.candidate_plan_id,
        strict_score=candidate.strict_score,
        summary=candidate.summary,
        moves=[
            MatchingMoveResponse(**move.to_payload())
            for move in candidate.moves
        ],
        risks=list(candidate.risks),
        hard_rule_summary=candidate.hard_rule_summary,
        plan_payload=candidate.plan_payload(),
    )


def _summary(result: StrictRulesResult) -> str:
    if result.candidate_plans:
        return (
            f"Generated {len(result.candidate_plans)} deterministic strict-rule "
            f"candidate plans and {len(result.hiring_gaps)} hiring gaps."
        )
    if result.hiring_gaps:
        return (
            "No safe internal reassignment candidates were found; "
            f"generated {len(result.hiring_gaps)} hiring gaps."
        )
    return "No strict-rule candidates or hiring gaps were found for this snapshot."


def _now() -> str:
    return datetime.now(UTC).replace(tzinfo=None).isoformat()
