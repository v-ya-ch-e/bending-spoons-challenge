# Bending Something

**Check docs for further info.**

## Deployment

The DB REST API deploys to two environments on the same EC2 host:

- `main` -> production at `https://doubleu.team/db-api/...`
- `dev` -> development at `https://dev.doubleu.team/db-api/...`

See [docs/deployment.md](docs/deployment.md) for the CI/CD workflow, server layout, nginx routing, TLS setup, and verification commands.