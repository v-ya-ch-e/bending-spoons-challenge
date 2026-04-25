Follow the root `CLAUDE.md`.

The database-facing HTTP API lives in `../db-rest-api` and is exposed at `/db-api`. Do not duplicate DB connection setup here; add shared DB endpoints in `db-rest-api` using its connection helpers.
