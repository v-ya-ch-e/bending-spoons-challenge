# Matching Pipeline Step 2: OpenAI Evaluation

## Purpose

Step 2 evaluates the deterministic candidate plans from step 1 and chooses the
best soft configuration for the current use case.

The model should help with:

- Ranking valid candidate plans.
- Producing CTO-friendly explanations.
- Describing project risk and ramp-up effort.
- Choosing suggested roles for move requests.
- Summarizing why a recommendation is better than alternatives.

The model must not:

- Invent employees, projects, skills, assignments, or IDs.
- Override hard-rule validation.
- Return candidates that were not produced by step 1.
- Make final assignment changes.

## Inputs

The evaluator receives:

- Matching use case.
- Target project or target employee.
- A compact data snapshot.
- Candidate plans from step 1.
- Rule configuration and strict scores.
- Open move request context.

Only send candidate plans that passed step 1 validation. Cap the number of
plans sent to the model with config, for example `max_llm_candidate_plans: 10`.

## Prompt Strategy

Use a strict system prompt with a JSON-only response contract, similar to the
existing skill-profile service pattern.

System prompt responsibilities:

- Define the CTO staffing assistant role.
- Explain that all candidate plans are already hard-rule valid.
- Instruct the model to rank only provided candidate IDs.
- Forbid unknown employee IDs, project IDs, and skill keys.
- Require concise explanations grounded in the provided candidate data.
- Require JSON output with no markdown.

User message content:

- Use case and objective.
- Target project or employee summary.
- Relevant project coverage gaps.
- Candidate plans and strict scores.
- Employee preference/interests summary.
- Source project impact summaries.

Do not include secrets, raw credentials, hidden environment values, or unrelated
employee data.

## Prompt Versioning

Every production prompt should have a version string:

```text
matching_llm_evaluator_v1
```

Persist the prompt version with the matching run or recommendation metadata.
This makes old recommendations debuggable after prompt changes.

## Model Configuration

Recommended defaults:

```json
{
  "model": "gpt-4o",
  "temperature": 0.2,
  "response_format": "json_object",
  "max_llm_candidate_plans": 10,
  "prompt_version": "matching_llm_evaluator_v1"
}
```

The low temperature keeps rankings stable while allowing better natural-language
explanations than a purely deterministic prompt.

## Request Shape Sent To The Model

Keep input compact and explicit.

```json
{
  "use_case": "project_rebalance",
  "target": {
    "project_id": 7,
    "project_name": "Eventbrite",
    "project_phase": "growth",
    "required_people_amount": 3,
    "required_skills": {
      "android": 0,
      "ios": 0,
      "web": 2,
      "backend": 3,
      "infrastructure": 2,
      "ai": 1
    }
  },
  "evaluation_policy": {
    "prioritize": [
      "target skill coverage",
      "low disruption to source projects",
      "employee preferences",
      "short ramp-up"
    ],
    "forbidden": [
      "unknown candidate_plan_id",
      "unknown employee_id",
      "unknown project_id",
      "new move not present in candidate plan"
    ]
  },
  "candidate_plans": [
    {
      "candidate_plan_id": "plan_01",
      "strict_score": 0.82,
      "moves": [
        {
          "employee_id": 3,
          "employee_name": "Sofia Romano",
          "employee_role": "Backend Engineer",
          "from_project_id": 2,
          "from_project_name": "WeTransfer",
          "to_project_id": 7,
          "to_project_name": "Eventbrite",
          "current_project_impact": "low",
          "skill_match_summary": "backend 3, infrastructure 2, web 1"
        }
      ],
      "coverage_summary": "Target backend and infrastructure gaps close.",
      "strict_risks": [
        "Source project loses one infrastructure-capable engineer."
      ]
    }
  ]
}
```

## Required Model Output

The model must return strict JSON.

```json
{
  "ranked_recommendations": [
    {
      "candidate_plan_id": "plan_01",
      "rank": 1,
      "fit_score": 0.91,
      "summary": "Best balance of target coverage and low source disruption.",
      "explanation": "Sofia covers the backend and infrastructure gaps with low impact on WeTransfer.",
      "risks": [
        "WeTransfer loses one infrastructure-capable engineer."
      ],
      "ramp_up_estimate": "3-5 days",
      "suggested_moves": [
        {
          "employee_id": 3,
          "from_project_id": 2,
          "to_project_id": 7,
          "suggested_role": "Backend/platform engineer",
          "current_project_impact": "low",
          "move_request_reason": "Backend 3 and infrastructure 2 match Eventbrite's target gaps."
        }
      ]
    }
  ],
  "overall_summary": "Plan 01 is the best low-disruption staffing option for Eventbrite."
}
```

`fit_score` should be a normalized score from 0 to 1. It is model-assisted, not
a mathematical guarantee.

## Backend Validation

The backend must validate model output before persisting or returning it.

Validation rules:

