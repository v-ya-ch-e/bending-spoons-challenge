Follow the root `CLAUDE.md`.

DB REST API notes:
- This FastAPI service is served publicly at `/db-api`.
- Production URL: `https://doubleu.team/db-api/...`; development URL: `https://dev.doubleu.team/db-api/...`.
- CI/CD is branch-based: `main` deploys `bsc-prod` on localhost port `8001`; `dev` deploys `bsc-dev` on localhost port `8002`. See `../docs/deployment.md` before changing deployment behavior.
- Keep MySQL RDS credentials in the root `.env`; expected keys are `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD`.
- Reuse `get_db_connection` or `open_db_connection()` from `main.py` for DB-backed endpoints.
- Do not log or return database credentials or raw connection errors from public endpoints.
