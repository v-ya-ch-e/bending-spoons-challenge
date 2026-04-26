# Deployment

This repository deploys the frontend, backend API, and DB REST API to one EC2 instance with two isolated Docker Compose environments:

- Production deploys from `main` to `https://mixing-spooners.club/`, `https://mixing-spooners.club/api/...`, and `https://mixing-spooners.club/db-api/...`.
- Development deploys from `dev` to `https://dev.mixing-spooners.club/`, `https://dev.mixing-spooners.club/api/...`, and `https://dev.mixing-spooners.club/db-api/...`.

Both environments currently use the same MySQL credentials, but they run from separate server directories, Docker Compose project names, and localhost ports.

## GitHub Actions

The deploy workflow lives in [.github/workflows/deploy.yml](../.github/workflows/deploy.yml).

It runs on pushes to:

- `main`
- `dev`

The workflow maps branches as follows:

| Branch | GitHub Environment | Server path | Compose project | Frontend port | Backend port | DB API port |
| --- | --- | --- | --- | --- | --- | --- |
| `main` | `production` | `/home/ubuntu/bending-spoons-challenge-prod` | `bsc-prod` | `3001` | `8011` | `8001` |
| `dev` | `development` | `/home/ubuntu/bending-spoons-challenge-dev` | `bsc-dev` | `3000` | `8012` | `8002` |

Required GitHub Environment secrets for both `production` and `development`:

| Secret | Purpose |
| --- | --- |
| `EC2_HOST` | Public EC2 hostname or IP. |
| `EC2_USERNAME` | SSH user, currently `ubuntu`. |
| `EC2_SSH_KEY` | Private SSH key for the deploy user. |

The workflow uses `github.token` for repository fetches during deploy. Do not store a long-lived GitHub token on the server.

## Server Layout

The EC2 host has one checkout per environment:

```text
/home/ubuntu/bending-spoons-challenge-prod
/home/ubuntu/bending-spoons-challenge-dev
```

Each directory needs its own root `.env` file for database-backed behavior. The file is intentionally not committed and must contain:

```text
DB_HOST=...
DB_PORT=3306
DB_NAME=...
DB_USER=...
DB_PASSWORD=...
```

Never print these values in deploy logs.

## Docker Compose

[docker-compose.yml](../docker-compose.yml) exposes services only on localhost:

```yaml
ports:
  - "127.0.0.1:${FRONTEND_PORT:-3000}:3000"
  - "127.0.0.1:${BACKEND_PORT:-8000}:8000"
  - "127.0.0.1:${DB_REST_API_PORT:-8001}:8000"
```

The workflow sets separate localhost ports for production and development so both environments can run on the same EC2 host without port conflicts. The defaults keep local development behavior compatible when variables are unset.

The backend talks to the DB REST API through Docker DNS (`DB_API_BASE_URL=http://db-rest-api:8000`) inside Compose. Local non-Docker backend runs can still use `.env` to point `DB_API_BASE_URL` at a localhost or public `/db-api` endpoint.

The frontend has two kinds of API URLs. Server-side rewrite targets (`DB_API_BASE_URL` and `BACKEND_API_BASE_URL`) use Docker-internal service names such as `http://db-rest-api:8000` and `http://backend:8000`. Public browser variables must stay same-origin, for example `NEXT_PUBLIC_BACKEND_API_BASE_URL=/api` and `NEXT_PUBLIC_DB_API_BASE_URL=/db-api`, so browsers call nginx rather than their own `localhost`.

Manual server commands:

```bash
cd /home/ubuntu/bending-spoons-challenge-prod
FRONTEND_PORT=3001 BACKEND_PORT=8011 DB_REST_API_PORT=8001 docker compose -p bsc-prod up -d --build --remove-orphans

cd /home/ubuntu/bending-spoons-challenge-dev
FRONTEND_PORT=3000 BACKEND_PORT=8012 DB_REST_API_PORT=8002 docker compose -p bsc-dev up -d --build --remove-orphans
```

## Nginx

Nginx terminates public traffic and proxies the site root, `/api/`, and `/db-api/` to the environment-specific localhost ports:

```text
mixing-spooners.club      /        -> http://127.0.0.1:3001
mixing-spooners.club      /api/    -> http://127.0.0.1:8011/
mixing-spooners.club      /db-api/ -> http://127.0.0.1:8001/
dev.mixing-spooners.club  /        -> http://127.0.0.1:3000
dev.mixing-spooners.club  /api/    -> http://127.0.0.1:8012/
dev.mixing-spooners.club  /db-api/ -> http://127.0.0.1:8002/
```

The FastAPI apps keep fixed root paths in both environments because the environment split happens by hostname, not by URL path:

- `backend` uses `BACKEND_ROOT_PATH=/api`.
- `db-rest-api` uses `ROOT_PATH=/db-api`.

## TLS for Development

Production already has HTTPS configured for `mixing-spooners.club`.

Before issuing a certificate for development, create this DNS record with the domain provider:

```text
Type: A
Name: dev
Value: 18.184.106.240
```

Wait until it resolves:

```bash
dig dev.mixing-spooners.club
```

Then issue the certificate on EC2:

```bash
sudo certbot --nginx -d dev.mixing-spooners.club
```

Choose the HTTP-to-HTTPS redirect option if certbot prompts for it. Do not run certbot for `mixing-spooners.club` unless you intentionally want to replace the existing production certificate.

## Verification

Check both containers:

```bash
docker ps --format "table {{.Names}}\t{{.Ports}}"
```

Expected ports:

```text
bsc-prod-frontend-1     127.0.0.1:3001->3000/tcp
bsc-prod-backend-1      127.0.0.1:8011->8000/tcp
bsc-prod-db-rest-api-1  127.0.0.1:8001->8000/tcp
bsc-dev-frontend-1      127.0.0.1:3000->3000/tcp
bsc-dev-backend-1       127.0.0.1:8012->8000/tcp
bsc-dev-db-rest-api-1   127.0.0.1:8002->8000/tcp
```

Check public endpoints:

```bash
curl -fsS https://mixing-spooners.club/
curl -fsS https://dev.mixing-spooners.club/
curl -fsS https://mixing-spooners.club/api/health
curl -fsS https://dev.mixing-spooners.club/api/health
curl -fsS https://mixing-spooners.club/db-api/health
curl -fsS https://dev.mixing-spooners.club/db-api/health
```

The root URLs should return the frontend HTML. The health endpoints should return:

```json
{"status":"ok"}
```
