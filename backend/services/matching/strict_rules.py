from __future__ import annotations

from itertools import combinations
from typing import Iterable

from services.matching.config import StrictRuleConfig
from services.matching.models import (
    CANONICAL_SKILLS,
    CandidateMove,
    CandidatePlan,
    EmployeeSnapshot,
    HiringGap,
    MatchingSnapshot,
    MatchingUseCase,
    MoveRequestSnapshot,
    ProjectCoverage,
    ProjectSnapshot,
    ScopedSnapshot,
    SkillMap,
    StrictRulesResult,
)

OPEN_MOVE_REQUEST_STATUSES = {"pending", "clarification_requested"}


def normalize_snapshot(
    projects_payload: Iterable[dict],
    employees_payload: Iterable[dict],
    move_requests_payload: Iterable[dict] = (),
) -> MatchingSnapshot:
    project_member_ids: dict[int, set[int]] = {}
    employee_project_ids: dict[int, set[int]] = {}

    raw_projects = list(projects_payload)
    raw_employees = list(employees_payload)

    for project in raw_projects:
        project_id = int(project["id"])
        project_member_ids[project_id] = {
            int(employee_id)
            for employee_id in project.get("current_team_member_ids", []) or []
        }

    for employee in raw_employees:
        employee_id = int(employee["id"])
        employee_project_ids[employee_id] = {
            int(project_id)
            for project_id in employee.get("current_project_ids", []) or []
        }
        for project_id in employee_project_ids[employee_id]:
            project_member_ids.setdefault(project_id, set()).add(employee_id)

    for project_id, member_ids in project_member_ids.items():
        for employee_id in member_ids:
            employee_project_ids.setdefault(employee_id, set()).add(project_id)

    projects = {
        int(project["id"]): ProjectSnapshot(
            id=int(project["id"]),
            name=str(project.get("project_name") or project.get("name") or project["id"]),
            project_phase=str(project.get("project_phase") or "maintenance"),
            required_people_amount=max(0, int(project.get("required_people_amount") or 0)),
            required_skills=_normalize_skills(project.get("required_skills") or {}),
            current_team_member_ids=tuple(
                sorted(project_member_ids.get(int(project["id"]), set()))
            ),
        )
        for project in raw_projects
    }

    employees = {
        int(employee["id"]): EmployeeSnapshot(
            id=int(employee["id"]),
            name=str(employee.get("name") or employee["id"]),
            role=str(employee.get("role") or "Engineer"),
            skills=_normalize_skills(employee.get("skills") or {}),
            preferences=tuple(str(value) for value in employee.get("preferences") or []),
            interests=tuple(str(value) for value in employee.get("interests") or []),
            current_project_ids=tuple(
                sorted(employee_project_ids.get(int(employee["id"]), set()))
            ),
        )
        for employee in raw_employees
    }

    move_requests = tuple(
        MoveRequestSnapshot(
            id=int(request["id"]),
            employee_id=int(request["employee_id"]),
            from_project_id=(
                int(request["from_project_id"])
                if request.get("from_project_id") is not None
                else None
            ),
            to_project_id=int(request["to_project_id"]),
            status=str(request.get("status") or "pending"),
        )
        for request in move_requests_payload
        if request.get("employee_id") is not None and request.get("to_project_id") is not None
    )

    return MatchingSnapshot(
        projects=projects,
        employees=employees,
        move_requests=move_requests,
    )


