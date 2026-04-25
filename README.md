# Bending Spoons Challenge

Internal Talent, Project, and Documentation OS concept for dynamic project staffing.

See `docs/bending_spoons_internal_platform_brief.md` for the product brief.

## Services

- `backend/`: FastAPI orchestration API. Features LLM-powered staffing analysis using GitHub repository metadata and project-specific heuristics.
- `db-rest-api/`: FastAPI service for database-facing endpoints and health checks.
- `frontend/`: Frontend application workspace.

Environment variables live in the repository-level `.env` file. Start from
`.env.example`. For backend-specific variables (e.g. LLM and GitHub
integration), see `backend/README.md`.

## Docs

- [DB API documentation](docs/DB_API_DOCUMENTATION.md) for the `db-rest-api` schema, CRUD endpoints, payload contracts, and agent workflow.
- [Deployment documentation](docs/deployment.md) for the CI/CD workflow, server layout, nginx routing, TLS setup, and verification commands.

## Deployment

The DB REST API deploys to two environments on the same EC2 host:

- `main` -> production at `https://doubleu.team/db-api/...`
- `dev` -> development at `https://dev.doubleu.team/db-api/...`

See [docs/deployment.md](docs/deployment.md) for the CI/CD workflow, server layout, nginx routing, TLS setup, and verification commands.