- Response must parse as JSON.
- `ranked_recommendations` must be a list.
- Every `candidate_plan_id` must exist in step 1 output.
- Every suggested move must match a move already present in that candidate.
- Employee IDs and project IDs must match the candidate plan.
- `fit_score` must be between 0 and 1.
- `current_project_impact` must be one of `low`, `medium`, or `high`.
- Risks must be short strings.
- Unknown fields can be ignored, but unknown IDs must reject that
  recommendation.

If a recommendation references unknown or mismatched data, drop that
recommendation and store a warning event. If no model recommendation survives,
fall back to deterministic strict-score ordering.

## Fallback Behavior

OpenAI should improve the recommendation, not become a hard dependency for every
run.

Use deterministic fallback when:

- OpenAI API call fails.
- OpenAI returns invalid JSON.
- The response is valid JSON but all recommendations fail validation.
- The request exceeds configured token or candidate limits.

Fallback response:

- Rank candidates by strict score.
- Use step 1 summaries and risks.
- Set `model_metadata.status` to `failed` or `skipped`.
- Add a frontend-visible warning event.

Example event:

```json
{
  "level": "warning",
  "stage": "llm_evaluation",
  "event_type": "llm_evaluation.fallback_used",
  "message": "OpenAI evaluation failed; returned deterministic ranking.",
  "metadata": {
    "fallback_reason": "invalid_json",
    "candidate_count": 10
  }
}
```

## Persistence

Persist the final validated recommendations in `matching_recommendations`.

Suggested metadata:

```json
{
  "model": "gpt-4o",
  "prompt_version": "matching_llm_evaluator_v1",
  "temperature": 0.2,
  "status": "completed",
  "input_candidate_count": 10,
  "validated_recommendation_count": 5
}
```

If token usage is available from the API response, store aggregate counts in
metadata. Do not store API keys or raw authorization data.

Prompt and response storage should be decided deliberately:

- For MVP, store only model metadata, final validated recommendation JSON, and
  safe run events.
- For debugging, optionally store redacted prompt/response payloads in a
  restricted column or separate internal-only table.
- Do not display raw prompts on the frontend by default.

## Logs Emitted By Step 2

Frontend-visible events:

- `llm_evaluation.started`
- `llm_evaluation.prompt_prepared`
- `llm_evaluation.completed`
- `llm_evaluation.validation_failed`
- `llm_evaluation.fallback_used`
- `llm_evaluation.skipped`

Example success event:

```json
{
  "level": "info",
  "stage": "llm_evaluation",
  "event_type": "llm_evaluation.completed",
  "message": "Evaluated 10 candidate plans and validated 5 recommendations.",
  "metadata": {
    "model": "gpt-4o",
    "prompt_version": "matching_llm_evaluator_v1",
    "input_candidate_count": 10,
    "validated_recommendation_count": 5
  }
}
```

## Module Responsibilities

`backend/services/matching/llm_evaluator.py`:

- Select top candidates to send to OpenAI.
- Build prompt messages.
- Call `get_openai_client()`.
- Parse JSON response.
- Validate response against candidate plans.
- Produce deterministic fallback recommendations.

`backend/services/matching/models.py`:

- Internal DTOs for LLM input, raw model output, validated recommendations, and
  model metadata.

`backend/services/matching/logging.py`:

- Persist step 2 run events through the DB API.

## Frontend Display Contract

The frontend should display validated recommendations only. It should not need
to know whether a recommendation came from OpenAI or fallback ranking, except
for an optional status badge or run event timeline.

Recommended fields for the UI:

- Rank.
- Fit score.
- Recommended squad or moves.
- Explanation.
- Risks and tradeoffs.
- Ramp-up estimate.
- Suggested role.
- Source project impact.
- Event timeline.

The UI should show 3 to 5 strong recommendations and optionally a small
alternatives section.

## Security And Tone

The model should avoid employee performance judgments. Use language like:

- "strong skill fit"
- "low source-project disruption"
- "short ramp-up estimate"
- "preference alignment"
- "coverage risk"

Avoid language like:

- "weak employee"
- "poor performer"
- "replaceable"
- "low value"

The recommendation should explain project tradeoffs, not judge people.

## Tests

Unit tests should cover:

- Prompt builder includes only allowed candidate IDs.
- Model response with unknown candidate ID is rejected.
- Model response with unknown employee ID is rejected.
- Model response with new invented move is rejected.
- Invalid JSON falls back to deterministic ranking.
- Partial valid response keeps valid recommendations and logs warnings.
- `fit_score` is clamped or rejected according to schema rules.
- Fallback output is stable for a fixed strict-score input.

Service tests should cover:

- A full run persists LLM metadata.
- A failed LLM call still completes the matching run with fallback output.
- Warning events are visible in run events.

## Future Extensions

- Use OpenAI structured outputs with a JSON schema when the installed SDK and
  model support it.
- Add a second lightweight critique pass for high-impact recommendations.
- Add localized explanations for employee-facing move requests.
- Add offline evaluation datasets to compare prompt versions.
- Add model-cost budget controls per run.
