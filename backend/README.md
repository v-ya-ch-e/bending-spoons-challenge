# Backend API

FastAPI service for the main Bending Spoons Challenge backend. Database-facing endpoints live in
`../db-rest-api`; keep shared DB access there.

## Local Development

```bash
uv sync
uv run uvicorn main:app --reload
```

The app defaults to `ROOT_PATH=/api` for reverse-proxy deployments.

Health check:

- `GET /health`
