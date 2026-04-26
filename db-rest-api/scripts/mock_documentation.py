"""Mock project documentation helpers for demo seed data."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

MOCK_DOCUMENTATION_SOURCE = "mock_documentation_seed"
MOCK_DOCUMENTATION_PROMPT_VERSION = "mock_project_documentation_v1"


def is_mock_documentation_project(project: dict[str, Any]) -> bool:
    """Return false for the real internal project that should use GitHub docs."""
    normalized_name = str(project.get("project_name") or "").casefold()
    return "mixing spoon" not in normalized_name


def build_mock_documentation_payload(
    project: dict[str, Any],
    *,
    generated_at: str | None = None,
) -> dict[str, Any]:
    repositories = list(project.get("github_repositories") or [])
    generated_at = generated_at or datetime.now(UTC).replace(tzinfo=None).isoformat()

    return {
        "status": "ready",
        "content_markdown": build_mock_documentation_markdown(project),
        "source_repositories": repositories,
        "source_snapshot": {
            "generated_from": "mock",
            "reason": "Demo seed documentation for projects without accessible GitHub repositories.",
            "repositories": [
                {
                    "url": repository,
                    "mock": True,
                }
                for repository in repositories
            ],
        },
        "model_metadata": {
            "source": MOCK_DOCUMENTATION_SOURCE,
            "prompt_version": MOCK_DOCUMENTATION_PROMPT_VERSION,
        },
        "last_error": None,
        "last_generated_at": generated_at,
    }


def build_mock_documentation_markdown(project: dict[str, Any]) -> str:
    name = str(project["project_name"])
    description = str(project["project_description"])
    phase = str(project["project_phase"])
    repositories = list(project.get("github_repositories") or [])
    skill_summary = _skill_summary(project.get("required_skills") or {})
    workflow_focus = _workflow_focus(description)

    repository_lines = "\n".join(
        f"- `{repository}` (mock repository reference)" for repository in repositories
    )
    if not repository_lines:
        repository_lines = "- No repository reference is configured for this mock project."

    return f"""# {name}

> Mock documentation for demo use. This project does not use an accessible GitHub repository in the demo environment, so this document is the source of truth for chat, onboarding, and offboarding flows.

## Product Context
{description}

- Lifecycle phase: {phase}
- Staffing target: {project.get("required_people_amount", 0)} people
- Skill focus: {skill_summary}

## Architecture Overview
- Client surfaces cover the primary mobile and web experiences for the product.
- Product APIs own core user workflows, subscription or account state, and integrations with shared Bending Spoons services.
- Data services support analytics, operational reporting, and product-quality signals used by the team.
- Background jobs handle slow or failure-prone work such as imports, notifications, media processing, indexing, and data cleanup.
- Observability should track user-facing latency, error rates, queue health, and conversion-critical funnel steps.

## Key Workflows
- {workflow_focus}
- User identity, entitlement checks, and account lifecycle changes must be verified before changing product-critical paths.
- Release work should include regression coverage for the highest-volume user journeys and rollback notes for backend migrations.
- Product experiments should define success metrics, guardrails, and cleanup ownership before launch.

## Repositories
{repository_lines}

## Local Setup Notes
- Confirm the active environment, API base URLs, and feature flags before running the product locally.
- Start with the app shell, API service, and worker process that owns the workflow being changed.
- Use seeded or anonymized demo data for onboarding exercises; do not rely on production data during ramp-up.

## Onboarding Pointers
- Read this overview first, then inspect the product workflows that map to the engineer's role.
- Pair with a current project member for the first production-adjacent change.
- Make the first task small: add telemetry, improve validation, fix a low-risk UI defect, or update an internal runbook.

## Offboarding And Handoff
- List owned workflows, dashboards, alerts, recurring jobs, and open rollout decisions.
- Transfer review ownership for active pull requests and experiments before the employee leaves the project.
- Call out any risky areas where the mock documentation should be replaced by verified repository details.

## Open Questions
- Which repository paths own the highest-risk production workflows?
- Which alerts are noisy versus actionable?
- Which roadmap items are blocked by missing product or technical context?
"""


def _skill_summary(required_skills: dict[str, Any]) -> str:
    parts: list[str] = []
    for skill, requirement in required_skills.items():
        if not isinstance(requirement, dict):
            continue
        total = sum(
            int(requirement.get(level_key) or 0)
            for level_key in ("level_1", "level_2", "level_3")
        )
        if total > 0:
            parts.append(f"{skill} x{total}")
    return ", ".join(parts) if parts else "general product engineering"


def _workflow_focus(description: str) -> str:
    lowered = description.casefold()
    if any(keyword in lowered for keyword in ("video", "stream", "recording")):
        return "Media ingestion, processing, playback quality, and publishing flows are the main workflow areas."
    if any(keyword in lowered for keyword in ("photo", "ai", "model", "generation")):
        return "Model-backed creation, enhancement, moderation, and serving reliability are the main workflow areas."
    if any(keyword in lowered for keyword in ("file", "sync", "storage", "transfer")):
        return "Capture, storage, synchronization, sharing, and recovery flows are the main workflow areas."
    if any(keyword in lowered for keyword in ("event", "community", "marketplace", "ticket")):
        return "Discovery, organizer tooling, checkout, notifications, and trust flows are the main workflow areas."
    if any(keyword in lowered for keyword in ("route", "map", "outdoor", "cycling")):
        return "Planning, maps, offline availability, navigation, and device integration flows are the main workflow areas."
    return "Activation, retention, reliability, and customer-support workflows are the main workflow areas."
