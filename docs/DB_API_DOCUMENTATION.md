# DB API Documentation

This is the canonical agent-facing reference for the `db-rest-api` service. Use it before changing frontend calls, backend integrations, seed data, or database-backed API behavior.

Source files:

- API implementation: [`../db-rest-api/main.py`](../db-rest-api/main.py)
- SQL schema: [`../db-rest-api/db/schema.sql`](../db-rest-api/db/schema.sql)
- Service setup: [`../db-rest-api/README.md`](../db-rest-api/README.md)
- Service conventions: [`../db-rest-api/CLAUDE.md`](../db-rest-api/CLAUDE.md)

Public environments:

- Production base URL: `https://doubleu.team/db-api`
- Development base URL: `https://dev.doubleu.team/db-api`
- Local app root path defaults to `/db-api`, but local direct `uvicorn main:app --reload` requests usually use `http://127.0.0.1:8000`.

## Agent Rules

- Do not invent fields, tables, enum values, or relationships beyond this document and `schema.sql`.
- Do not print, log, commit, or return database credentials. They live in the repo root `.env`.
- Reuse `open_db_connection()` or `get_db_connection()` from `db-rest-api/main.py` for DB-backed endpoints.
- JSON columns must be serialized before writes and deserialized before API responses.
- Project assignments are stored by ID in `project_assignments`; name-based assignment fields are response aliases only.
- Updating a move request only updates the `move_requests` row. It does not automatically move employees between projects.
- Matching policies are versioned rows in `policies`; exactly one policy should be active. The seeded default active policy is `Balanced strict matching`, and backend matching run endpoints use balanced unless a request selects a different policy.
- If the DB schema or public API changes, update this document in the same change.

## Service Metadata Endpoints

- `GET /`
  Returns service status and the main endpoint list.

- `GET /health`
  Returns `{"status": "ok"}` without checking the database.

- `GET /health/db`
  Runs `SELECT 1` against MySQL and returns `{"status": "ok"}`. On DB connection failure, returns HTTP `503` with `Database connection failed`.

- `GET /version`
  Returns the service name and `APP_VERSION`.

- `GET /docs`
  FastAPI Swagger UI.

- `GET /openapi.json`
  Machine-readable OpenAPI schema.

## Shared API Behavior

List endpoints:

- Accept `limit` query parameter, default `100`, minimum `1`, maximum `500`.
- Accept `offset` query parameter, default `0`, minimum `0`.
- Sort by ascending numeric `id`.

Update endpoints:

- Use `PUT`, but accept partial payloads.
- Reject an empty JSON object.
- Update only fields included in the request body.

Delete endpoints:

- Return HTTP `204` with no body on success.
- Return HTTP `404` if the target row does not exist.
- Follow MySQL foreign-key behavior defined in `schema.sql`.

Common DB error mapping:

- Duplicate unique value: HTTP `409`.
- Referenced row does not exist: HTTP `400`.
- Row is referenced by another row and cannot be deleted: HTTP `409`.
- DB operation or connection failure: HTTP `500` or `503` with a generic public message.

## Frontend Integration Notes

- Treat numeric IDs as canonical for current staffing. Use `projects[].current_team_member_ids` and `employees[].current_project_ids` for logic, mutations, cache keys, and comparisons.
- Treat name aliases as display helpers only. `projects[].current_team_members`, `employees[].current_project_names`, and `employees[].current_project` are derived from `project_assignments`.
- `employees[].current_project` is a compatibility alias for the first assigned project name. It can be `null` even though the canonical field is always `current_project_ids: []`.
- `employees[].preferences` still contains project-name strings, not IDs.
- Project cards can use `icon_url` for compact/app-icon UI and `poster_url` for wide hero/card imagery.
- Updating a move request status does not change `project_assignments`; a frontend should not assume accepted requests automatically move employees.

## Canonical Enum Values

`project_phase`:

```json
["new acquisition", "growth", "maintenance"]
```

`current_project_impact`:

```json
["low", "medium", "high"]
```

`move_requests.status`:

```json
["pending", "accepted", "rejected", "clarification_requested"]
```

`matching_runs.use_case`:

