Follow the root `CLAUDE.md`.

The database-facing HTTP API lives in `../db-rest-api` and is exposed at `/db-api`. Do not duplicate DB connection setup here; add shared DB endpoints in `db-rest-api` using its connection helpers.

Keep FastAPI endpoints in `main.py` while the backend is small. If `main.py` starts carrying too many unrelated endpoints or feature groups, split HTTP handlers into `api/routes/` and keep service logic in `services/`.

## Environment (repository root `.env`, see `../.env.example`)

- `OPENAI_API_KEY` — required for LLM-powered skill profile and related flows.
- `GITHUB_TOKEN` — optional. Used by `clients/github_client.py` for GitHub REST API calls. Improves rate limits; **required** for private repositories. Omit only if you only hit public repos and accept unauthenticated limits.
- `DB_API_BASE_URL` — where to reach the DB REST API (local dev typically `http://127.0.0.1:8001`).

## GitHub client (`clients/github_client.py`)

- Wraps the public GitHub REST API: `Accept: application/vnd.github.v3+json`, optional `Authorization: token <GITHUB_TOKEN>`.
- `parse_github_url()` → `(owner, repo)` from a standard `github.com/.../...` URL.
- `get_repository_info()` fetches repo metadata, README (base64-decoded from API), and a recursive file tree, trying `main` then `master`, keeping the first 100 paths.
- Used by `services/skill_profile_service.py` to build context for the staffing LLM prompt.

Full setup, testing, and heuristics: `README.md` in this directory.
