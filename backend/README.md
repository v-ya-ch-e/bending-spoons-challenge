# Backend API

FastAPI service for the main Bending Spoons Challenge backend. Database-facing endpoints live in
`../db-rest-api`; keep shared DB access there.

This service is the orchestration layer for project skill-profile generation and
matching. It should call clients/services for DB API and LLM work rather than
owning direct database connection code.

## Local Development

```bash
uv sync
uv run uvicorn main:app --reload
```

Environment variables are loaded from the repository-level `.env` file.
Set `BACKEND_ROOT_PATH=/api` for reverse-proxy deployments.

`schemas/` contains Pydantic API request/response schemas. The MySQL schema
lives separately in `db/schema.sql` when the DB setup scripts are present.

## Structure

```text
backend/
  main.py                 # FastAPI app and current route definitions
  clients/                # External client setup, e.g. DB API and OpenAI
  services/               # Matching and skill-profile orchestration logic
  schemas/                # Pydantic API schemas, not DB table schemas
```

Health check:

- `GET /health`

Current orchestration endpoints:

- `POST /projects`
- `GET /projects/{project_id}`
- `PUT /projects/{project_id}`
- `POST /projects/{project_id}/skill-profile:suggest`
- `PUT /projects/{project_id}/skill-profile`
- `POST /projects/{project_id}/matching:run`
- `GET /projects/{project_id}/matching/latest`

Non-health endpoints are currently API shape placeholders until the DB API and
LLM-backed service logic are wired.
