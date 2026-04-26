# Backend API

FastAPI orchestration service for Mixing Spooners. It owns LLM-powered workflows
and delegates all durable data access to `../db-rest-api`.

## Responsibilities

- Infer project skill requirements from GitHub repository context.
- Generate, stream, edit, and chat with project documentation.
- Generate onboarding and offboarding instructions for approved move requests.
- Run the matching pipeline: deterministic strict rules first, then LLM ranking
  over the bounded candidate set.

## Local Development

```bash
cd backend
uv sync
BACKEND_ROOT_PATH=/api uv run uvicorn main:app --reload --port 8000
```

Environment variables are loaded from the repository root `.env`. See
[local development](../docs/LOCAL_DEVELOPMENT.md) for setup, routing, and
verification details.

## Project Layout

```text
backend/
  main.py       # FastAPI route definitions
  clients/      # DB API, GitHub, and OpenAI clients
  schemas/      # Pydantic request/response models
  services/     # Skill profile, documentation, transition, and matching logic
  tests/        # unittest coverage for backend behavior
```

## Testing

Run tests from `backend/` so the backend root stays on Python's import path:

```bash
cd backend
uv run python -m unittest discover -s tests
```

## References

- [Technical overview](../docs/TECHNICAL_OVERVIEW.md)
- [Local development](../docs/LOCAL_DEVELOPMENT.md)
- [Matching contract](../docs/MATCHING_DOCUMENTATION.md)
- [Matching policies](../docs/MATCHING_POLICY_DOCUMENTATION.md)
