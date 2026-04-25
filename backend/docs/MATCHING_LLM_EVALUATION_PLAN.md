# Matching Pipeline Step 2: LLM Evaluation

## Purpose

Step 2 always runs after step 1. It refines the algorithm-produced candidate
plans from a staffing product manager perspective, choosing the best plan and
optionally up to two alternatives when they represent a meaningfully different
tradeoff.

The LLM is responsible for soft assessment that the deterministic step cannot
make well: preference fit, learning value of bench placements, source-project
disruption, ramp-up effort, and PM-style framing of hiring needs.

The LLM may:

- Rank the candidate plans produced by step 1.
- Pick the best plan and optionally 0–2 alternatives.
- Write short reasons, risks, and suggested role labels.
- Produce hiring needs framed in PM language. Step 1 hiring gaps are passed in
  as hints, not as a closed set.

The LLM must not:

- Invent employees, projects, skills, or assignments.
- Return a plan ID that step 1 did not produce.
- Add a move that is not in the chosen candidate plan.
- Reference an unknown project ID or non-canonical skill key in a hiring need.

## Always-On Two-Step

Step 2 is not optional and there is no deterministic fallback path. If the
OpenAI call fails or returns invalid JSON, the matching run fails and the API
returns an error. Keeping a single code path avoids duplicating ranking logic.

## Inputs From Step 1

Step 2 receives a compact, snapshot-derived payload. Step 1 owns the data; this
section describes only what gets forwarded to the LLM.

```json
{
  "use_case": "project_rebalance",
  "target_project": {
    "id": 7,
    "name": "Eventbrite",
    "phase": "growth",
    "required_people_amount": 3,
    "required_skills": {
      "android": 0, "ios": 0, "web": 2,
      "backend": 3, "infrastructure": 2, "ai": 1
    }
  },
  "candidate_plans": [
    {
      "candidate_plan_id": "plan_01",
      "gap_closing_moves": [
        {
          "employee_id": 3,
          "name": "Sofia Romano",
          "role": "Backend Engineer",
          "from_project_id": 2,
          "from_project_name": "WeTransfer",
          "to_project_id": 7,
          "to_project_name": "Eventbrite",
          "skills": { "backend": 3, "infrastructure": 2, "web": 1 },
          "preferences": ["Eventbrite"],
          "interests": ["platform"]
        }
      ],
      "bench_moves": [
        {
          "employee_id": 9,
          "name": "Marco Bianchi",
          "role": "iOS Engineer",
          "to_project_id": 4,
          "to_project_name": "WeTransfer",
          "skills": { "ios": 3, "backend": 1 },
          "interests": ["mobile platforms"]
        }
      ],
      "coverage_after": {
        "headcount_gap": 0,
        "skill_gap": { "backend": 0, "infrastructure": 0, "ai": 0 }
      },
      "source_project_impacts": [
        { "project_id": 2, "project_name": "WeTransfer", "impact": "low" }
      ]
    }
  ],
  "hiring_gap_hints": [
    {
      "project_id": 7,
      "role_title": "Senior backend/platform engineer",
      "count": 1,
      "required_skills": {
        "android": 0, "ios": 0, "web": 1,
        "backend": 3, "infrastructure": 2, "ai": 0
      }
    }
  ]
}
```

Notes on input shape:

- `gap_closing_moves` are step 1's required-coverage moves.
- `bench_moves` are deterministic placements for otherwise-unassigned employees,
  picked by step 1 for support/learning. The LLM does not relocate them; it
  only writes reasons.
- `hiring_gap_hints` come from step 1 coverage analysis. The LLM may use,
  expand, or ignore them.
- Step 1 internal scores are intentionally not forwarded so the LLM ranks on
  the soft signals alone.
- Free-text employee or project context (profile summary, repo summary) is not
  included in v1. The schema can accept extra string fields per employee or
  project later without changing the response contract.

## Prompt Strategy

Use the same JSON-only pattern as `services/skill_profile_service.py`.

System prompt responsibilities:

- Define the staffing product manager role.
- State that all candidate plans are already algorithmically valid.
- Forbid unknown employee IDs, project IDs, plan IDs, and skill keys.
- Forbid adding moves that are not in the chosen candidate plan.
- Encode evaluation priorities: target coverage, low source-project disruption,
  preference and interest alignment, short ramp-up, learning value of bench
  placements.
- Encode tone: explain project tradeoffs, do not judge people.
- Require strict JSON.
- Define when alternatives are appropriate: include up to two only when they
  represent a meaningfully different tradeoff, otherwise return `best` only.

User message: the JSON payload above.

## Model Configuration

```json
{
  "model": "gpt-4o",
  "temperature": 0.2,
  "response_format": "json_object"
}
```

## Required Model Output

