# DB REST API

FastAPI service for the MySQL-backed data layer of Mixing Spooners. It is
exposed behind nginx at `/db-api` and is the source of truth for projects,
employees, assignments, move requests, generated documentation, transition
instructions, matching policies, and matching run persistence.

Production: `https://mixing-spooners.club/db-api/...`

## What It Provides

- CRUD endpoints for companies/projects, employees, move requests, documentation,
  transition instructions, policies, and matching records.
- Health and version endpoints for deployment checks.
- Plain-SQL MySQL schema in `db/schema.sql`.
- Fixture tooling for generating, loading, and refreshing demo data.

## Local Development

```bash
cd db-rest-api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
ROOT_PATH=/db-api uvicorn main:app --reload --port 8001
```

See [local development](../docs/LOCAL_DEVELOPMENT.md) for environment variables,
Docker Compose, schema setup, fixture loading, and verification.

## API Notes

- List endpoints support `limit` and `offset`.
- `PUT` endpoints accept partial payloads.
- Joined display names are derived from IDs; assignment truth lives in
  `project_assignments`.
- Matching orchestration does not live here. The backend API creates and ranks
  matching candidates, then persists the results through this service.

The full endpoint, schema, and payload contract is in
[DB API documentation](../docs/DB_API_DOCUMENTATION.md).

## References

- [Technical overview](../docs/TECHNICAL_OVERVIEW.md)
- [Local development](../docs/LOCAL_DEVELOPMENT.md)
- [DB API documentation](../docs/DB_API_DOCUMENTATION.md)
- [Deployment](../docs/deployment.md)
