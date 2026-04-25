from pydantic import ValidationError

from clients import get_openai_client, get_openai_model
from schemas import MatchingLlmRequest, MatchingLlmResponse
from schemas.matching import AlternativePlan, BestPlan, CandidatePlan, HiringRecommendation


SYSTEM_PROMPT = """You are a staffing product manager assistant.

You receive candidate assignment plans that are ALREADY algorithmically valid:
every employee, project, and move comes from a deterministic step. You only
refine and explain.

PICK ONE BEST plan. Optionally include up to 2 ALTERNATIVES, but only if they
represent a meaningfully different tradeoff (e.g. lower disruption at the cost
of slower ramp-up). Otherwise return an empty alternatives list.

Evaluation priorities, highest first:
- Target project skill and headcount coverage.
- Low disruption to source projects.
- Employee preference and interest alignment.
- Short ramp-up.
- Learning value of bench placements.

You may produce hiring_recommendations when internal reassignment cannot
maintain coverage. Use the hiring_gap_hints as a starting point. Each hiring
recommendation must reference a project_id present in the input and use only
the canonical six skill keys (android, ios, web, backend, infrastructure, ai).

Hard rules:
- Never invent employees, projects, skills, or plan IDs.
- Every candidate_plan_id you reference must come from the input.
- Every move (gap-closing or bench) you reference must already be present in
  that candidate plan. Preserve its action value exactly (`assign`, `move`, or
  `add_assignment`) and use null for from_project_id when the input move has no
  source project.
- fit_score is a float in [0.0, 1.0].

Tone: explain project tradeoffs, not employee performance. Use language like
"strong skill fit", "low source-project disruption", "short ramp-up",
"preference alignment", "coverage risk", "hiring needed to maintain coverage".
"""


class MatchingLlmError(RuntimeError):
    """Raised when the LLM response cannot be used."""


async def evaluate_matching(payload: MatchingLlmRequest) -> MatchingLlmResponse:
    """Run step 2 (LLM refinement) over algorithm-produced candidate plans."""

    client = get_openai_client()
    try:
        response = client.responses.parse(
            model=get_openai_model(),
            temperature=0.2,
            instructions=SYSTEM_PROMPT,
            input=payload.model_dump_json(indent=2),
            text_format=MatchingLlmResponse,
        )
    except ValidationError as exc:
        raise MatchingLlmError(f"LLM returned invalid response: {exc}") from exc

    parsed = response.output_parsed
    if parsed is None:
        refusal = getattr(response, "output_text", "") or "model refused or returned empty output"
        raise MatchingLlmError(f"LLM produced no parsed output: {refusal}")

    return _validate_against_input(parsed, payload)


def _validate_against_input(
    parsed: MatchingLlmResponse,
    payload: MatchingLlmRequest,
) -> MatchingLlmResponse:
    plans_by_id = {plan.candidate_plan_id: plan for plan in payload.candidate_plans}
    known_project_ids = {payload.target_project.id}
    for plan in payload.candidate_plans:
        for move in plan.gap_closing_moves:
            known_project_ids.add(move.from_project_id)
            known_project_ids.add(move.to_project_id)
        for bench in plan.bench_moves:
            known_project_ids.add(bench.to_project_id)

    if not _is_plan_consistent(parsed.best, plans_by_id):
        raise MatchingLlmError("LLM 'best' plan does not match any input candidate plan.")

    surviving_alternatives: list[AlternativePlan] = [
        alt for alt in parsed.alternatives if _is_plan_consistent(alt, plans_by_id)
    ]

    surviving_hiring: list[HiringRecommendation] = [
        rec for rec in parsed.hiring_recommendations if rec.project_id in known_project_ids
    ]

    return MatchingLlmResponse(
        best=parsed.best,
        alternatives=surviving_alternatives,
        hiring_recommendations=surviving_hiring,
    )


def _is_plan_consistent(
    plan: BestPlan | AlternativePlan,
    plans_by_id: dict[str, CandidatePlan],
) -> bool:
    source = plans_by_id.get(plan.candidate_plan_id)
    if source is None:
        return False

    valid_moves = {
        (m.employee_id, m.from_project_id, m.to_project_id, m.action)
        for m in source.gap_closing_moves
    }
    for move in plan.moves:
        key = (move.employee_id, move.from_project_id, move.to_project_id, move.action)
        if key not in valid_moves:
            return False

    valid_bench = {(b.employee_id, b.to_project_id) for b in source.bench_moves}
    for bench in plan.bench_moves:
        if (bench.employee_id, bench.to_project_id) not in valid_bench:
            return False

    return True