```json
{
  "best": {
    "candidate_plan_id": "plan_01",
    "fit_score": 0.91,
    "reason": "Closes the backend and infrastructure gaps with low impact on WeTransfer.",
    "moves": [
      {
        "employee_id": 3,
        "from_project_id": 2,
        "to_project_id": 7,
        "suggested_role": "Backend/platform engineer",
        "current_project_impact": "low"
      }
    ],
    "bench_moves": [
      {
        "employee_id": 9,
        "to_project_id": 4,
        "suggested_role": "iOS support / backend ramp-up",
        "reason": "Mobile background plus interest in platforms; useful contributor on WeTransfer."
      }
    ],
    "risks": [
      "WeTransfer loses one infrastructure-capable engineer."
    ]
  },
  "alternatives": [
    {
      "candidate_plan_id": "plan_03",
      "fit_score": 0.78,
      "reason": "Lower disruption to WeTransfer at the cost of slower ramp-up.",
      "tradeoff": "Better source-project preservation, weaker target skill match.",
      "moves": [ /* same shape as best.moves */ ],
      "bench_moves": [ /* same shape as best.bench_moves */ ],
      "risks": [ "Eventbrite reaches infrastructure 2 only after onboarding." ]
    }
  ],
  "hiring_recommendations": [
    {
      "project_id": 7,
      "role_title": "Senior backend/platform engineer",
      "count": 1,
      "required_skills": {
        "android": 0, "ios": 0, "web": 1,
        "backend": 3, "infrastructure": 2, "ai": 0
      },
      "urgency": "high",
      "reason": "No safe internal reassignment fully closes Eventbrite's backend and infrastructure needs."
    }
  ]
}
```

Field rules:

- `fit_score` is a float in `[0.0, 1.0]`.
- `alternatives` may be an empty list. Maximum two entries.
- `tradeoff` is required on alternatives, forcing justification.
- `current_project_impact` is one of `low`, `medium`, `high`.
- `suggested_role` is a short title.
- `risks` is a list of short strings.
- `hiring_recommendations` may be empty.

## Backend Validation

Validation is structural and ID-based only.

- Response must parse as JSON and match the schema above.
- `best.candidate_plan_id` and every `alternatives[].candidate_plan_id` must
  exist in step 1 output.
- Every move under `best` and `alternatives` must already be present in that
  candidate plan (employee_id, from_project_id, to_project_id all match).
- Every `bench_moves` entry must already be present in that candidate plan.
- `fit_score` must be in `[0.0, 1.0]`.
- `current_project_impact` must be `low`, `medium`, or `high`.
- For `hiring_recommendations`: `project_id` must exist in the snapshot,
  `required_skills` keys must be the canonical six, and `count` must be a
  positive integer.
- Drop a single malformed entry; do not attempt partial-merge logic.
- If `best` is missing or invalid, the run fails.

## Endpoints

The matching surface stays flat and consistent with the rest of the backend
(`backend/main.py`):

```http
POST /projects/{project_id}/matching:run
GET  /projects/{project_id}/matching/latest
```

`POST` runs the full pipeline (step 1 + step 2) and returns the validated
result. `GET` returns the most recent stored run for the project. There are no
per-recommendation action routes; move requests are created through the
existing DB API `POST /move-requests` endpoint when the user accepts a plan.

## Persistence

Persist the validated result via the DB API. For v1, store:

- The matching run (target project, status, created_at).
- The final response JSON (`best`, `alternatives`, `hiring_recommendations`).

No per-candidate table, no event timeline, no model metadata, no prompt
storage.

## Module Responsibilities

`backend/services/matching_service.py`:

- Orchestrates step 1 (algorithm) and step 2 (LLM).
- Calls `clients/llm_client.py` for the OpenAI call.
- Validates the response and persists the run via `clients/db_client.py`.
- Mirrors the structure of `services/skill_profile_service.py`.

If the file grows large enough to hurt readability, split step 1 and step 2
into a `services/matching/` package later. Do not pre-split.

## Tone

Use staffing PM language: "strong skill fit", "low source-project disruption",
"short ramp-up", "preference alignment", "coverage risk", "hiring needed to
maintain coverage". Avoid performance language ("weak", "poor performer",
"replaceable").

## Tests

- Prompt builder includes only candidate plans from step 1.
- Response with unknown `candidate_plan_id` is rejected.
- Response with a move not in the chosen plan is rejected.
- Response with unknown project ID in a hiring recommendation is rejected.
- `fit_score` outside `[0, 1]` is rejected.
- More than two alternatives is rejected.
- Alternative without `tradeoff` is rejected.
- Empty `alternatives` and empty `hiring_recommendations` are accepted.
- Invalid JSON from the model surfaces a run failure.

## Future Extensions (Deliberately Deferred)

When richer inputs become available, slot them into the existing payload
without breaking the response contract:

- Free-text `profile_summary` per employee.
- Free-text `repo_summary` or `domain_notes` per project.
- Free-text `recent_activity` or `team_dynamics` notes.

The LLM is the only step that can use these meaningfully, which is why the
two-step shape is set up to absorb them later.
