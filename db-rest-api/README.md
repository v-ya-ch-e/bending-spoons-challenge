# DB REST API

Small FastAPI service exposed publicly behind nginx at `/db-api`, plus the MySQL schema and seed-data tooling for the Atlas hackathon platform. The product brief lives in [../docs/bending_spoons_internal_platform_brief.md](../docs/bending_spoons_internal_platform_brief.md).

Production is served at `https://doubleu.team/db-api/...`; development is served at `https://dev.doubleu.team/db-api/...`. Both environments keep `ROOT_PATH=/db-api`; the split is by hostname, not by path.

For the canonical agent-facing API contract, payload shapes, schema notes, and safe update workflow, see [../docs/DB_API_DOCUMENTATION.md](../docs/DB_API_DOCUMENTATION.md).

## What this provides

- A FastAPI service with health, version, database connectivity, and CRUD endpoints.
- A MySQL schema for staffing data plus matching pipeline persistence, defined in plain SQL.
- A script to apply the schema to AWS RDS.
- A script that uses the OpenAI API to generate realistic seed data as JSON.
- A script that loads that JSON into the database.

## Requirements

- Python 3.10+ (the Docker image uses Python 3.12).
- A reachable MySQL 8 database. Production target is AWS RDS, but any MySQL 8 instance works locally.
- An OpenAI API key for fixture generation.

## Local Development

```bash
cd db-rest-api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

The app defaults to `ROOT_PATH=/db-api` so OpenAPI and docs links work when nginx proxies either public environment to the container.

For local Docker Compose runs, the API binds to `127.0.0.1:${DB_REST_API_PORT:-8001}`. Set `DB_REST_API_PORT=8002` only when you intentionally want to mirror the development server port.

Create the env file at the repo root from the template and fill in your values:

```bash
cp ../.env.example ../.env
```

Required environment variables:

| Variable      | Purpose                                          |
| ------------- | ------------------------------------------------ |
| `DB_HOST`     | RDS endpoint or local MySQL host.                |
| `DB_PORT`     | Defaults to `3306` if unset.                     |
| `DB_NAME`     | Database/schema name. Must already exist on RDS. |
| `DB_USER`     | DB user with DDL + DML permissions.              |
| `DB_PASSWORD` | DB password.                                     |

Optional environment variables:

| Variable           | Purpose                                   |
| ------------------ | ----------------------------------------- |
| `OPENAI_API_KEY`   | Required for `generate_fixtures.py` only. |
| `OPENAI_MODEL`     | Defaults to `gpt-4o-mini`.                |
| `DB_REST_API_PORT` | Docker Compose host port, default `8001`. |
| `ROOT_PATH`        | API root path, default `/db-api`.         |
| `APP_VERSION`      | API version returned by `/version`.       |

Use `get_db_connection` as a FastAPI dependency or `open_db_connection()` as a context manager when adding MySQL-backed endpoints.

## Tests

Install test dependencies and run the service tests from the repository root:

```bash
python3 -m pip install -r db-rest-api/requirements-dev.txt
python3 -m pytest db-rest-api/tests
```

The tests use an in-memory fake DB connection and do not touch RDS.

## API Usage

The full CRUD contract is documented in [../docs/DB_API_DOCUMENTATION.md](../docs/DB_API_DOCUMENTATION.md). Keep that file in sync with any database schema or public API changes.

Useful endpoints:

- `GET /`
- `GET /health`
- `GET /health/db`
- `GET /version`
- `GET /projects`
- `POST /projects`
- `GET /projects/{project_id}`
- `PUT /projects/{project_id}`
- `DELETE /projects/{project_id}`
- `GET /employees`
- `POST /employees`
- `GET /employees/{employee_id}`
- `PUT /employees/{employee_id}`
- `DELETE /employees/{employee_id}`
- `GET /move-requests`
- `POST /move-requests`
- `GET /move-requests/{request_id}`
- `PUT /move-requests/{request_id}`
- `DELETE /move-requests/{request_id}`
- `GET /policies`
- `POST /policies`
- `GET /policies/active`
- `GET /policies/{policy_id}`
- `PUT /policies/{policy_id}`
- `POST /policies/{policy_id}:activate`
- `DELETE /policies/{policy_id}`
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
- `GET /docs`

List endpoints accept `limit` (default `100`, max `500`) and `offset` query parameters.
`GET /policies` also accepts an exact `name` filter.
`PUT` endpoints accept partial payloads and update only the fields provided.

For frontend work, use `current_team_member_ids` and `current_project_ids` as the canonical staffing fields. Name fields such as `current_team_members`, `current_project_names`, and `current_project` are derived display aliases. Project cards can use `icon_url` for compact imagery and `poster_url` for landscape hero/card imagery.

### Example project payload

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
    "android": 0,
    "ios": 0,
    "web": 2,
    "backend": 3,
    "infrastructure": 2,
    "ai": 1
  },
  "github_repositories": ["https://github.com/bendingspoons/evernote-core"]
}
```

