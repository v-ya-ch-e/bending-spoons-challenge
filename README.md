# Bending Something

**Check docs for further info.**

## Docs

- [DB API documentation](docs/DB_API_DOCUMENTATION.md) for the `db-rest-api` schema, CRUD endpoints, payload contracts, and agent workflow.
- [Deployment documentation](docs/deployment.md) for the CI/CD workflow, server layout, nginx routing, TLS setup, and verification commands.

## Deployment

The DB REST API deploys to two environments on the same EC2 host:

- `main` -> production at `https://doubleu.team/db-api/...`
- `dev` -> development at `https://dev.doubleu.team/db-api/...`

See [docs/deployment.md](docs/deployment.md) for deployment details.