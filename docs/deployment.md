# Deployment

This repository deploys the DB REST API to one EC2 instance with two isolated Docker Compose environments:

- Production deploys from `main` to `https://doubleu.team/db-api/...`.
- Development deploys from `dev` to `https://dev.doubleu.team/db-api/...`.

Both environments currently use the same MySQL credentials, but they run from separate server directories, Docker Compose project names, and localhost ports.

## GitHub Actions

The deploy workflow lives in [.github/workflows/deploy.yml](../.github/workflows/deploy.yml).

It runs on pushes to:

- `main`
- `dev`

The workflow maps branches as follows:

| Branch | GitHub Environment | Server path | Compose project | Local port |
| --- | --- | --- | --- | --- |
| `main` | `production` | `/home/ubuntu/bending-spoons-challenge-prod` | `bsc-prod` | `8001` |
| `dev` | `development` | `/home/ubuntu/bending-spoons-challenge-dev` | `bsc-dev` | `8002` |

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

Each directory needs its own root `.env` file. The file is intentionally not committed and must contain:

```text
DB_HOST=...
DB_PORT=3306
DB_NAME=...
DB_USER=...
DB_PASSWORD=...
```

Never print these values in deploy logs.

## Docker Compose

[docker-compose.yml](../docker-compose.yml) exposes the API only on localhost:

```yaml
ports:
  - "127.0.0.1:${DB_REST_API_PORT:-8001}:8000"
```

The workflow sets `DB_REST_API_PORT` to `8001` for production and `8002` for development. The default `8001` keeps local and production behavior compatible when the variable is unset.

Manual server commands:

```bash
cd /home/ubuntu/bending-spoons-challenge-prod
DB_REST_API_PORT=8001 docker compose -p bsc-prod up -d --build --remove-orphans

cd /home/ubuntu/bending-spoons-challenge-dev
DB_REST_API_PORT=8002 docker compose -p bsc-dev up -d --build --remove-orphans
```

## Nginx

Nginx terminates public traffic and proxies `/db-api/` to the environment-specific localhost port:

```text
doubleu.team      /db-api/ -> http://127.0.0.1:8001/
dev.doubleu.team  /db-api/ -> http://127.0.0.1:8002/
```

The FastAPI app keeps `ROOT_PATH=/db-api` in both environments because the environment split happens by hostname, not by URL path.

## TLS for Development

Production already has HTTPS configured for `doubleu.team`.

Before issuing a certificate for development, create this DNS record with the domain provider:

```text
Type: A
Name: dev
Value: 18.184.106.240
```

Wait until it resolves:

```bash
dig dev.doubleu.team
```

Then issue the certificate on EC2:

```bash
sudo certbot --nginx -d dev.doubleu.team
```

Choose the HTTP-to-HTTPS redirect option if certbot prompts for it. Do not run certbot for `doubleu.team` unless you intentionally want to replace the existing production certificate.

## Verification

Check both containers:

```bash
docker ps --format "table {{.Names}}\t{{.Ports}}"
```

Expected ports:

```text
bsc-prod-db-rest-api-1  127.0.0.1:8001->8000/tcp
bsc-dev-db-rest-api-1   127.0.0.1:8002->8000/tcp
```

Check health endpoints:

```bash
curl -fsS https://doubleu.team/db-api/health
curl -fsS https://dev.doubleu.team/db-api/health
```

Both should return:

```json
{"status":"ok"}
```