### Example employee payload

```json
{
  "name": "Marco Bianchi",
  "role": "Backend engineer",
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

### Example move-request payload

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

Move-request responses include joined names (`employee_name`, `from_project_name`, and `to_project_name`) in addition to the stored IDs. When `status` is updated to `accepted`, `rejected`, or `clarification_requested`, the API sets `responded_at`; updating the status back to `pending` clears it.

## Data Setup

### 1. Initialize the schema

```bash
python scripts/init_db.py
```

This applies [db/schema.sql](db/schema.sql). Statements are idempotent (`CREATE TABLE IF NOT EXISTS`), so running it on an already-initialized database adds missing tables without resetting existing data.

To wipe and recreate the demo tables (drops matching persistence tables, `move_requests`, `project_assignments`, `employees`, and `projects` in FK-safe order):

```bash
python scripts/init_db.py --reset
```

### 2. Generate fixtures via OpenAI

```bash
python scripts/generate_fixtures.py
```

Calls the model defined by `OPENAI_MODEL` and writes a validated dataset to `db-rest-api/fixtures/seed_data.json`. By default, it generates 20 employees, 8 projects, and 12 move requests. The `fixtures/` directory is created automatically. The script:

- Uses the OpenAI SDK's structured-output parsing with Pydantic models, so the response is guaranteed to match the fixture schema or the script exits with the model's refusal.
- Uses a curated real-product project catalog, then re-validates cross-references (every `current_projects` entry, every employee preference, every move-request name), checks each project has staffing, and ensures all project phases plus all four `move_requests.status` values are present.
- Exits non-zero on any validation failure without writing the file.

Use `--employees`, `--projects`, `--move-requests`, `--attempts`, `--model`, `--timeout`, and `--output PATH` to override the defaults.

### 3. Load fixtures into MySQL

```bash
python scripts/load_fixtures.py
```

Reads `db-rest-api/fixtures/seed_data.json` and inserts in dependency order: `projects` -> `employees` -> `project_assignments` -> `move_requests`. Employee `current_projects` plus move-request `employee_name`, `from_project_name`, and `to_project_name` are resolved to numeric IDs using the rows just inserted. The whole load runs inside one transaction; failures roll back.

Use `--fixture PATH` to load a different file.

### Full reset + reload

```bash
python scripts/init_db.py --reset
python scripts/load_fixtures.py
```

You only need to re-run `generate_fixtures.py` when you want a new dataset; the JSON is reusable across resets.

## Schema Overview

See [db/schema.sql](db/schema.sql) for the source of truth. Summary:

- `projects(id, project_name, project_description, project_phase, icon_url, poster_url, required_people_amount, required_skills, github_repositories)`
- `employees(id, name, role, skills, preferences, interests)`
- `project_assignments(employee_id FK, project_id FK)`
- `move_requests(id, employee_id FK, from_project_id FK nullable, to_project_id FK, reason, expected_role, current_project_impact, status, created_at, responded_at)`
- `policies(id, name, description, config, is_active, created_at, updated_at, activated_at)`
- `matching_runs(id, use_case, target_project_id FK nullable, status, requested_by, rule_config, input_snapshot, counts, selected_candidate_plan_id, summary, error_message, timestamps)`
- `matching_candidates(id, run_id FK, candidate_plan_id, strict_score, hard_rule_summary, plan_payload, rejected_reason, created_at)`
- `matching_recommendations(id, run_id FK, candidate_plan_id, recommendation_rank, fit_score, summary, explanation, risks, ramp_up_estimate, suggested_moves, model_metadata, created_at)`
- `matching_hiring_recommendations(id, run_id FK, candidate_plan_id, project_id FK nullable, role_title, count, required_skills, reason, urgency, suggested_assignment, created_at)`
- `matching_run_events(id, run_id FK, level, stage, event_type, message, metadata, created_at)`

`skills` uses the brief's six keys exactly: `android`, `ios`, `web`, `backend`, `infrastructure`, `ai`. Employee skill levels are integers 0-3. Project `required_skills` uses the same keys with per-level count buckets: `level_1`, `level_2`, and `level_3`.

Matching persistence is storage-only. The backend matching pipeline creates runs,
candidates, recommendations, hiring recommendations, and events through this
API. The action endpoint can turn a selected recommendation's `suggested_moves`
into `move_requests`, but it does not update `project_assignments`.

For agent-facing context (conventions, JSON column rules, when to add new tables), see [CLAUDE.md](CLAUDE.md).

## Deployment

CI/CD is branch-based:

- `main` deploys production (`bsc-prod`, localhost port `8001`).
- `dev` deploys development (`bsc-dev`, localhost port `8002`).

See [../docs/deployment.md](../docs/deployment.md) for GitHub Actions, EC2 paths, nginx routing, TLS setup, and verification commands.
