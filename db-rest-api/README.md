# DB REST API

Small FastAPI service exposed publicly behind nginx at `/db-api`.

Production is served at `https://doubleu.team/db-api/...`; development is served at `https://dev.doubleu.team/db-api/...`. Both environments keep `ROOT_PATH=/db-api`; the split is by hostname, not by path.

## Local Development

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

The app defaults to `ROOT_PATH=/db-api` so OpenAPI and docs links work when nginx proxies either public environment to the container.

For local Docker Compose runs, the API binds to `127.0.0.1:${DB_REST_API_PORT:-8001}`. Set `DB_REST_API_PORT=8002` only when you intentionally want to mirror the development server port.

MySQL credentials are read from the root `.env` file:

- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`

Use `get_db_connection` as a FastAPI dependency or `open_db_connection()` as a context manager when adding MySQL-backed endpoints.

## Deployment

CI/CD is branch-based:

- `main` deploys production (`bsc-prod`, localhost port `8001`).
- `dev` deploys development (`bsc-dev`, localhost port `8002`).

See [../docs/deployment.md](../docs/deployment.md) for GitHub Actions, EC2 paths, nginx routing, TLS setup, and verification commands.

Useful endpoints:

- `GET /`
- `GET /health`
- `GET /health/db`
- `GET /version`
- `GET /docs`