def run_strict_rules(
    *,
    use_case: MatchingUseCase,
    target_project_id: int | None,
    snapshot: MatchingSnapshot,
    config: StrictRuleConfig,
) -> StrictRulesResult:
    scoped = select_scope(
        use_case=use_case,
        target_project_id=target_project_id,
        snapshot=snapshot,
        config=config,
    )
    generated: list[CandidatePlan] = []

    for target_id in scoped.target_project_ids:
        moves = _candidate_moves_for_target(scoped, target_id, snapshot, config)
        for move_count in range(1, min(config.max_moves, len(moves)) + 1):
            for move_group in combinations(moves[:30], move_count):
                candidate = _build_candidate_plan(
                    target_project_id=target_id,
                    moves=move_group,
                    scoped=scoped,
                    snapshot=snapshot,
                    config=config,
                )
                if candidate is not None:
                    generated.append(candidate)

    sorted_candidates = sorted(
        _deduplicate_candidates(generated),
        key=_candidate_sort_key,
    )[: config.max_candidate_plans]
    candidate_plans = tuple(
        _with_candidate_id(candidate, index + 1)
        for index, candidate in enumerate(sorted_candidates)
    )

    hiring_gaps: tuple[HiringGap, ...] = ()
    if config.emit_hiring_gaps:
        hiring_gaps = tuple(_detect_hiring_gaps(scoped, candidate_plans, snapshot))

    return StrictRulesResult(
        candidate_plans=candidate_plans,
        hiring_gaps=hiring_gaps,
        scoped_project_ids=tuple(sorted(scoped.projects)),
        scoped_employee_ids=tuple(sorted(scoped.employees)),
        coverage_before=scoped.current_coverage,
        metadata={
            "generated_candidate_count": len(generated),
            "candidate_count": len(candidate_plans),
            "hiring_gap_count": len(hiring_gaps),
            "target_project_ids": list(scoped.target_project_ids),
            "blocked_employee_count": len(scoped.blocked_employee_ids),
        },
    )


def select_scope(
    *,
    use_case: MatchingUseCase,
    target_project_id: int | None,
    snapshot: MatchingSnapshot,
    config: StrictRuleConfig,
) -> ScopedSnapshot:
    coverage = {
        project_id: compute_project_coverage(snapshot, project_id)
        for project_id in snapshot.projects
    }
    blocked_employee_ids, blocked_project_ids = _blocked_ids(snapshot, config)

    if use_case == "portfolio_rebalance":
        return _select_portfolio_scope(
            snapshot=snapshot,
            coverage=coverage,
            blocked_employee_ids=blocked_employee_ids,
            blocked_project_ids=blocked_project_ids,
            config=config,
        )

    if target_project_id is None:
        raise ValueError("target_project_id is required for project matching")
    if target_project_id not in snapshot.projects:
        raise ValueError(f"Project {target_project_id} was not found in the snapshot")
    return _select_project_scope(
        target_project_id=target_project_id,
        snapshot=snapshot,
        coverage=coverage,
        blocked_employee_ids=blocked_employee_ids,
        blocked_project_ids=blocked_project_ids,
        config=config,
    )


def compute_project_coverage(
    snapshot: MatchingSnapshot,
    project_id: int,
    assignments: dict[int, set[int]] | None = None,
) -> ProjectCoverage:
    project = snapshot.projects[project_id]
    if assignments is None:
        team_member_ids = set(project.current_team_member_ids)
    else:
        team_member_ids = set(assignments.get(project_id, set()))

    available_skills = _empty_skills()
    for employee_id in team_member_ids:
        employee = snapshot.employees.get(employee_id)
        if employee is None:
            continue
        for skill in CANONICAL_SKILLS:
            available_skills[skill] = max(available_skills[skill], employee.skills[skill])

    skill_gap = {
        skill: max(project.required_skills[skill] - available_skills[skill], 0)
        for skill in CANONICAL_SKILLS
    }
    headcount_gap = max(project.required_people_amount - len(team_member_ids), 0)
    coverage_ratio = round(
        (_headcount_ratio(project, len(team_member_ids)) + _skill_ratio(project, available_skills))
        / 2,
        4,
    )

    return ProjectCoverage(
        project_id=project_id,
        team_member_ids=tuple(sorted(team_member_ids)),
        available_skills=available_skills,
        skill_gap=skill_gap,
        headcount_gap=headcount_gap,
        coverage_ratio=coverage_ratio,
    )


