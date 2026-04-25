Follow the root `CLAUDE.md`.

Call DB-backed endpoints through the public `/db-api` prefix. Production uses `https://doubleu.team/db-api/...`; development uses `https://dev.doubleu.team/db-api/...`. Do not embed database credentials or direct database connection logic in frontend code.

Before adding or changing frontend calls to `db-rest-api`, read `../docs/DB_API_DOCUMENTATION.md` for endpoint paths, payload shapes, enums, and response contracts.