```json
["portfolio_rebalance", "project_rebalance", "project_staffing"]
```

`matching_runs.status`:

```json
["pending", "running", "completed", "failed"]
```

`matching_run_events.level`:

```json
["debug", "info", "warning", "error"]
```

`matching_run_events.stage`:

```json
["request", "snapshot", "strict_rules", "hiring_gap", "llm_evaluation", "persistence", "action"]
```

`matching_hiring_recommendations.urgency`:

```json
["low", "medium", "high"]
```

## Skill JSON Contract

`employees.skills` must use exactly these six keys. Values are integers from `0` to `3`.

```json
{
  "android": 0,
  "ios": 0,
  "web": 0,
  "backend": 0,
  "infrastructure": 0,
  "ai": 0
}
```

Skill levels:

- `0`: no experience or not currently relevant.
- `1`: basic familiarity, can contribute with support.
- `2`: strong working capability, can work independently.
- `3`: expert, can lead, review, and onboard others.

`projects.required_skills` uses the same six keys, but each value is stored as
the minimum number of engineers required at each skill level:

```json
{
  "android": { "level_1": 0, "level_2": 0, "level_3": 0 },
  "ios": { "level_1": 0, "level_2": 0, "level_3": 0 },
  "web": { "level_1": 0, "level_2": 2, "level_3": 0 },
  "backend": { "level_1": 1, "level_2": 1, "level_3": 0 },
  "infrastructure": { "level_1": 0, "level_2": 1, "level_3": 0 },
  "ai": { "level_1": 0, "level_2": 0, "level_3": 0 }
}
```

Each `level_n` bucket is a non-negative headcount requirement for that skill at
that level. This supports requirements like one Backend engineer at L2 and one
Backend engineer at L3. Older stored project rows with integer skill values or
the previous `{ "count": n, "minimum_level": level }` shape are normalized on
read into the matching `level_n` bucket.

## Projects

Database table: `projects`

Stored fields:

- `id`: integer primary key, auto-incremented.
- `project_name`: required string, unique, maximum 255 characters.
- `project_description`: required text.
- `project_phase`: required enum, one of `new acquisition`, `growth`, `maintenance`.
- `icon_url`: required HTTPS URL string, maximum 2048 characters.
- `poster_url`: required HTTPS URL string for a landscape poster, maximum 2048 characters.
- `required_people_amount`: required integer, minimum `0`.
- `required_skills`: required JSON object matching the project skill requirement contract.
- `github_repositories`: required JSON array of repository URLs.

Assignment fields:

- `current_team_member_ids`: canonical array of employee IDs assigned through `project_assignments`.
- `current_team_members`: legacy/display alias array of employee names derived from `project_assignments`.

Write behavior:

- Create/update accepts `current_team_member_ids` as the preferred assignment field.
- Create/update also accepts legacy `current_team_members` employee-name arrays and resolves them to IDs.
- If both assignment fields are provided, `current_team_member_ids` wins.
- Assignment updates replace the full project team for that project.

Endpoints:

- `GET /projects`
- `POST /projects`
- `GET /projects/{project_id}`
- `PUT /projects/{project_id}`
- `DELETE /projects/{project_id}`

Create payload:

```json
{
  "project_name": "Evernote",
  "project_description": "Personal productivity and note-taking app focused on fast sync, collaborative editing, AI-powered search, and reliable capture across devices.",
  "project_phase": "growth",
  "icon_url": "https://www.google.com/s2/favicons?domain=evernote.com&sz=128",
  "poster_url": "https://image.thum.io/get/width/1200/crop/630/https://evernote.com",
  "current_team_member_ids": [1],
  "required_people_amount": 3,
  "required_skills": {
    "android": { "level_1": 0, "level_2": 0, "level_3": 0 },
    "ios": { "level_1": 0, "level_2": 0, "level_3": 0 },
    "web": { "level_1": 0, "level_2": 2, "level_3": 0 },
    "backend": { "level_1": 1, "level_2": 1, "level_3": 0 },
    "infrastructure": { "level_1": 0, "level_2": 1, "level_3": 0 },
    "ai": { "level_1": 0, "level_2": 0, "level_3": 0 }
  },
  "github_repositories": ["https://github.com/bendingspoons/evernote-core"]
}
```