def _select_project_scope(
    *,
    target_project_id: int,
    snapshot: MatchingSnapshot,
    coverage: dict[int, ProjectCoverage],
    blocked_employee_ids: frozenset[int],
    blocked_project_ids: frozenset[int],
    config: StrictRuleConfig,
) -> ScopedSnapshot:
    target_project = snapshot.projects[target_project_id]
    target_coverage = coverage[target_project_id]

    scored_employees: list[tuple[float, int, EmployeeSnapshot]] = []
    for employee in snapshot.employees.values():
        if employee.id in blocked_employee_ids:
            continue
        if employee.id in target_project.current_team_member_ids:
            scored_employees.append((0.2, employee.id, employee))
            continue
        score = _employee_target_fit(employee, target_project, target_coverage, config)
        if not employee.current_project_ids and config.allow_unassigned_employees:
            score += 1.0
        if _has_donor_source(employee, coverage):
            score += 0.5
        if score > 0:
            scored_employees.append((score, employee.id, employee))

    scoped_employees = {
        employee.id: employee
        for _, _, employee in sorted(
            scored_employees,
            key=lambda item: (-item[0], len(item[2].current_project_ids), item[1]),
        )[: config.max_employees_in_scope]
    }

    project_ids = {target_project_id}
    for employee in scoped_employees.values():
        project_ids.update(employee.current_project_ids)
    project_ids = set(
        sorted(project_ids, key=lambda project_id: (project_id != target_project_id, project_id))[
            : config.max_projects_in_scope
        ]
    )

    return ScopedSnapshot(
        projects={
            project_id: snapshot.projects[project_id]
            for project_id in project_ids
            if project_id in snapshot.projects
        },
        employees=scoped_employees,
        target_project_ids=(target_project_id,),
        blocked_employee_ids=blocked_employee_ids,
        blocked_project_ids=blocked_project_ids,
        current_coverage={
            project_id: coverage[project_id]
            for project_id in project_ids
            if project_id in coverage
        },
    )


def _select_portfolio_scope(
    *,
    snapshot: MatchingSnapshot,
    coverage: dict[int, ProjectCoverage],
    blocked_employee_ids: frozenset[int],
    blocked_project_ids: frozenset[int],
    config: StrictRuleConfig,
) -> ScopedSnapshot:
    needy_project_ids = [
        project_id
        for project_id, project_coverage in coverage.items()
        if project_coverage.total_gap > 0 and project_id not in blocked_project_ids
    ]
    donor_project_ids = [
        project_id
        for project_id, project in snapshot.projects.items()
        if project_id not in blocked_project_ids
        and project_id not in needy_project_ids
        and len(project.current_team_member_ids) > project.required_people_amount
    ]
    ordered_project_ids = sorted(
        needy_project_ids,
        key=lambda project_id: (-coverage[project_id].total_gap, project_id),
    ) + sorted(donor_project_ids)
    scoped_project_ids = tuple(ordered_project_ids[: config.max_projects_in_scope])
    scoped_project_id_set = set(scoped_project_ids)

    employees = [
        employee
        for employee in snapshot.employees.values()
        if employee.id not in blocked_employee_ids
        and (
            any(project_id in scoped_project_id_set for project_id in employee.current_project_ids)
            or (config.allow_unassigned_employees and not employee.current_project_ids)
        )
    ]
    employees = sorted(
        employees,
        key=lambda employee: (
            0 if not employee.current_project_ids else 1,
            employee.id,
        ),
    )[: config.max_employees_in_scope]

    target_project_ids = tuple(
        project_id for project_id in scoped_project_ids if project_id in needy_project_ids
    )

    return ScopedSnapshot(
        projects={project_id: snapshot.projects[project_id] for project_id in scoped_project_ids},
        employees={employee.id: employee for employee in employees},
        target_project_ids=target_project_ids,
        blocked_employee_ids=blocked_employee_ids,
        blocked_project_ids=blocked_project_ids,
        current_coverage={project_id: coverage[project_id] for project_id in scoped_project_ids},
    )


def _candidate_moves_for_target(
    scoped: ScopedSnapshot,
    target_project_id: int,
    snapshot: MatchingSnapshot,
    config: StrictRuleConfig,
) -> tuple[CandidateMove, ...]:
    target_project = scoped.projects[target_project_id]
    target_coverage = scoped.current_coverage[target_project_id]
    moves: list[CandidateMove] = []

    for employee in scoped.employees.values():
        if employee.id in target_project.current_team_member_ids:
            continue
        if employee.id in scoped.blocked_employee_ids:
            continue
        if _employee_target_fit(employee, target_project, target_coverage, config) <= 0:
            continue

        if not employee.current_project_ids and config.allow_unassigned_employees:
            moves.append(
                _make_move(
                    employee=employee,
                    target_project=target_project,
                    from_project_id=None,
                    action="assign",
                    impact="low",
                    target_coverage=target_coverage,
                )
            )

        if (
            employee.current_project_ids
            and config.allow_multi_project_assignment
            and len(employee.current_project_ids) < config.max_employee_project_count
        ):
            moves.append(
                _make_move(
                    employee=employee,
                    target_project=target_project,
                    from_project_id=None,
                    action="add_assignment",
                    impact="low",
                    target_coverage=target_coverage,
                )
            )

        for source_project_id in employee.current_project_ids:
            if source_project_id == target_project_id or source_project_id not in snapshot.projects:
                continue
            impact = _source_impact(
                employee_id=employee.id,
                source_project_id=source_project_id,
                snapshot=snapshot,
                config=config,
            )
            if impact == "high" and not config.allow_understaff_current_project:
                continue
            moves.append(
                _make_move(
                    employee=employee,
                    target_project=target_project,
                    from_project_id=source_project_id,
                    action="move",
                    impact=impact,
                    target_coverage=target_coverage,
                )
            )

    return tuple(
        sorted(
            _deduplicate_moves(moves),
            key=lambda move: (
                -_move_priority(move, snapshot, scoped.current_coverage[target_project_id]),
                len(snapshot.employees[move.employee_id].current_project_ids),
                move.employee_id,
                move.from_project_id or 0,
                move.action,
            ),
        )
    )


