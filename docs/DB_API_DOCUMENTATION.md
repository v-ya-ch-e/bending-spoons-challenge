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
- Keep `employees.current_project` as a project-name string and `projects.current_team_members` as an array of employee names unless the schema is intentionally redesigned.
- Updating a move request only updates the `move_requests` row. It does not automatically move employees between projects or rewrite project team-member JSON.
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

## Skill JSON Contract

Both `employees.skills` and `projects.required_skills` must use exactly these six keys. Values are integers from `0` to `3`.

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

## Projects

Database table: `projects`

Stored fields:

- `id`: integer primary key, auto-incremented.
- `project_name`: required string, unique, maximum 255 characters.
- `project_description`: required text.
- `project_phase`: required enum, one of `new acquisition`, `growth`, `maintenance`.
- `current_team_members`: required JSON array of employee names.
- `required_people_amount`: required integer, minimum `0`.
- `required_skills`: required JSON object matching the skill contract.
- `github_repositories`: required JSON array of repository URLs.

Endpoints:

- `GET /projects`
- `POST /projects`
- `GET /projects/{project_id}`
- `PUT /projects/{project_id}`
- `DELETE /projects/{project_id}`

Create payload:

```json
{
  "project_name": "Atlas Staffing",
  "project_description": "Internal staffing platform for dynamic project allocation.",
  "project_phase": "growth",
  "current_team_members": ["Giulia Rossi"],
  "required_people_amount": 3,
  "required_skills": {
    "android": 0,
    "ios": 0,
    "web": 2,
    "backend": 3,
    "infrastructure": 2,
    "ai": 1
  },
  "github_repositories": ["https://github.com/bendingspoons/atlas-staffing"]
}
```

Response shape:

```json
{
  "id": 1,
  "project_name": "Atlas Staffing",
  "project_description": "Internal staffing platform for dynamic project allocation.",
  "project_phase": "growth",
  "current_team_members": ["Giulia Rossi"],
  "required_people_amount": 3,
  "required_skills": {
    "android": 0,
    "ios": 0,
    "web": 2,
    "backend": 3,
    "infrastructure": 2,
    "ai": 1
  },
  "github_repositories": ["https://github.com/bendingspoons/atlas-staffing"]
}
```

Project delete behavior:

- `move_requests.to_project_id` uses `ON DELETE CASCADE`, so deleting a target project deletes related move requests.
- `move_requests.from_project_id` uses `ON DELETE SET NULL`.
- JSON references in `employees.current_project` and `projects.current_team_members` are not automatically rewritten.

## Employees

Database table: `employees`

Stored fields:

- `id`: integer primary key, auto-incremented.
- `name`: required string, unique, maximum 255 characters.
- `role`: required string, maximum 255 characters.
- `current_project`: nullable string, maximum 255 characters. This is a project name, not a foreign key.
- `skills`: required JSON object matching the skill contract.
- `preferences`: required JSON array of project-name strings.
- `interests`: required JSON array of short interest strings.

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
  "current_project": "Atlas Staffing",
  "skills": {
    "android": 0,
    "ios": 0,
    "web": 1,
    "backend": 3,
    "infrastructure": 2,
    "ai": 1
  },
  "preferences": ["Atlas Staffing"],
  "interests": ["platform reliability", "internal tools"]
}
```

Response shape:

```json
{
  "id": 1,
  "name": "Marco Bianchi",
  "role": "Backend engineer",
  "current_project": "Atlas Staffing",
  "skills": {
    "android": 0,
    "ios": 0,
    "web": 1,
    "backend": 3,
    "infrastructure": 2,
    "ai": 1
  },
  "preferences": ["Atlas Staffing"],
  "interests": ["platform reliability", "internal tools"]
}
```

Employee delete behavior:

- `move_requests.employee_id` uses `ON DELETE CASCADE`, so deleting an employee deletes related move requests.
- JSON references in `projects.current_team_members` are not automatically rewritten.

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
  "from_project_name": "Atlas Staffing",
  "to_project_id": 2,
  "to_project_name": "Eventbrite Integration",
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

## Schema Summary

```sql
projects(
  id,
  project_name,
  project_description,
  project_phase,
  current_team_members,
  required_people_amount,
  required_skills,
  github_repositories
)

employees(
  id,
  name,
  role,
  current_project,
  skills,
  preferences,
  interests
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
