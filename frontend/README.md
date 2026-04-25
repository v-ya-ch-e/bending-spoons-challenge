# Frontend

Frontend code should call DB-backed endpoints through the public `/db-api` prefix.

- Production API: `https://doubleu.team/db-api/...`
- Development API: `https://dev.doubleu.team/db-api/...`

Do not embed database credentials or direct database connection logic in frontend code. See [../docs/deployment.md](../docs/deployment.md) for environment routing and deployment details.