def _build_candidate_plan(
    *,
    target_project_id: int,
    moves: tuple[CandidateMove, ...],
    scoped: ScopedSnapshot,
    snapshot: MatchingSnapshot,
    config: StrictRuleConfig,
) -> CandidatePlan | None:
    if len({move.employee_id for move in moves}) != len(moves):
        return None
    if len(moves) > config.max_moves:
        return None

    assignments = _assignments(snapshot)
    for move in moves:
        if move.to_project_id in assignments and move.employee_id in assignments[move.to_project_id]:
            return None
        if move.action == "move" and move.from_project_id is not None:
            assignments.setdefault(move.from_project_id, set()).discard(move.employee_id)
        assignments.setdefault(move.to_project_id, set()).add(move.employee_id)

    affected_project_ids = {
        target_project_id,
        *(move.from_project_id for move in moves if move.from_project_id is not None),
    }
    coverage_after = {
        project_id: compute_project_coverage(snapshot, project_id, assignments)
        for project_id in affected_project_ids
        if project_id in snapshot.projects
    }

    before_target = scoped.current_coverage[target_project_id]
    after_target = coverage_after[target_project_id]
    gap_reduction = before_target.total_gap - after_target.total_gap
    if before_target.total_gap > 0:
        improvement_ratio = gap_reduction / before_target.total_gap
        if improvement_ratio < config.minimum_target_coverage_improvement:
            return None
    elif gap_reduction <= 0:
        return None

    for project_id in affected_project_ids:
        if project_id == target_project_id:
            continue
        after = coverage_after.get(project_id)
        if after is None:
            continue
        if (
            after.coverage_ratio < config.minimum_remaining_project_coverage
            and not config.allow_understaff_current_project
        ):
            return None

    strict_score = _score_candidate(
        moves=moves,
        before_target=before_target,
        after_target=after_target,
        coverage_after=coverage_after,
        snapshot=snapshot,
        config=config,
    )
    if strict_score <= 0:
        return None

    target_project = snapshot.projects[target_project_id]
    risks = _candidate_risks(moves, coverage_after, snapshot)
    move_names = ", ".join(str(move.employee_id) for move in moves)
    summary = (
        f"Move {move_names} toward {target_project.name} "
        f"to reduce headcount or skill gaps with strict score {strict_score:.2f}."
    )

    return CandidatePlan(
        candidate_plan_id="pending",
        strict_score=strict_score,
        summary=summary,
        moves=moves,
        risks=tuple(risks),
        hard_rule_summary={
            "valid": True,
            "target_project_id": target_project_id,
            "move_count": len(moves),
            "target_gap_before": before_target.total_gap,
            "target_gap_after": after_target.total_gap,
            "target_coverage_before": before_target.coverage_ratio,
            "target_coverage_after": after_target.coverage_ratio,
            "rules_checked": [
                "identity",
                "skill_contract",
                "headcount",
                "source_project_protection",
                "pending_requests",
                "reasonable_disruption",
            ],
        },
        project_coverage_after=coverage_after,
    )


