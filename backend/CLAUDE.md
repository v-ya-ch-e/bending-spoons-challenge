Follow the root `CLAUDE.md`.

The database-facing HTTP API lives in `../db-rest-api` and is exposed at `/db-api`. Do not duplicate DB connection setup here; add shared DB endpoints in `db-rest-api` using its connection helpers.

Keep FastAPI endpoints in `main.py` while the backend is small. If `main.py` starts carrying too many unrelated endpoints or feature groups, split HTTP handlers into `api/routes/` and keep service logic in `services/`.
