# Local Development

This guide covers local setup for the full Mixing Spooners stack.

## Requirements

- Node.js and npm for the Next.js frontend.
- Python 3.12 for backend services.
- `uv` for the orchestration backend.
- Docker and Docker Compose for running all services together.
- A reachable MySQL 8 database for database-backed behavior.

## Environment

Create the repository root `.env` from the template:

```bash
cp .env.example .env
```

Required for database-backed behavior:

- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`

Required for LLM-powered flows:

- `OPENAI_API_KEY`

Optional but useful:

- `GITHUB_TOKEN`: improves GitHub API rate limits and enables private
  repository access.
- `OPENAI_MODEL`: model used by fixture generation and selected LLM flows.
- `OPENAI_MATCHING_TIMEOUT_SECONDS`: timeout for matching LLM ranking.

Local service routing defaults:

```text
BACKEND_ROOT_PATH=/api
ROOT_PATH=/db-api
BACKEND_PORT=8000
DB_REST_API_PORT=8001
FRONTEND_PORT=3000
DB_API_BASE_URL=http://127.0.0.1:8001
BACKEND_API_BASE_URL=http://127.0.0.1:8000
NEXT_PUBLIC_DB_API_BASE_URL=/db-api
NEXT_PUBLIC_BACKEND_API_BASE_URL=/api
```

Never commit `.env` or print real credentials in logs.

## Run Everything with Docker Compose

```bash
docker compose up --build
```

Open `http://localhost:3000`.

Compose runs:

- Frontend on `127.0.0.1:${FRONTEND_PORT:-3000}`
- Backend API on `127.0.0.1:${BACKEND_PORT:-8000}`
- DB REST API on `127.0.0.1:${DB_REST_API_PORT:-8001}`

Inside Compose, the backend talks to the DB API through Docker DNS at
`http://db-rest-api:8000`.

## Run Services Individually

Frontend:

```bash
cd frontend
npm ci
npm run dev
```

Backend orchestration API:

```bash
cd backend
uv sync
BACKEND_ROOT_PATH=/api uv run uvicorn main:app --reload --port 8000
```

DB REST API:

```bash
cd db-rest-api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
ROOT_PATH=/db-api uvicorn main:app --reload --port 8001
```

## Data Setup

Apply the schema:

```bash
cd db-rest-api
python scripts/init_db.py
```

Load existing fixtures:

```bash
python scripts/load_fixtures.py
```

Reset demo data and reload fixtures:

```bash
python scripts/init_db.py --reset
python scripts/load_fixtures.py
```

Generate a new validated fixture dataset:

```bash
python scripts/generate_fixtures.py
```

Fixture generation uses OpenAI and writes to
`db-rest-api/fixtures/seed_data.json`.

## Verification

Frontend:

```bash
cd frontend
npm run lint
```

Backend:

```bash
cd backend
uv run python -m unittest discover -s tests
```

DB REST API:

```bash
python3 -m pip install -r db-rest-api/requirements-dev.txt
python3 -m pytest db-rest-api/tests
```

The DB REST API tests use fake in-memory connections and do not touch RDS.

## Health Checks

- Frontend: `http://localhost:3000`
- Backend: `http://127.0.0.1:8000/health`
- DB API: `http://127.0.0.1:8001/health`
- DB connectivity: `http://127.0.0.1:8001/health/db`