def _detect_hiring_gaps(
    scoped: ScopedSnapshot,
    candidate_plans: tuple[CandidatePlan, ...],
    snapshot: MatchingSnapshot,
) -> list[HiringGap]:
    gaps: list[HiringGap] = []
    best_candidate_by_target: dict[int, CandidatePlan] = {}
    for candidate in candidate_plans:
        target_project_id = int(candidate.hard_rule_summary["target_project_id"])
        best_candidate_by_target.setdefault(target_project_id, candidate)

    for project_id in scoped.target_project_ids:
        candidate = best_candidate_by_target.get(project_id)
        coverage = (
            candidate.project_coverage_after[project_id]
            if candidate is not None and project_id in candidate.project_coverage_after
            else scoped.current_coverage[project_id]
        )
        if coverage.total_gap <= 0:
            continue

        project = snapshot.projects[project_id]
        required_skills = _hiring_required_skills(project, coverage)
        count = max(1, coverage.headcount_gap, _critical_skill_gap_count(coverage))
        gaps.append(
            HiringGap(
                project_id=project_id,
                candidate_plan_id=candidate.candidate_plan_id if candidate else None,
                role_title=_role_title(required_skills),
                count=count,
                required_skills=required_skills,
                reason=(
                    "No safe reassignment fully covers the remaining "
                    f"needs for {project.name}."
                ),
                urgency=_urgency(project, coverage),
            )
        )

    return gaps


def _normalize_skills(raw: dict) -> SkillMap:
    unknown = set(raw) - set(CANONICAL_SKILLS)
    if unknown:
        raise ValueError(f"Unknown skill keys: {', '.join(sorted(unknown))}")

    normalized = _empty_skills()
    for skill in CANONICAL_SKILLS:
        value = int(raw.get(skill, 0))
        if value < 0 or value > 3:
            raise ValueError(f"Skill level for {skill} must be between 0 and 3")
        normalized[skill] = value
    return normalized


def _empty_skills() -> SkillMap:
    return {skill: 0 for skill in CANONICAL_SKILLS}


def _assignments(snapshot: MatchingSnapshot) -> dict[int, set[int]]:
    return {
        project_id: set(project.current_team_member_ids)
        for project_id, project in snapshot.projects.items()
    }


def _blocked_ids(
    snapshot: MatchingSnapshot,
    config: StrictRuleConfig,
) -> tuple[frozenset[int], frozenset[int]]:
    if not config.exclude_pending_move_requests:
        return frozenset(), frozenset()

    open_requests = [
        request
        for request in snapshot.move_requests
        if request.status in OPEN_MOVE_REQUEST_STATUSES
    ]
    blocked_employee_ids = frozenset(request.employee_id for request in open_requests)
    blocked_project_ids = frozenset(
        project_id
        for request in open_requests
        for project_id in (request.from_project_id, request.to_project_id)
        if project_id is not None
    )
    return blocked_employee_ids, blocked_project_ids


def _employee_target_fit(
    employee: EmployeeSnapshot,
    project: ProjectSnapshot,
    target_coverage: ProjectCoverage,
    config: StrictRuleConfig,
) -> float:
    skill_help = sum(
        min(employee.skills[skill], project.required_skills[skill])
        for skill, gap in target_coverage.skill_gap.items()
        if gap > 0
    )
    headcount_help = 1.0 if target_coverage.headcount_gap > 0 else 0.0
    preference_help = 0.0
    if config.prefer_employee_preferences:
        preferences = {preference.lower() for preference in employee.preferences}
        if project.name.lower() in preferences:
            preference_help = 0.5
    return float(skill_help) + headcount_help + preference_help


def _has_donor_source(
    employee: EmployeeSnapshot,
    coverage: dict[int, ProjectCoverage],
) -> bool:
    return any(
        project_id in coverage
        and coverage[project_id].headcount_gap == 0
        and coverage[project_id].coverage_ratio >= 1
        for project_id in employee.current_project_ids
    )


def _source_impact(
    *,
    employee_id: int,
    source_project_id: int,
    snapshot: MatchingSnapshot,
    config: StrictRuleConfig,
) -> str:
    before = compute_project_coverage(snapshot, source_project_id)
    assignments = _assignments(snapshot)
    assignments.setdefault(source_project_id, set()).discard(employee_id)
    after = compute_project_coverage(snapshot, source_project_id, assignments)

    if after.coverage_ratio < config.minimum_remaining_project_coverage:
        return "high"
    if after.headcount_gap > before.headcount_gap:
        return "medium"
    if after.skill_gap_total > before.skill_gap_total:
        return "medium"
    return "low"