Response shape:

```json
{
  "id": 1,
  "project_name": "Evernote",
  "project_description": "Personal productivity and note-taking app focused on fast sync, collaborative editing, AI-powered search, and reliable capture across devices.",
  "project_phase": "growth",
  "icon_url": "https://www.google.com/s2/favicons?domain=evernote.com&sz=128",
  "poster_url": "https://image.thum.io/get/width/1200/crop/630/https://evernote.com",
  "current_team_member_ids": [1],
  "current_team_members": ["Giulia Rossi"],
  "required_people_amount": 3,
  "required_skills": {
    "android": { "level_1": 0, "level_2": 0, "level_3": 0 },
    "ios": { "level_1": 0, "level_2": 0, "level_3": 0 },
    "web": { "level_1": 0, "level_2": 2, "level_3": 0 },
    "backend": { "level_1": 1, "level_2": 1, "level_3": 0 },
    "infrastructure": { "level_1": 0, "level_2": 1, "level_3": 0 },
    "ai": { "level_1": 0, "level_2": 0, "level_3": 0 }
  },
  "github_repositories": ["https://github.com/bendingspoons/evernote-core"]
}
```

Project delete behavior:

- `move_requests.to_project_id` uses `ON DELETE CASCADE`, so deleting a target project deletes related move requests.
- `move_requests.from_project_id` uses `ON DELETE SET NULL`.
- `project_assignments.project_id` uses `ON DELETE CASCADE`, so deleting a project deletes related assignment rows.

## Employees

Database table: `employees`

Stored fields:

- `id`: integer primary key, auto-incremented.
- `name`: required string, unique, maximum 255 characters.
- `role`: required string, maximum 255 characters.
- `github_username`: optional string, maximum 255 characters. Stored as a bare handle without `@`.
- `skills`: required JSON object matching the skill contract.
- `preferences`: required JSON array of project-name strings.
- `interests`: required JSON array of short interest strings.

Assignment fields:

- `current_project_ids`: canonical array of project IDs assigned through `project_assignments`.
- `current_project_names`: display array of assigned project names derived from `project_assignments`.
- `current_project`: legacy/display alias for the first assigned project name, or `null` when unassigned.

Write behavior:

- Create/update accepts `current_project_ids` as the preferred assignment field.
- Create/update also accepts legacy `current_project` as a single project-name string or `null`.
- Create/update accepts optional `github_username`; leading `@` is stripped and blank input is stored as `null`.
- If both assignment fields are provided, `current_project_ids` wins.
- Assignment updates replace the full project list for that employee.

Endpoints:

- `GET /employees`
- `POST /employees`
- `GET /employees/{employee_id}`
- `PUT /employees/{employee_id}`
- `DELETE /employees/{employee_id}`

Create payload:

```json
{
  "name": "Marco Bianchi",
  "role": "Backend engineer",
  "github_username": "marco-bianchi",
  "current_project_ids": [1, 2],
  "skills": {
    "android": 0,
    "ios": 0,
    "web": 1,
    "backend": 3,
    "infrastructure": 2,
    "ai": 1
  },
  "preferences": ["Evernote"],
  "interests": ["platform reliability", "internal tools"]
}
```

Response shape:

```json
{
  "id": 1,
  "name": "Marco Bianchi",
  "role": "Backend engineer",
  "github_username": "marco-bianchi",
  "current_project_ids": [1, 2],
  "current_project_names": ["Evernote", "Remini"],
  "current_project": "Evernote",
  "skills": {
    "android": 0,
    "ios": 0,
    "web": 1,
    "backend": 3,
    "infrastructure": 2,
    "ai": 1
  },
  "preferences": ["Evernote"],
  "interests": ["platform reliability", "internal tools"]
}
```

Employee delete behavior:

- `move_requests.employee_id` uses `ON DELETE CASCADE`, so deleting an employee deletes related move requests.
- `project_assignments.employee_id` uses `ON DELETE CASCADE`, so deleting an employee deletes related assignment rows.

## Move Requests

Database table: `move_requests`

