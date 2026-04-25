# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

## Project Notes

- `db-rest-api/` is the FastAPI service exposed publicly under `https://doubleu.team/db-api/...` for production and `https://dev.doubleu.team/db-api/...` for development.
- `docs/DB_API_DOCUMENTATION.md` is the canonical agent-facing DB API contract. Read it before changing database-backed API behavior, frontend API calls, schema, fixtures, or seed loading.
- Any database structure change must update `db-rest-api/db/schema.sql` in the same change; also update API models, fixture tooling, tests, and `docs/DB_API_DOCUMENTATION.md` when the schema change affects them.
- Deployments are branch-based: pushes to `main` deploy production, and pushes to `dev` deploy development. See `docs/deployment.md` before changing CI/CD, nginx, TLS, compose project names, server paths, or exposed ports.
- The EC2 host runs production and development as separate Docker Compose projects: `bsc-prod` on localhost port `8001`, and `bsc-dev` on localhost port `8002`.
- MySQL RDS credentials live in the repository root `.env` file as `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD`. Never commit or print their values.
- New DB-backed API endpoints should reuse `get_db_connection` or `open_db_connection()` from `db-rest-api/main.py` instead of creating ad hoc connection code.