def _make_move(
    *,
    employee: EmployeeSnapshot,
    target_project: ProjectSnapshot,
    from_project_id: int | None,
    action: str,
    impact: str,
    target_coverage: ProjectCoverage,
) -> CandidateMove:
    covered_skills = [
        skill
        for skill, gap in target_coverage.skill_gap.items()
        if gap > 0 and employee.skills[skill] > 0
    ]
    if covered_skills:
        skill_text = ", ".join(covered_skills)
        reason = f"Employee covers target {skill_text} gaps."
    else:
        reason = "Employee helps close the target headcount gap."

    hard_rule_reasons = [
        "Employee and target project exist in the DB snapshot.",
        "Move improves or preserves target coverage.",
    ]
    if from_project_id is None:
        hard_rule_reasons.append("No source project loses current coverage.")
    else:
        hard_rule_reasons.append("Source project remains above strict minimums.")

    return CandidateMove(
        employee_id=employee.id,
        from_project_id=from_project_id,
        to_project_id=target_project.id,
        action=action,  # type: ignore[arg-type]
        suggested_role=employee.role,
        current_project_impact=impact,  # type: ignore[arg-type]
        hard_rule_reasons=tuple(hard_rule_reasons),
        reason=reason,
    )


def _move_priority(
    move: CandidateMove,
    snapshot: MatchingSnapshot,
    target_coverage: ProjectCoverage,
) -> float:
    employee = snapshot.employees[move.employee_id]
    project = snapshot.projects[move.to_project_id]
    skill_help = sum(
        min(employee.skills[skill], project.required_skills[skill])
        for skill, gap in target_coverage.skill_gap.items()
        if gap > 0
    )
    impact_penalty = {"low": 0.0, "medium": 0.4, "high": 1.0}[move.current_project_impact]
    return skill_help + (1.0 if target_coverage.headcount_gap > 0 else 0.0) - impact_penalty


def _score_candidate(
    *,
    moves: tuple[CandidateMove, ...],
    before_target: ProjectCoverage,
    after_target: ProjectCoverage,
    coverage_after: dict[int, ProjectCoverage],
    snapshot: MatchingSnapshot,
    config: StrictRuleConfig,
) -> float:
    skill_before = before_target.skill_gap_total
    skill_after = after_target.skill_gap_total
    skill_reduction = (
        (skill_before - skill_after) / skill_before if skill_before > 0 else 0.0
    )
    headcount_before = before_target.headcount_gap
    headcount_after = after_target.headcount_gap
    headcount_reduction = (
        (headcount_before - headcount_after) / headcount_before
        if headcount_before > 0
        else 0.0
    )
    source_coverages = [
        coverage
        for project_id, coverage in coverage_after.items()
        if project_id != before_target.project_id
    ]
    source_preservation = (
        sum(coverage.coverage_ratio for coverage in source_coverages)
        / len(source_coverages)
        if source_coverages
        else 1.0
    )
    if config.max_moves == 1:
        low_disruption = 1.0
    else:
        low_disruption = 1 - ((len(moves) - 1) / (config.max_moves - 1))
    preference_score = _candidate_preference_score(moves, snapshot, config)

    score = (
        0.35 * max(skill_reduction, 0)
        + 0.25 * max(headcount_reduction, 0)
        + 0.20 * source_preservation
        + 0.10 * low_disruption
        + 0.10 * preference_score
    )
    return round(min(score, 1.0), 4)


def _candidate_preference_score(
    moves: tuple[CandidateMove, ...],
    snapshot: MatchingSnapshot,
    config: StrictRuleConfig,
) -> float:
    if not config.prefer_employee_preferences or not moves:
        return 0.0
    matches = 0
    for move in moves:
        employee = snapshot.employees[move.employee_id]
        project_name = snapshot.projects[move.to_project_id].name.lower()
        preferences = {preference.lower() for preference in employee.preferences}
        if project_name in preferences:
            matches += 1
    return matches / len(moves)


def _candidate_risks(
    moves: tuple[CandidateMove, ...],
    coverage_after: dict[int, ProjectCoverage],
    snapshot: MatchingSnapshot,
) -> list[str]:
    risks: list[str] = []
    for move in moves:
        if move.from_project_id is None:
            continue
        source = snapshot.projects[move.from_project_id]
        coverage = coverage_after[move.from_project_id]
        if move.current_project_impact == "medium":
            risks.append(
                f"{source.name} loses useful coverage but remains within strict limits."
            )
        elif move.current_project_impact == "high":
            risks.append(f"{source.name} would need close follow-up after this move.")
        elif coverage.coverage_ratio < 1:
            risks.append(f"{source.name} remains partially covered after the move.")
    return risks