Stored fields:

- `id`: integer primary key, auto-incremented.
- `employee_id`: required integer foreign key to `employees.id`.
- `from_project_id`: nullable integer foreign key to `projects.id`.
- `to_project_id`: required integer foreign key to `projects.id`.
- `reason`: required text.
- `expected_role`: required string, maximum 255 characters.
- `current_project_impact`: required enum, one of `low`, `medium`, `high`.
- `status`: required enum, one of `pending`, `accepted`, `rejected`, `clarification_requested`.
- `created_at`: required datetime, defaults to current timestamp in MySQL.
- `responded_at`: nullable datetime.

API response-only joined fields:

- `employee_name`: from `employees.name`.
- `from_project_name`: from `projects.project_name`, nullable.
- `to_project_name`: from `projects.project_name`.

Endpoints:

- `GET /move-requests`
- `POST /move-requests`
- `GET /move-requests/{request_id}`
- `PUT /move-requests/{request_id}`
- `DELETE /move-requests/{request_id}`

Create payload:

```json
{
  "employee_id": 1,
  "from_project_id": 1,
  "to_project_id": 2,
  "reason": "Backend and infrastructure experience match the target project's needs.",
  "expected_role": "Backend/platform engineer",
  "current_project_impact": "low",
  "status": "pending"
}
```

Response shape:

```json
{
  "id": 1,
  "employee_id": 1,
  "employee_name": "Marco Bianchi",
  "from_project_id": 1,
  "from_project_name": "Evernote",
  "to_project_id": 2,
  "to_project_name": "Remini",
  "reason": "Backend and infrastructure experience match the target project's needs.",
  "expected_role": "Backend/platform engineer",
  "current_project_impact": "low",
  "status": "pending",
  "created_at": "2026-04-25T12:00:00",
  "responded_at": null
}
```

Status behavior:

- New move requests default to `pending` if `status` is omitted.
- Updating `status` to `accepted`, `rejected`, or `clarification_requested` sets `responded_at` to the API server's current UTC time stored as a naive MySQL datetime.
- Updating `status` back to `pending` clears `responded_at`.
- Updating other fields without `status` leaves `responded_at` unchanged.

Foreign-key behavior:

- `employee_id` must reference an existing employee.
- `to_project_id` must reference an existing project.
- `from_project_id` may be `null`, but a non-null value must reference an existing project.

## Policies

Database table: `policies`

Policies store reusable matching rule configuration. The backend matching service
loads a stored policy before every matching run. Backend run endpoints accept
`policy_id` or `policy_name`; when neither is provided they use
`Balanced strict matching`. The final effective config is still stored on
`matching_runs.rule_config` for auditability.

Stored fields:

- `id`: integer primary key, auto-incremented.
- `name`: required string, unique, maximum 255 characters.
- `description`: optional text.
- `config`: required JSON object containing matching rule values.
- `is_active`: required boolean. API activation flows keep one active policy.
- `created_at`: datetime set by MySQL.
- `updated_at`: datetime set by MySQL and updated on row changes.
- `activated_at`: datetime set when a policy is activated, otherwise nullable.

Default seed:

- `schema.sql` inserts `Conservative strict matching`, `Balanced strict matching`, and `Aggressive strict matching` when each named row is missing.
- `Balanced strict matching` is activated by default.

Endpoints:

- `GET /policies`
- `POST /policies`
- `GET /policies/active`
- `GET /policies/{policy_id}`
- `PUT /policies/{policy_id}`
- `POST /policies/{policy_id}:activate`
- `DELETE /policies/{policy_id}`

`GET /policies` accepts `limit`, `offset`, and optional exact `name` filter.
`GET /policies/active` returns HTTP `404` when no active policy exists.

Create payload:

```json
{
  "name": "Balanced strict matching",
  "description": "Balanced matching defaults for staffing recommendations.",
  "config": {
    "max_candidate_plans": 25,
    "max_moves": 2,
    "max_projects_in_scope": 8,
    "max_employees_in_scope": 60,
    "max_employee_project_count": 2,
    "minimum_remaining_project_coverage": 0.75,
    "minimum_target_coverage_improvement": 0.1,
    "allow_unassigned_employees": true,
    "allow_multi_project_assignment": true,
    "allow_understaff_current_project": false,
    "exclude_pending_move_requests": true,
    "prefer_employee_preferences": true,
    "emit_hiring_gaps": true
  },
  "is_active": false
}
```

