# Mixing Spooners

**Live demo:** https://mixing-spooners.club

Mixing Spooners is an internal staffing and knowledge-transfer platform built for
the Bending Spoons challenge. It helps a CTO understand the current project
portfolio, identify the right people for a new or understaffed project, and
generate the documentation needed to move employees between teams with context.

## What to Try in the Demo

- Open the CTO workspace to review employees, companies, staffing gaps, and move
  requests.
- Create or inspect a company, then generate a skill profile from repository
  context.
- Run matching to get explainable staffing recommendations. The system combines
  deterministic strict rules with an LLM ranking step, then can turn selected
  recommendations into move requests.
- Open the documentation workspace to generate, edit, chat with, and rewrite
  project documentation from GitHub repository context.
- Switch to the Spooner workspace to see the employee-side view: assigned
  projects, requested transitions, onboarding/offboarding instructions, and
  project resources.

## Product Scope

The platform focuses on the operational loop that matters during rapid staffing
changes:

- `Portfolio`: active companies/projects, phases, repository links, staffing
  needs, and current team members.
- `People`: employee skills, interests, current assignments, and preferences.
- `Matching`: explainable reassignment and hiring-gap recommendations.
- `Documentation`: generated project docs, project-specific chat, and transition
  instructions for onboarding and offboarding.

The current implementation is GitHub-first. Notion and Slack are represented in
the product direction, but are not required for the live demo.

## Architecture

- `frontend/`: Next.js App Router application for CTO and Spooner workflows.
- `backend/`: FastAPI orchestration API for LLM-powered skill inference,
  documentation generation/chat, transition instruction generation, and matching.
- `db-rest-api/`: FastAPI service exposing the MySQL-backed project, employee,
  move-request, documentation, policy, and matching persistence API.
- `docs/`: technical overview, local setup, API contracts, matching details, and
  deployment notes.

Public production routes:

- App: `https://mixing-spooners.club`
- Backend orchestration API: `https://mixing-spooners.club/api/...`
- DB REST API: `https://mixing-spooners.club/db-api/...`

## Documentation

- [Documentation index](docs/README.md)
- [Technical overview](docs/TECHNICAL_OVERVIEW.md)
- [Local development](docs/LOCAL_DEVELOPMENT.md)
- [Product brief](docs/bending_spoons_internal_platform_brief.md)
- [Matching contract](docs/MATCHING_DOCUMENTATION.md)
- [DB API contract](docs/DB_API_DOCUMENTATION.md)
- [Deployment notes](docs/deployment.md)
