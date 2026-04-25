# Matching Frontend Documentation

This document is the frontend-facing contract for implementing matching UI and
agent workflows. It summarizes the current backend behavior from
`backend/docs/MATCHING_PLAN.md` and the database contract from
`docs/DB_API_DOCUMENTATION.md`.

## Current Product Contract

Matching runs as a synchronous two-step pipeline:

1. The frontend triggers a matching run through the backend API.
2. The backend loads projects, employees, move requests, and the selected policy
   from the DB API. When the request does not select a policy, it uses
   `Balanced strict matching`.
3. The backend generates deterministic candidate plans, hiring gaps, and
   frontend-visible run events.
4. When at least one strict-rule candidate exists, OpenAI evaluates only those
   candidates, picks the best plan, and optionally returns up to two alternatives.
5. The backend persists the run, candidates, LLM-ranked recommendations, hiring
   recommendations, and events through the DB API.
6. The response returns the same run result synchronously.

For normal runs with candidates, render `suggestions` as the selectable staffing
plans. `summary.selected_candidate_plan_id` identifies the LLM-selected best
plan. The backend response is intentionally compact; use the DB API child
endpoints only when an audit/debug screen needs raw strict-rule candidates,
events, or persisted recommendation rows. If strict rules produce no candidates,
`summary.suggestion_count` is `0` and the main outcome may be hiring
suggestions. The LLM picks from the top 8 strict-rule candidates.

Matching never mutates `project_assignments` by itself. A candidate plan is a
recommendation only.

## Base URLs

Use same-origin paths in deployed environments:

- Backend orchestration API: `/api`
- DB REST API: `/db-api`

Public deployed bases:

- Production backend: `https://doubleu.team/api`
- Production DB API: `https://doubleu.team/db-api`
- Development backend: `https://dev.doubleu.team/api`
- Development DB API: `https://dev.doubleu.team/db-api`

Local frontend already rewrites `/db-api/*` via `frontend/next.config.ts`.
When adding frontend calls to backend matching endpoints, either call the
deployed `/api` path or add the equivalent local proxy/configuration for the
backend API.

## Run Matching

### Project Rebalance

Use this when the user is looking at one project, after a project is created, or
after its staffing requirements change.

```http
POST /api/projects/{project_id}/matching:run
```

Example request:

```json
{
  "requested_by": "cto@example.com",
  "policy_name": "balanced"
}
```

The request body is optional. Send `{}` or omit the body when no audit requester
is available; the backend will use the balanced policy by default.

### Portfolio Rebalance

Use this from a portfolio staffing dashboard when no single project triggered
the run.

```http
POST /api/matching/portfolio:rebalance
```

The request body is the same as project rebalance. `target_project_id` will be
`null` in the response.

### Request Fields

- `requested_by`: Optional display/audit string.
- `policy_id`: Optional stored policy id from `/db-api/policies`.
- `policy_name`: Optional stored policy name. The backend also accepts the
  aliases `conservative`, `balanced`, and `aggressive`.

Do not send `rule_config`, `max_candidate_plans`, `max_recommendations`, or
`dry_run`. Matching configuration is loaded from stored database policies. Use
`policy_id` or `policy_name` for per-run policy selection, and change
`/db-api/policies` when the organization wants different durable policy values.

## Run Response

The backend returns a completed result synchronously today:

```ts
type MatchingRunResponse = {
  run_id: number
  use_case: "portfolio_rebalance" | "project_rebalance" | "project_staffing"
  status: "pending" | "running" | "completed" | "failed"
  target_project_id: number | null
  summary: {
    headline: string
    selected_candidate_plan_id: string | null
    generated_candidate_count: number
    evaluated_candidate_count: number
    suggestion_count: number
    hiring_suggestion_count: number
  }
  suggestions: MatchingSuggestion[]
  hiring_suggestions: MatchingHiringSuggestion[]
  diagnostics: {
    policy_id: number
    policy_name: string
    event_count: number
    warnings: string[]
  }
}
```

Render `summary.headline` near the top of the result. Use the summary counts for
badges and empty states. Show `diagnostics.warnings` in a compact alert or
details panel.

### Suggestions

```ts
type MatchingSuggestion = {
  suggestion_id: string
  candidate_plan_id: string
  rank: number
  score: number | null
  title: string
  rationale: string
  tradeoffs: string[]
  risks: string[]
  moves: MatchingSuggestionMove[]
  impact: {
    target_project_id: number
    target_headcount_gap: number
    target_skill_gap: Skills
    source_project_impacts: Array<{
      project_id: number
      impact: "low" | "medium" | "high"
    }>
  }
}

type MatchingSuggestionMove = {
  employee_id: number
  from_project_id: number | null
  to_project_id: number
  action: "assign" | "move" | "add_assignment"
  suggested_role: string
  current_project_impact: "low" | "medium" | "high"
  reason: string
  move_request_reason: string
}
```

