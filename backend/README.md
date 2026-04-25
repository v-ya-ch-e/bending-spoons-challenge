# Atlas Backend

MySQL schema and seeding scripts for the Atlas hackathon platform. The product brief lives in [docs/bending_spoons_internal_platform_brief.md](../docs/bending_spoons_internal_platform_brief.md).

## What this provides

- A three-table MySQL schema (`projects`, `employees`, `move_requests`) defined in plain SQL.
- A script to apply the schema to AWS RDS.
- A script that uses the OpenAI API to generate realistic seed data as JSON.
- A script that loads that JSON into the database.

There is no application server here yet — only the data layer.

## Requirements

- Python 3.10+ (uses `str | None` type unions).
- A reachable MySQL 8 database. Production target is AWS RDS, but any MySQL 8 instance works locally.
- An OpenAI API key for fixture generation.

## Setup

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Then create the env file at the repo root from the template and fill in your values:

```bash
cp ../.env.example ../.env
```

Required environment variables:

| Variable         | Purpose                                          |
| ---------------- | ------------------------------------------------ |
| `DB_HOST`        | RDS endpoint or local MySQL host.                |
| `DB_PORT`        | Defaults to `3306` if unset.                     |
| `DB_NAME`        | Database/schema name. Must already exist on RDS. |
| `DB_USER`        | DB user with DDL + DML permissions.              |
| `DB_PASSWORD`    | DB password.                                     |
| `OPENAI_API_KEY` | Required for `generate_fixtures.py` only.        |
| `OPENAI_MODEL`   | Optional. Defaults to `gpt-4o-mini`.             |

## Usage

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

Calls the model defined by `OPENAI_MODEL` and writes a validated dataset to `backend/fixtures/seed_data.json`. The `fixtures/` directory is created automatically. The script:

- Uses the OpenAI SDK's structured-output parsing with Pydantic models, so the response is guaranteed to match the fixture schema or the script exits with the model's refusal.
- Re-validates cross-references (every `current_project`, every `current_team_members` entry, every move-request name) and ensures all four `move_requests.status` values are present.
- Exits non-zero on any validation failure without writing the file.

Use `--output PATH` to write somewhere other than the default.

### 3. Load fixtures into MySQL

```bash
python scripts/load_fixtures.py
```

Reads `backend/fixtures/seed_data.json` and inserts in dependency order: `projects` → `employees` → `move_requests`. Move-request `employee_name`, `from_project_name`, and `to_project_name` are resolved to numeric IDs using the rows just inserted. The whole load runs inside one transaction; failures roll back.

Use `--fixture PATH` to load a different file.

### Full reset + reload

```bash
python scripts/init_db.py --reset
python scripts/load_fixtures.py
```

You only need to re-run `generate_fixtures.py` when you want a new dataset — the JSON is reusable across resets.

## Schema overview

See [db/schema.sql](db/schema.sql) for the source of truth. Summary:

- `projects(id, project_name, project_description, project_phase, current_team_members, required_people_amount, required_skills, github_repositories)`
- `employees(id, name, role, current_project, skills, preferences, interests)`
- `move_requests(id, employee_id FK, from_project_id FK nullable, to_project_id FK, reason, expected_role, current_project_impact, status, created_at, responded_at)`

`skills` and `required_skills` use the brief's six keys exactly: `android`, `ios`, `web`, `backend`, `infrastructure`, `ai`. Levels are integers 0-3.

For agent-facing context (conventions, JSON column rules, when to add new tables), see [CLAUDE.md](CLAUDE.md).
