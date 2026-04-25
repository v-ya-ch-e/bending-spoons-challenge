Follow the root `CLAUDE.md`.

The database-facing HTTP API lives in `../db-rest-api` and is exposed at `/db-api`. Do not duplicate DB connection setup here; add shared DB endpoints in `db-rest-api` using its connection helpers.

If backend work requires a database structure change, make that change in `../db-rest-api/db/schema.sql` in the same change and keep `../docs/DB_API_DOCUMENTATION.md` aligned with the resulting contract.

Keep FastAPI endpoints in `main.py` while the backend is small. If `main.py` starts carrying too many unrelated endpoints or feature groups, split HTTP handlers into `api/routes/` and keep service logic in `services/`.
