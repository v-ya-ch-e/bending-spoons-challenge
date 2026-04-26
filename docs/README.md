# Documentation

This folder contains the detailed project documentation. The repository
READMEs are intentionally short; use this index when you want implementation,
setup, or contract details.

## Start Here

- [Technical overview](TECHNICAL_OVERVIEW.md): service boundaries, data flow,
  repository structure, and key implementation choices.
- [Local development](LOCAL_DEVELOPMENT.md): environment variables, Docker
  Compose, individual service commands, data setup, and verification.
- [Product brief](bending_spoons_internal_platform_brief.md): product concept,
  target users, and demo narrative.

## Feature Contracts

- [Matching contract](MATCHING_DOCUMENTATION.md): frontend-facing matching
  behavior, request/response shapes, and UI integration notes.
- [Matching policy documentation](MATCHING_POLICY_DOCUMENTATION.md): policy
  presets and strict-rule configuration.
- [DB API documentation](DB_API_DOCUMENTATION.md): database-backed API contract,
  schema behavior, payloads, and persistence rules.

## Operations

- [Deployment](deployment.md): GitHub Actions, EC2 layout, Docker Compose
  projects, nginx routing, TLS, and verification.

## Area-Specific Notes

- Frontend UI/UX notes live in
  [`../frontend/docs/bending_spoons_platform_ui_ux_plan.md`](../frontend/docs/bending_spoons_platform_ui_ux_plan.md).
- Backend matching planning notes live in [`../backend/docs/`](../backend/docs/).
