from __future__ import annotations

import asyncio
import inspect
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime
from typing import Any

from clients import DbApiClient, get_openai_model
from schemas import (
    MatchingCandidateResponse,
    MatchingHiringRecommendationResponse,
    MatchingLlmRequest,
    MatchingLlmResponse,
    MatchingMoveResponse,
    MatchingRecommendationResponse,
    MatchingRunEventResponse,
    MatchingRunRequest,
    MatchingRunResponse,
)
from schemas.matching import (
    CandidatePlan as LlmCandidatePlan,
    CoverageAfter as LlmCoverageAfter,
    GapClosingMove,
    HiringGapHint,
    SourceProjectImpact,
    TargetProject,
)
from services.matching.config import build_rule_config
from services.matching.logging import event_payload
from services.matching.models import (
    CandidatePlan,
    MatchingSnapshot,
    MatchingUseCase,
    StrictRulesResult,
)
from services.matching.strict_rules import normalize_snapshot, run_strict_rules
from services.matching_llm_service import evaluate_matching


PROMPT_VERSION = "matching_llm_evaluator_v1"
LlmEvaluator = Callable[
    [MatchingLlmRequest],
    MatchingLlmResponse | Awaitable[MatchingLlmResponse],
]


def run_matching_pipeline(
    *,
    use_case: MatchingUseCase,
    target_project_id: int | None,
    request: MatchingRunRequest,
    db_client: DbApiClient | None = None,
    llm_evaluator: LlmEvaluator | None = None,
) -> MatchingRunResponse:
    owns_client = db_client is None
    client = db_client or DbApiClient()
    run_id: int | None = None
    logs: list[dict[str, Any]] = []
    failure_stage = "strict_rules"

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

        _persist_strict_result(
            client,
            run_id,
            logs,
            result,
            persist_hiring_gaps=not result.candidate_plans,
        )
        recommendations: list[dict[str, Any]] = []
        selected_candidate_plan_id: str | None = None
        hiring_recommendation_payloads = [gap.to_payload() for gap in result.hiring_gaps]
        summary = _summary(result)

        if result.candidate_plans:
            failure_stage = "llm_evaluation"
            _emit(
                client,
                run_id,
                logs,
                event_payload(
                    event_type="llm_evaluation.started",
                    message="Started OpenAI evaluation of strict-rule candidates.",
                    stage="llm_evaluation",
                    metadata={
                        "candidate_count": len(result.candidate_plans),
                        "hiring_gap_hint_count": len(result.hiring_gaps),
                    },
                ),
            )
            llm_request = _llm_request_from_result(
                use_case=use_case,
                target_project_id=target_project_id,
                snapshot=snapshot,
                result=result,
            )
            llm_result = _evaluate_matching_sync(llm_request, llm_evaluator)
            selected_candidate_plan_id = llm_result.best.candidate_plan_id
            recommendations = _persist_llm_recommendations(
                client,
                run_id,
                logs,
                result,
                llm_result,
            )
            hiring_recommendation_payloads = _persist_llm_hiring_recommendations(
                client,
                run_id,
                selected_candidate_plan_id,
                result,
                llm_result,
            )
            summary = _llm_summary(
                result=result,
                recommendation_count=len(recommendations),
                hiring_recommendation_count=len(hiring_recommendation_payloads),
                selected_candidate_plan_id=selected_candidate_plan_id,
            )

        completed_run = client.update_matching_run(
            run_id,
            {
                "status": "completed",
                "candidate_count": len(result.candidate_plans),
                "recommendation_count": len(recommendations),
                "hiring_recommendation_count": len(hiring_recommendation_payloads),
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
            recommendations=recommendations,
            selected_candidate_plan_id=selected_candidate_plan_id,
            hiring_recommendation_payloads=hiring_recommendation_payloads,
            summary=summary,
        )
    except Exception as exc:
        if run_id is not None:
            event_type = (
                "llm_evaluation.failed"
                if failure_stage == "llm_evaluation"
                else "strict_rules.failed"
            )
            message = (
                "OpenAI evaluation failed."
                if failure_stage == "llm_evaluation"
                else "Strict-rule matching failed."
            )
            error_payload = event_payload(
                event_type=event_type,
                message=message,
                level="error",
                stage=failure_stage,
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
    *,
    persist_hiring_gaps: bool,
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

    if persist_hiring_gaps:
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
    recommendations: list[dict[str, Any]],
    selected_candidate_plan_id: str | None,
    hiring_recommendation_payloads: list[dict[str, Any]],
    summary: str,
) -> MatchingRunResponse:
    return MatchingRunResponse(
        run_id=int(run["id"]),
        use_case=use_case,
        status=run.get("status", "completed"),
        target_project_id=target_project_id,
        candidate_count=len(result.candidate_plans),
        recommendation_count=len(recommendations),
        hiring_recommendation_count=len(hiring_recommendation_payloads),
        selected_candidate_plan_id=selected_candidate_plan_id,
        summary=summary,
        candidates=[
            _candidate_response(candidate)
            for candidate in result.candidate_plans[:max_returned_candidates]
        ],
        recommendations=[
            MatchingRecommendationResponse(**recommendation)
            for recommendation in recommendations
        ],
        hiring_recommendations=[
            MatchingHiringRecommendationResponse(**payload)
            for payload in hiring_recommendation_payloads
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


def _evaluate_matching_sync(
    payload: MatchingLlmRequest,
    llm_evaluator: LlmEvaluator | None,
) -> MatchingLlmResponse:
    result = (
        llm_evaluator(payload)
        if llm_evaluator is not None
        else evaluate_matching(payload)
    )
    if inspect.isawaitable(result):
        return asyncio.run(result)
    return result


def _llm_request_from_result(
    *,
    use_case: MatchingUseCase,
    target_project_id: int | None,
    snapshot: MatchingSnapshot,
    result: StrictRulesResult,
) -> MatchingLlmRequest:
    primary_target_project_id = _primary_target_project_id(target_project_id, result)
    target_project = snapshot.projects[primary_target_project_id]
    return MatchingLlmRequest(
        use_case=use_case,
        target_project=TargetProject(
            id=target_project.id,
            name=target_project.name,
            phase=target_project.project_phase,
            required_people_amount=target_project.required_people_amount,
            required_skills=target_project.required_skills,
        ),
        candidate_plans=[
            _llm_candidate_plan(candidate, snapshot)
            for candidate in result.candidate_plans
        ],
        hiring_gap_hints=[
            HiringGapHint(
                project_id=gap.project_id,
                role_title=gap.role_title,
                count=gap.count,
                required_skills=gap.required_skills,
            )
            for gap in result.hiring_gaps
        ],
    )


def _llm_candidate_plan(
    candidate: CandidatePlan,
    snapshot: MatchingSnapshot,
) -> LlmCandidatePlan:
    target_project_id = int(candidate.hard_rule_summary["target_project_id"])
    target_coverage = candidate.project_coverage_after[target_project_id]
    return LlmCandidatePlan(
        candidate_plan_id=candidate.candidate_plan_id,
        gap_closing_moves=[
            GapClosingMove(
                employee_id=move.employee_id,
                name=snapshot.employees[move.employee_id].name,
                role=snapshot.employees[move.employee_id].role,
                from_project_id=move.from_project_id,
                from_project_name=_project_name(snapshot, move.from_project_id),
                to_project_id=move.to_project_id,
                to_project_name=(
                    _project_name(snapshot, move.to_project_id) or str(move.to_project_id)
                ),
                action=move.action,
                skills=snapshot.employees[move.employee_id].skills,
                preferences=list(snapshot.employees[move.employee_id].preferences),
                interests=list(snapshot.employees[move.employee_id].interests),
            )
            for move in candidate.moves
        ],
        bench_moves=[],
        coverage_after=LlmCoverageAfter(
            headcount_gap=target_coverage.headcount_gap,
            skill_gap=target_coverage.skill_gap,
        ),
        source_project_impacts=_source_project_impacts(candidate, snapshot),
    )


def _source_project_impacts(
    candidate: CandidatePlan,
    snapshot: MatchingSnapshot,
) -> list[SourceProjectImpact]:
    impacts: list[SourceProjectImpact] = []
    seen_project_ids: set[int] = set()
    for move in candidate.moves:
        if move.from_project_id is None or move.from_project_id in seen_project_ids:
            continue
        project_name = _project_name(snapshot, move.from_project_id)
        if project_name is None:
            continue
        seen_project_ids.add(move.from_project_id)
        impacts.append(
            SourceProjectImpact(
                project_id=move.from_project_id,
                project_name=project_name,
                impact=move.current_project_impact,
            )
        )
    return impacts


def _persist_llm_recommendations(
    client: DbApiClient,
    run_id: int,
    logs: list[dict[str, Any]],
    result: StrictRulesResult,
    llm_result: MatchingLlmResponse,
) -> list[dict[str, Any]]:
    recommendations = _recommendation_payloads(result, llm_result)
    created = [
        client.create_matching_recommendation(run_id, recommendation)
        for recommendation in recommendations
    ]
    _emit(
        client,
        run_id,
        logs,
        event_payload(
            event_type="llm_evaluation.completed",
            message=(
                f"OpenAI selected {llm_result.best.candidate_plan_id} "
                f"and returned {len(created)} ranked recommendations."
            ),
            stage="llm_evaluation",
            metadata={
                "selected_candidate_plan_id": llm_result.best.candidate_plan_id,
                "recommendation_count": len(created),
            },
        ),
    )
    return created


def _persist_llm_hiring_recommendations(
    client: DbApiClient,
    run_id: int,
    selected_candidate_plan_id: str,
    result: StrictRulesResult,
    llm_result: MatchingLlmResponse,
) -> list[dict[str, Any]]:
    payloads: list[dict[str, Any]]
    if llm_result.hiring_recommendations:
        payloads = [
            {
                "candidate_plan_id": selected_candidate_plan_id,
                "project_id": recommendation.project_id,
                "role_title": recommendation.role_title,
                "count": recommendation.count,
                "required_skills": recommendation.required_skills.model_dump(),
                "reason": recommendation.reason,
                "urgency": recommendation.urgency,
                "suggested_assignment": "Hire directly into the target project.",
            }
            for recommendation in llm_result.hiring_recommendations
        ]
    else:
        payloads = [gap.to_payload() for gap in result.hiring_gaps]

    return [
        client.create_matching_hiring_recommendation(run_id, payload)
        for payload in payloads
    ]


def _recommendation_payloads(
    result: StrictRulesResult,
    llm_result: MatchingLlmResponse,
) -> list[dict[str, Any]]:
    ranked = [llm_result.best, *llm_result.alternatives]
    candidates_by_id = {
        candidate.candidate_plan_id: candidate
        for candidate in result.candidate_plans
    }
    model_metadata = {
        "model": get_openai_model(),
        "prompt_version": PROMPT_VERSION,
    }
    payloads: list[dict[str, Any]] = []
    for rank, recommendation in enumerate(ranked, start=1):
        explanation = recommendation.reason
        tradeoff = getattr(recommendation, "tradeoff", None)
        if tradeoff:
            explanation = f"{recommendation.reason} Tradeoff: {tradeoff}"
        payloads.append(
            {
                "candidate_plan_id": recommendation.candidate_plan_id,
                "rank": rank,
                "fit_score": recommendation.fit_score,
                "summary": recommendation.reason,
                "explanation": explanation,
                "risks": list(recommendation.risks),
                "ramp_up_estimate": None,
                "suggested_moves": _suggested_moves(
                    candidates_by_id[recommendation.candidate_plan_id],
                    recommendation,
                ),
                "model_metadata": model_metadata,
            }
        )
    return payloads


def _suggested_moves(
    candidate: CandidatePlan,
    recommendation: Any,
) -> list[dict[str, Any]]:
    llm_moves_by_key = {
        (move.employee_id, move.from_project_id, move.to_project_id, move.action): move
        for move in recommendation.moves
    }
    suggested_moves: list[dict[str, Any]] = []
    for move in candidate.moves:
        override = llm_moves_by_key.get(
            (move.employee_id, move.from_project_id, move.to_project_id, move.action)
        )
        payload = move.to_payload()
        if override is not None:
            payload["suggested_role"] = override.suggested_role
            payload["current_project_impact"] = override.current_project_impact
        payload["move_request_reason"] = recommendation.reason
        suggested_moves.append(payload)
    return suggested_moves


def _primary_target_project_id(
    target_project_id: int | None,
    result: StrictRulesResult,
) -> int:
    if target_project_id is not None:
        return target_project_id
    return int(result.candidate_plans[0].hard_rule_summary["target_project_id"])


def _project_name(snapshot: MatchingSnapshot, project_id: int | None) -> str | None:
    if project_id is None:
        return None
    project = snapshot.projects.get(project_id)
    return project.name if project is not None else None


def _llm_summary(
    *,
    result: StrictRulesResult,
    recommendation_count: int,
    hiring_recommendation_count: int,
    selected_candidate_plan_id: str,
) -> str:
    return (
        f"Generated {len(result.candidate_plans)} strict-rule candidate plans; "
        f"OpenAI selected {selected_candidate_plan_id} and returned "
        f"{recommendation_count} ranked recommendations with "
        f"{hiring_recommendation_count} hiring recommendations."
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