def _deduplicate_moves(moves: list[CandidateMove]) -> list[CandidateMove]:
    seen: set[tuple[int, int | None, int, str]] = set()
    deduped: list[CandidateMove] = []
    for move in moves:
        key = (move.employee_id, move.from_project_id, move.to_project_id, move.action)
        if key in seen:
            continue
        seen.add(key)
        deduped.append(move)
    return deduped


def _deduplicate_candidates(candidates: list[CandidatePlan]) -> list[CandidatePlan]:
    seen: set[tuple[tuple[int, int | None, int, str], ...]] = set()
    deduped: list[CandidatePlan] = []
    for candidate in candidates:
        key = tuple(
            sorted(
                (
                    move.employee_id,
                    move.from_project_id,
                    move.to_project_id,
                    move.action,
                )
                for move in candidate.moves
            )
        )
        if key in seen:
            continue
        seen.add(key)
        deduped.append(candidate)
    return deduped


def _candidate_sort_key(candidate: CandidatePlan) -> tuple:
    return (
        -candidate.strict_score,
        len(candidate.moves),
        tuple(move.employee_id for move in candidate.moves),
        tuple((move.from_project_id or 0, move.to_project_id) for move in candidate.moves),
    )


def _with_candidate_id(candidate: CandidatePlan, index: int) -> CandidatePlan:
    return CandidatePlan(
        candidate_plan_id=f"plan_{index:02d}",
        strict_score=candidate.strict_score,
        summary=candidate.summary,
        moves=candidate.moves,
        risks=candidate.risks,
        hard_rule_summary=candidate.hard_rule_summary,
        project_coverage_after=candidate.project_coverage_after,
    )


def _headcount_ratio(project: ProjectSnapshot, team_size: int) -> float:
    if project.required_people_amount <= 0:
        return 1.0
    return min(team_size / project.required_people_amount, 1.0)


def _skill_ratio(project: ProjectSnapshot, available_skills: SkillMap) -> float:
    required_skills = [
        skill for skill in CANONICAL_SKILLS if project.required_skills[skill] > 0
    ]
    if not required_skills:
        return 1.0
    ratios = [
        min(available_skills[skill] / project.required_skills[skill], 1.0)
        for skill in required_skills
    ]
    return sum(ratios) / len(ratios)


def _hiring_required_skills(
    project: ProjectSnapshot,
    coverage: ProjectCoverage,
) -> SkillMap:
    required = _empty_skills()
    for skill, gap in coverage.skill_gap.items():
        if gap > 0:
            required[skill] = project.required_skills[skill]

    if any(required.values()):
        return required

    strongest_skills = sorted(
        CANONICAL_SKILLS,
        key=lambda skill: (-project.required_skills[skill], skill),
    )
    for skill in strongest_skills[:2]:
        required[skill] = project.required_skills[skill]
    return required


def _critical_skill_gap_count(coverage: ProjectCoverage) -> int:
    return 1 if any(level > 0 for level in coverage.skill_gap.values()) else 0


def _role_title(required_skills: SkillMap) -> str:
    backend = required_skills["backend"]
    infrastructure = required_skills["infrastructure"]
    android = required_skills["android"]
    ios = required_skills["ios"]
    web = required_skills["web"]
    ai = required_skills["ai"]

    if backend >= 2 and infrastructure >= 1:
        return "Senior backend/platform engineer"
    if web >= 2:
        return "Senior web engineer"
    if android > 0 or ios > 0:
        return "Mobile engineer"
    if ai > 0:
        return "AI/ML engineer"
    if infrastructure > 0:
        return "Infrastructure engineer"
    return "Software engineer"


def _urgency(project: ProjectSnapshot, coverage: ProjectCoverage) -> str:
    phase = project.project_phase.lower()
    if coverage.headcount_gap >= 2 or coverage.skill_gap_total >= 3 or phase in {
        "new",
        "growth",
    }:
        return "high"
    if coverage.headcount_gap == 1 or coverage.skill_gap_total > 0:
        return "medium"
    return "low"
