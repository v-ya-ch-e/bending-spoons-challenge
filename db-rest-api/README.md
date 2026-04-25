# DB REST API

Small FastAPI service exposed publicly behind nginx at `/db-api`, plus the MySQL schema and seed-data tooling for the Atlas hackathon platform. The product brief lives in [../docs/bending_spoons_internal_platform_brief.md](../docs/bending_spoons_internal_platform_brief.md).

Production is served at `https://doubleu.team/db-api/...`; development is served at `https://dev.doubleu.team/db-api/...`. Both environments keep `ROOT_PATH=/db-api`; the split is by hostname, not by path.

For the canonical agent-facing API contract, payload shapes, schema notes, and safe update workflow, see [../docs/DB_API_DOCUMENTATION.md](../docs/DB_API_DOCUMENTATION.md).

## What this provides

- A FastAPI service with health, version, database connectivity, and CRUD endpoints.
- A three-table MySQL schema (`projects`, `employees`, `move_requests`) defined in plain SQL.
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
- `GET /docs`

List endpoints accept `limit` (default `100`, max `500`) and `offset` query parameters.
`PUT` endpoints accept partial payloads and update only the fields provided.

### Example project payload

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

### Example employee payload

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

This applies [db/schema.sql](db/schema.sql). Statements are idempotent (`CREATE TABLE IF NOT EXISTS`), so running it on an already-initialized database is a no-op.

To wipe and recreate the demo tables (drops `move_requests`, `employees`, `projects` in FK-safe order):

```bash
python scripts/init_db.py --reset
```

### 2. Generate fixtures via OpenAI

```bash
python scripts/generate_fixtures.py
```

Calls the model defined by `OPENAI_MODEL` and writes a validated dataset to `db-rest-api/fixtures/seed_data.json`. The `fixtures/` directory is created automatically. The script:

- Uses the OpenAI SDK's structured-output parsing with Pydantic models, so the response is guaranteed to match the fixture schema or the script exits with the model's refusal.
- Re-validates cross-references (every `current_project`, every `current_team_members` entry, every move-request name) and ensures all four `move_requests.status` values are present.
- Exits non-zero on any validation failure without writing the file.

Use `--output PATH` to write somewhere other than the default.

### 3. Load fixtures into MySQL

```bash
python scripts/load_fixtures.py
```

Reads `db-rest-api/fixtures/seed_data.json` and inserts in dependency order: `projects` -> `employees` -> `move_requests`. Move-request `employee_name`, `from_project_name`, and `to_project_name` are resolved to numeric IDs using the rows just inserted. The whole load runs inside one transaction; failures roll back.

Use `--fixture PATH` to load a different file.

### Full reset + reload

```bash
python scripts/init_db.py --reset
python scripts/load_fixtures.py
```

You only need to re-run `generate_fixtures.py` when you want a new dataset; the JSON is reusable across resets.

## Schema Overview

See [db/schema.sql](db/schema.sql) for the source of truth. Summary:

- `projects(id, project_name, project_description, project_phase, current_team_members, required_people_amount, required_skills, github_repositories)`
- `employees(id, name, role, current_project, skills, preferences, interests)`
- `move_requests(id, employee_id FK, from_project_id FK nullable, to_project_id FK, reason, expected_role, current_project_impact, status, created_at, responded_at)`

`skills` and `required_skills` use the brief's six keys exactly: `android`, `ios`, `web`, `backend`, `infrastructure`, `ai`. Levels are integers 0-3.

For agent-facing context (conventions, JSON column rules, when to add new tables), see [CLAUDE.md](CLAUDE.md).

## Deployment

CI/CD is branch-based:

- `main` deploys production (`bsc-prod`, localhost port `8001`).
- `dev` deploys development (`bsc-dev`, localhost port `8002`).

See [../docs/deployment.md](../docs/deployment.md) for GitHub Actions, EC2 paths, nginx routing, TLS setup, and verification commands.
