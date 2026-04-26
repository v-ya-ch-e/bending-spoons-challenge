# Technical Overview

Mixing Spooners is split into three small services with clear ownership:

- `frontend/`: Next.js App Router UI for CTO and Spooner workflows.
- `backend/`: FastAPI orchestration API for LLM workflows and matching.
- `db-rest-api/`: FastAPI data API backed by MySQL.

The production app is served at `https://mixing-spooners.club`. Public traffic is
same-origin: `/api/...` reaches the orchestration backend, and `/db-api/...`
reaches the database API.

## Service Boundaries

### Frontend

The frontend renders the demo experience and talks to APIs through same-origin
paths. It does not know database credentials and does not connect to MySQL.

Main areas:

- CTO workspace: overview, companies, employees, matching, move requests, and
  documentation.
- Spooner workspace: employee picker, assigned project, transition instructions,
  and project resources.
- Shared API clients under `frontend/src/lib/`.

### Backend

The backend owns workflows that require orchestration or LLM calls:

- Project skill-profile generation from GitHub repository context.
- Project documentation generation, streaming, chat, and rewrite flows.
- Onboarding/offboarding instruction generation for move requests.
- Matching runs, including deterministic strict-rule candidate generation and
  LLM ranking.

It stores durable state by calling `db-rest-api`; direct database connections do
not belong in this service.

### DB REST API

The DB REST API owns database-backed CRUD and persistence:

- Projects, employees, assignments, and move requests.
- Generated project documentation and transition instructions.
- Matching policies, runs, candidates, recommendations, hiring gaps, and events.

The SQL source of truth is `db-rest-api/db/schema.sql`. The public API contract
is documented in [DB API documentation](DB_API_DOCUMENTATION.md).

## Core Data Flow

1. The frontend calls `/db-api` for ordinary CRUD screens and `/api` for
   orchestration workflows.
2. The backend loads required project, employee, policy, and move-request data
   from `db-rest-api`.
3. GitHub context and OpenAI are used only inside backend workflow services.
4. Generated documents, transition instructions, matching runs, and
   recommendations are persisted back through `db-rest-api`.
5. The frontend reads persisted state from `/db-api` and displays synchronous
   backend responses for orchestration results.

## Matching Flow

Matching is intentionally two-step:

1. Strict deterministic rules generate a bounded set of valid reassignment or
   hiring-gap candidates.
2. The LLM ranks only those candidates and writes explainable recommendations.

This keeps the system auditable: the model evaluates constrained choices instead
of inventing employees, projects, assignments, or skill requirements. The
frontend-facing contract is in
[matching documentation](MATCHING_DOCUMENTATION.md).

## Documentation Flow

Project documentation starts from stored project data and GitHub repository
context. The backend fetches bounded repository metadata, README content, and a
limited file tree, then generates Markdown that is persisted in
`project_documentation`.

The same stored documentation can be used later for project-specific chat and
transition instruction generation.

## Repository Structure

```text
.
  frontend/       Next.js UI and frontend API clients
  backend/        FastAPI orchestration service
  db-rest-api/    FastAPI MySQL data service, schema, fixtures, tests
  docs/           Product, technical, API, matching, and deployment docs
  docker-compose.yml
  .env.example
```

## Technical References

- [Local setup and verification](LOCAL_DEVELOPMENT.md)
- [DB API and schema contract](DB_API_DOCUMENTATION.md)
- [Matching behavior](MATCHING_DOCUMENTATION.md)
- [Matching policies](MATCHING_POLICY_DOCUMENTATION.md)
- [Deployment](deployment.md)