Display suggestions ordered by `rank`. The first item is the LLM-picked best
plan. Resolve employee and project names client-side from cached
`/db-api/employees` and `/db-api/projects` data; IDs remain canonical.

Move action semantics:

- `assign`: employee has no current source project; `from_project_id` is `null`.
- `add_assignment`: employee keeps existing projects and is also added to the
  target; `from_project_id` is `null`.
- `move`: employee is recommended to leave `from_project_id` for `to_project_id`.

### Hiring Suggestions

```ts
type MatchingHiringSuggestion = {
  candidate_plan_id: string | null
  project_id: number
  role_title: string
  count: number
  required_skills: Skills
  rationale: string
  urgency: "low" | "medium" | "high"
  suggested_assignment: string | null
}
```

Render hiring suggestions as first-class outcomes, not as errors. They mean
the strict rules could not safely solve every gap with internal reassignment.

### Audit Data

The backend run response no longer embeds strict-rule candidates, persisted
recommendation rows, or full event logs. Use the DB API endpoints below for
debug/audit views. Common current event types include:

- `strict_rules.started`
- `strict_rules.scope_selected`
- `strict_rules.coverage_computed`
- `strict_rules.candidates_generated`
- `strict_rules.candidates_pruned`
- `strict_rules.hiring_gaps_detected`
- `strict_rules.completed`
- `strict_rules.no_candidates`
- `strict_rules.failed`
- `llm_evaluation.started`
- `llm_evaluation.completed`
- `llm_evaluation.failed`

## Read Persisted Results

Use the DB API for persisted matching records.

```http
GET /db-api/projects/{project_id}/matching/latest
GET /db-api/matching-runs/latest?use_case=project_rebalance&target_project_id=7
GET /db-api/matching-runs/{run_id}
GET /db-api/matching-runs/{run_id}/candidates
GET /db-api/matching-runs/{run_id}/recommendations
GET /db-api/matching-runs/{run_id}/hiring-recommendations
GET /db-api/matching-runs/{run_id}/events
```

`GET /db-api/projects/{project_id}/matching/latest` returns only the run record,
not child candidates/events. Fetch children with the run ID.

The DB API also exposes `POST
/db-api/matching-runs/{run_id}/recommendations/{candidate_plan_id}/move-requests`
to create move requests from the selected LLM recommendation.

## Accepting A Recommendation

Current matching runs are advisory. Do not update project assignments directly
from the matching response.

Recommended current UI behavior:

1. Let the CTO review an LLM-ranked recommendation.
2. If the product flow supports acceptance, call `POST
   /db-api/matching-runs/{run_id}/recommendations/{candidate_plan_id}/move-requests`
   to create one move request per suggested move.
3. Keep assignment changes separate from move-request creation. Updating a move
   request to `accepted` does not automatically update `project_assignments`.

The action endpoint builds move requests from the persisted recommendation's
`suggested_moves`. Backend run responses expose the same actionable data as
`suggestions[].moves`.
For reference, each created move request has this shape:

```json
{
  "employee_id": 3,
  "from_project_id": 2,
  "to_project_id": 7,
  "reason": "Employee covers target backend gaps.",
  "expected_role": "Backend/platform engineer",
  "current_project_impact": "low",
  "status": "pending"
}
```

For `assign` and `add_assignment`, send `"from_project_id": null`.

## Empty And Error States

- `status: "failed"`: show `summary.headline` or an error state and offer retry.
- `summary.suggestion_count: 0` with hiring suggestions: show hiring gap cards as
  the main result.
- `summary.generated_candidate_count > 0` and `summary.suggestion_count: 0`:
  treat the run as failed or incomplete unless the status is still `running`.
- No suggestions and no hiring suggestions: show "No matching action found for
  the current snapshot."
- HTTP `400`: request/config problem or unknown target project.
- HTTP `404` from latest-run reads: no run exists yet; show an initial empty
  state.
- HTTP `500`/`503`: backend or DB API unavailable; show retry.

## Implementation Checklist

- Add frontend types for matching responses in `frontend/src/lib/db-api.ts` or a
  dedicated matching API module.
- Add a backend API base helper for `/api` calls if using local Next.js rewrites.
- Trigger project matching from project detail/create/update flows.
- Trigger portfolio matching from a CTO staffing dashboard.
- Resolve employee/project names client-side from canonical IDs.
- Render `suggestions` as approval cards and `hiring_suggestions` as gap cards.
- Use DB API child endpoints only for audit/debug views.
- Treat `suggestions[0]` as the LLM-picked best plan when present.
- Never assume accepted move requests automatically mutate assignments.