Response shape:

```json
{
  "id": 2,
  "name": "Balanced strict matching",
  "description": "Balanced matching defaults for staffing recommendations.",
  "config": {
    "max_candidate_plans": 25,
    "max_moves": 2,
    "max_projects_in_scope": 8,
    "max_employees_in_scope": 60,
    "max_employee_project_count": 2,
    "minimum_remaining_project_coverage": 0.75,
    "minimum_target_coverage_improvement": 0.1,
    "allow_unassigned_employees": true,
    "allow_multi_project_assignment": true,
    "allow_understaff_current_project": false,
    "exclude_pending_move_requests": true,
    "prefer_employee_preferences": true,
    "emit_hiring_gaps": true
  },
  "is_active": false,
  "created_at": "2026-04-25T12:00:00",
  "updated_at": "2026-04-25T12:00:00",
  "activated_at": null
}
```

Activation behavior:

- Creating a policy with `is_active: true`, updating a policy with `is_active: true`, or calling `POST /policies/{policy_id}:activate` deactivates all other policies in the same transaction.
- Updating the active policy to `is_active: false` is rejected with HTTP `409`; activate another policy instead.
- Deleting the active policy is rejected with HTTP `409`.

## Matching Persistence

Matching endpoints store advisory pipeline output for the backend matching
service. They do not run the matching algorithm and do not mutate
`project_assignments`.

Database tables:

- `matching_runs`: lifecycle, use case, target project, effective rule config,
  input snapshot, counts, selected plan, summary, error, and timestamps.
- `matching_candidates`: deterministic strict-rule candidate plans for a run.
- `matching_recommendations`: ranked candidate plans with explanations,
  risks, suggested moves, and model metadata.
- `matching_hiring_recommendations`: first-class hiring gap recommendations for
  runs that cannot be safely solved by reassignment alone.
- `matching_run_events`: append-only frontend-visible progress/audit events.

JSON columns:

- `matching_runs.rule_config`
- `matching_runs.input_snapshot`
- `matching_candidates.hard_rule_summary`
- `matching_candidates.plan_payload`
- `matching_recommendations.risks`
- `matching_recommendations.suggested_moves`
- `matching_recommendations.model_metadata`
- `matching_hiring_recommendations.required_skills`
- `matching_run_events.metadata`

Endpoints:

- `GET /matching-runs`
- `POST /matching-runs`
- `GET /matching-runs/latest`
- `GET /matching-runs/{run_id}`
- `PUT /matching-runs/{run_id}`
- `DELETE /matching-runs/{run_id}`
- `GET /projects/{project_id}/matching/latest`
- `GET /matching-runs/{run_id}/candidates`
- `POST /matching-runs/{run_id}/candidates`
- `GET /matching-candidates/{candidate_id}`
- `GET /matching-runs/{run_id}/recommendations`
- `POST /matching-runs/{run_id}/recommendations`
- `GET /matching-recommendations/{recommendation_id}`
- `GET /matching-runs/{run_id}/hiring-recommendations`
- `POST /matching-runs/{run_id}/hiring-recommendations`
- `GET /matching-runs/{run_id}/events`
- `POST /matching-runs/{run_id}/events`
- `POST /matching-runs/{run_id}/recommendations/{candidate_plan_id}/move-requests`

`GET /matching-runs` accepts `limit`, `offset`, and optional `use_case`,
`target_project_id`, and `status` filters. `GET /matching-runs/latest` accepts
optional `use_case` and `target_project_id` filters and returns HTTP `404` when
no matching run exists.

Create run payload:

```json
{
  "use_case": "project_rebalance",
  "target_project_id": 7,
  "status": "pending",
  "requested_by": "cto@example.com",
  "rule_config": {
    "max_moves": 3,
    "max_candidate_plans": 25
  },
  "input_snapshot": {
    "project_ids": [7],
    "employee_ids": [1, 3, 9]
  }
}
```

