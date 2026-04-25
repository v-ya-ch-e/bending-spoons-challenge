# Backend API

FastAPI service for the main Bending Spoons Challenge backend. Database-facing endpoints live in
`../db-rest-api`; keep shared DB access there.

This service is the orchestration layer for project skill-profile generation and
matching. It should call clients/services for DB API and LLM work rather than
owning direct database connection code.

## Local Development

```bash
uv sync
uv run uvicorn main:app --reload
```

Environment variables are loaded from the repository-level `.env` file.
Ensure `OPENAI_API_KEY` is set to enable LLM-powered features.

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
- **Skill Levels (0-3)**: All recommendations follow the Bending Spoons standard proficiency scale:
    - `0`: No experience
    - `1`: Basic familiarity
    - `2`: Strong working capability
    - `3`: Expert / Lead

### GitHub Integration
The `GitHubClient` performs a lightweight analysis of the target repository by:
1. Fetching the **file tree** to identify languages, frameworks, and project structure.
2. Extracting **README.md** content to understand the project's purpose and existing documentation.
3. Retrieving **metadata** (topics, description, primary language) for high-level context.

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

- `POST /projects`
- `GET /projects/{project_id}`
- `PUT /projects/{project_id}`
- `POST /projects/{project_id}/skill-profile:suggest`
- `PUT /projects/{project_id}/skill-profile`
- `POST /projects/{project_id}/matching:run`
- `GET /projects/{project_id}/matching/latest`

Non-health endpoints are currently API shape placeholders until the DB API and
LLM-backed service logic are wired.
