# DB REST API

Small FastAPI service exposed publicly behind nginx at `/db-api`.

## Local Development

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

The app defaults to `ROOT_PATH=/db-api` so OpenAPI and docs links work when nginx proxies `https://doubleu.team/db-api/...` to the container.

MySQL credentials are read from the root `.env` file:

- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`

Use `get_db_connection` as a FastAPI dependency or `open_db_connection()` as a context manager when adding MySQL-backed endpoints.

Useful endpoints:

- `GET /`
- `GET /health`
- `GET /health/db`
- `GET /version`
- `GET /docs`