Matching run response shape:

```json
{
  "id": 42,
  "use_case": "project_rebalance",
  "target_project_id": 7,
  "status": "completed",
  "requested_by": "cto@example.com",
  "rule_config": {
    "max_moves": 3,
    "max_candidate_plans": 25
  },
  "input_snapshot": {
    "project_ids": [7],
    "employee_ids": [1, 3, 9]
  },
  "candidate_count": 1,
  "recommendation_count": 1,
  "hiring_recommendation_count": 1,
  "selected_candidate_plan_id": "plan_01",
  "summary": "Plan 01 is the best low-disruption option.",
  "error_message": null,
  "created_at": "2026-04-25T12:00:00",
  "started_at": "2026-04-25T12:00:01",
  "completed_at": "2026-04-25T12:00:10"
}
```

Create candidate payload:

```json
{
  "candidate_plan_id": "plan_01",
  "strict_score": 0.82,
  "hard_rule_summary": {
    "valid": true,
    "target_project_id": 7,
    "move_count": 1,
    "target_gap_before": 2.0,
    "target_gap_after": 0.0,
    "rules_checked": [
      "identity",
      "skill_contract",
      "headcount",
      "source_project_protection",
      "pending_requests",
      "reasonable_disruption"
    ]
  },
  "plan_payload": {
    "summary": "Move 3 toward Project 7 to reduce headcount or skill gaps.",
    "moves": [
      {
        "employee_id": 3,
        "from_project_id": 2,
        "to_project_id": 7,
        "action": "move",
        "suggested_role": "Backend/platform engineer",
        "current_project_impact": "low",
        "hard_rule_reasons": [
          "Employee and target project exist in the DB snapshot.",
          "Move improves or preserves target coverage.",
          "Source project remains above strict minimums."
        ],
        "reason": "Employee covers target backend gaps."
      }
    ],
    "risks": [],
    "project_coverage_after": {
      "7": {
        "headcount_gap": 0,
        "skill_gap": {
          "android": 0,
          "ios": 0,
          "web": 0,
          "backend": 0,
          "infrastructure": 0,
          "ai": 0
        },
        "available_skills": {
          "android": 0,
          "ios": 0,
          "web": 2,
          "backend": 3,
          "infrastructure": 2,
          "ai": 0
        },
        "coverage_ratio": 1.0
      }
    }
  },
  "rejected_reason": null
}
```

The backend matching pipeline stores deterministic Step 1 output in
`matching_candidates`. When candidates exist, the LLM ranking step evaluates
those rows and creates final `matching_recommendations`; completed runs with
candidate plans should have `recommendation_count` greater than `0`. Runs with
no strict-rule candidates can still complete with `recommendation_count` set to
`0` and hiring recommendations as the main outcome.

The backend orchestration endpoints (`/api/projects/{project_id}/matching:run`
and `/api/matching/portfolio:rebalance`) return a compact approval response with
`suggestions`, `hiring_suggestions`, and summary diagnostics. Use these DB API
child endpoints for persisted audit/debug data or to convert an approved
recommendation into move requests.

Create recommendation payload:

```json
{
  "candidate_plan_id": "plan_01",
  "rank": 1,
  "fit_score": 0.91,
  "summary": "Best balance of target coverage and low source disruption.",
  "explanation": "The suggested employee covers the target backend gap.",
  "risks": ["Source project remains above strict minimums."],
  "ramp_up_estimate": "3-5 days",
  "suggested_moves": [
    {
      "employee_id": 3,
      "from_project_id": 2,
      "to_project_id": 7,
      "action": "move",
      "suggested_role": "Backend/platform engineer",
      "current_project_impact": "low",
      "reason": "Covers the target backend gap with low source impact.",
      "move_request_reason": "Backend skills match the target project's needs."
    }
  ],
  "model_metadata": {
    "model": "gpt-4o",
    "prompt_version": "matching_llm_evaluator_v1"
  }
}
```

Create hiring recommendation payload:

