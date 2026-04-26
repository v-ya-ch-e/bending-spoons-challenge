# Mixing Spooners

Internal Talent, Project, and Documentation OS for dynamic project staffing.

See `docs/bending_spoons_internal_platform_brief.md` for the product brief.

## Current Product Surface

- CTO workspace for project and employee management, project skill inference, matching runs, and generated project documentation.
- Documentation workspace that fetches GitHub repository context, streams generated Markdown, supports manual edits, and lets the CTO chat with or rewrite project docs.
- Spooner workspace with employee selection, assigned-project context, generated documentation access, and project-specific documentation chat.
- Transition instruction flows that generate onboarding and offboarding Markdown from approved move requests, stored project documentation, and available GitHub activity.

## Services

- `backend/`: FastAPI orchestration API for LLM-powered staffing analysis, documentation generation/chat, transition instruction generation, and matching.
- `db-rest-api/`: FastAPI service for database-facing endpoints, project documentation persistence, transition instructions, matching persistence, and health checks.
- `frontend/`: Next.js application workspace for CTO and Spooner workflows.

Environment variables live in the repository-level `.env` file. Start from
`.env.example`. For backend-specific variables (e.g. LLM and GitHub
integration), see `backend/README.md`.

## Docs

- [DB API documentation](docs/DB_API_DOCUMENTATION.md) for the `db-rest-api` schema, CRUD endpoints, payload contracts, and agent workflow.
- [Deployment documentation](docs/deployment.md) for the CI/CD workflow, server layout, nginx routing, TLS setup, and verification commands.
- [Internal platform brief](docs/bending_spoons_internal_platform_brief.md) for the product model and demo narrative.
- [Frontend UI/UX plan](frontend/docs/bending_spoons_platform_ui_ux_plan.md) for the implemented and planned CTO/Spooner screens.

## Deployment

The DB REST API deploys to two environments on the same EC2 host:

- `main` -> production at `https://mixing-spooners.club/db-api/...`
- `dev` -> development at `https://dev.mixing-spooners.club/db-api/...`

See [docs/deployment.md](docs/deployment.md) for the CI/CD workflow, server layout, nginx routing, TLS setup, and verification commands.
