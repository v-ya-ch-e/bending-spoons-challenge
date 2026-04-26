# Backend API

FastAPI service for the main Mixing Spooners backend. Database-facing endpoints live in
`../db-rest-api`; keep shared DB access there.

This service is the orchestration layer for project skill-profile generation,
project documentation generation/chat, transition instruction generation, and matching. It should call
clients/services for DB API and LLM work rather than owning direct database
connection code.

## Local Development

```bash
uv sync
uv run uvicorn main:app --reload
```

Environment variables are loaded from the repository-level `.env` file.
Ensure `OPENAI_API_KEY` is set to enable LLM-powered features. `GITHUB_TOKEN` is
optional: `clients/github_client.py` passes it to the GitHub REST API for better
rate limits; private repositories require a token with repo access. Public repos
work without a token, subject to unauthenticated rate limits.
`DB_API_BASE_URL` must point at the db-rest-api service for matching runs,
generated project documentation persistence, and transition instruction storage.
`OPENAI_MATCHING_TIMEOUT_SECONDS` is optional and bounds the LLM ranking step for
matching requests; default is 20 seconds.
`BACKEND_CORS_ALLOW_ORIGIN_REGEX` is optional and defaults to allowing local
browser origins such as `http://localhost:3000` and `http://127.0.0.1:3000`.

## Testing

Automated tests are located in the `tests/` directory. Run them using `uv`:

```bash
# Run all tests
uv run python -m unittest discover -s tests

# Run specific staffing service tests
uv run python -m unittest discover -s tests -p "test_staffing_service.py"
```

Run tests from the `backend/` directory with `python -m unittest` so the backend
root stays on Python's import path.

## Staffing Heuristics Logic

The backend implements a sophisticated staffing analysis engine in `services/skill_profile_service.py`. It uses an LLM (GPT-4o) combined with embedded heuristics to recommend team compositions.

### Core Heuristics
- **Minimize Headcount**: The engine is biased towards lean teams, preferring full-stack capabilities over specialized roles when a project is small or in maintenance.
- **Project Status Mapping**:
    - **NEW**: Suggests senior "Leads" and architects to establish technical foundations.
    - **GROWTH**: Suggests a balanced mix of Seniors and Mids to maximize delivery speed.
    - **MAINTENANCE**: Suggests a minimal crew of Mids/Juniors to ensure stability.
- **Skill Levels (0-3)**: All recommendations follow the Mixing Spooners standard proficiency scale:
    - `0`: No experience
    - `1`: Basic familiarity
    - `2`: Strong working capability
    - `3`: Expert / Lead

### GitHub Integration
The `GitHubClient` (see `clients/github_client.py`) calls the GitHub REST API with
`Accept: application/vnd.github.v3+json` and, when `GITHUB_TOKEN` is set, a
`token` Authorization header. It parses a repo URL into `owner` and `name`,
then fetches: repository metadata (`/repos/{owner}/{repo}`), the README
(`/repos/.../readme`, base64-decoded), and a branch tree (tries `main`, then
`master`, recursive listing capped to the first 100 paths). The result is fed
into the skill-profile LLM prompt.

### Constraints & Validation
- **Allowed Categories**: The engine strictly enforces six skill categories: `Android`, `iOS`, `Backend`, `Web`, `Infrastructure`, and `AI/ML`.
- **Hallucination Filtering**: A post-processing layer strips out any non-standard skill categories (e.g., "Design", "Product", "Security") that the LLM might suggest, ensuring compatibility with the matching engine.

## Structure

```text
backend/
  main.py                 # FastAPI app and current route definitions
  clients/                # External client setup, e.g. DB API and OpenAI
  services/               # Matching and skill-profile orchestration logic
  schemas/                # Pydantic API schemas, not DB table schemas
```

Health check:

- `GET /health`

Current orchestration endpoints:

- `POST /skill-profile`
- `POST /projects/{project_id}/documentation:refresh`
- `POST /projects/{project_id}/documentation:refresh-stream`
- `POST /projects/{project_id}/documentation:chat`
- `POST /projects/{project_id}/documentation:chat-stream`
- `POST /move-requests/{request_id}/instructions/{instruction_type}:generate`
- `POST /projects/{project_id}/matching:run`
- `POST /matching/portfolio:rebalance`

Matching runs execute the deterministic strict-rule step, persist candidates,
hiring gaps, and run events through db-rest-api, and leave final
`matching_recommendations` for the LLM ranking step. Run requests may include
`policy_id` or `policy_name`; omitted policy selection defaults to
`Balanced strict matching`.