```json
{
  "candidate_plan_id": "plan_01",
  "project_id": 7,
  "role_title": "Senior backend/platform engineer",
  "count": 1,
  "required_skills": {
    "android": 0,
    "ios": 0,
    "web": 1,
    "backend": 3,
    "infrastructure": 2,
    "ai": 0
  },
  "reason": "No safe reassignment can close the backend and infrastructure gap.",
  "urgency": "high",
  "suggested_assignment": "Hire directly into the target project."
}
```

Create event payload:

```json
{
  "level": "info",
  "stage": "strict_rules",
  "event_type": "strict_rules.completed",
  "message": "Generated 18 valid candidate plans.",
  "metadata": {
    "candidate_count": 18
  }
}
```

Action behavior:

- `POST /matching-runs/{run_id}/recommendations/{candidate_plan_id}/move-requests`
  reads the selected recommendation's `suggested_moves` and creates one
  `move_requests` row per suggested move.
- The action returns `{"move_requests": [...]}` with the standard move-request
  response shape.
- The action does not update `project_assignments`.
- Suggested moves must include `employee_id`, `to_project_id`,
  `current_project_impact`, and either `suggested_role` or `expected_role`.
  `from_project_id` can be `null`. The action uses `move_request_reason`, then
  `reason`, then the recommendation summary as the move-request reason.

Foreign-key behavior:

- `matching_runs.target_project_id` uses `ON DELETE SET NULL`.
- Deleting a matching run cascades its candidates, recommendations, hiring
  recommendations, and events.
- `matching_hiring_recommendations.project_id` uses `ON DELETE SET NULL`.

## Schema Summary

```sql
projects(
  id,
  project_name,
  project_description,
  project_phase,
  icon_url,
  poster_url,
  required_people_amount,
  required_skills,
  github_repositories
)

employees(
  id,
  name,
  role,
  skills,
  preferences,
  interests
)

project_assignments(
  employee_id,
  project_id
)

move_requests(
  id,
  employee_id,
  from_project_id,
  to_project_id,
  reason,
  expected_role,
  current_project_impact,
  status,
  created_at,
  responded_at
)

matching_runs(
  id,
  use_case,
  target_project_id,
  status,
  requested_by,
  rule_config,
  input_snapshot,
  candidate_count,
  recommendation_count,
  hiring_recommendation_count,
  selected_candidate_plan_id,
  summary,
  error_message,
  created_at,
  started_at,
  completed_at
)

matching_candidates(
  id,
  run_id,
  candidate_plan_id,
  strict_score,
  hard_rule_summary,
  plan_payload,
  rejected_reason,
  created_at
)

matching_recommendations(
  id,
  run_id,
  candidate_plan_id,
  recommendation_rank,
  fit_score,
  summary,
  explanation,
  risks,
  ramp_up_estimate,
  suggested_moves,
  model_metadata,
  created_at
)

matching_hiring_recommendations(
  id,
  run_id,
  candidate_plan_id,
  project_id,
  role_title,
  count,
  required_skills,
  reason,
  urgency,
  suggested_assignment,
  created_at
)

matching_run_events(
  id,
  run_id,
  level,
  stage,
  event_type,
  message,
  metadata,
  created_at
)
```

## Safe Agent Workflow

Before making DB or API changes:

1. Read this document, `db-rest-api/CLAUDE.md`, and `db-rest-api/db/schema.sql`.
2. Check `db-rest-api/main.py` for current Pydantic models and endpoint behavior.
3. Decide whether the change is schema-only, API-only, or both.

For schema changes:

1. Update `db-rest-api/db/schema.sql`.
2. Update Pydantic API models and serializers in `db-rest-api/main.py`.
3. Update fixture models, prompts, validation, and loader logic in `db-rest-api/scripts/`.
4. Update this document and `db-rest-api/README.md`.

For API changes:

1. Update `db-rest-api/main.py`.
2. Regenerate or inspect `/openapi.json` if route shapes changed.
3. Update this document and `db-rest-api/README.md`.

Recommended verification:

- `python3 -m py_compile db-rest-api/main.py`
- Generate `app.openapi()` locally or inside Docker and confirm expected paths.
- Run read-only smoke checks against list endpoints when credentials are available.
- Avoid write smoke tests against production unless the user explicitly asks.
