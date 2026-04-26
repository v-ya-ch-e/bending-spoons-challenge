from __future__ import annotations

import asyncio
import json
from datetime import UTC, datetime
from typing import Any

from clients import DbApiClient, GitHubClient, get_openai_client, get_openai_model


PROMPT_VERSION = "transition_instruction_v1"
INSTRUCTION_TYPES = {"onboarding", "offboarding"}
ACTIVE_MOVE_STATUSES = {"transition_started"}


def start_transition_instruction_generation(
    request_id: int,
    instruction_type: str,
    *,
    db_client: DbApiClient | None = None,
) -> dict[str, Any]:
    _validate_instruction_type(instruction_type)
    client, owned = _db_client(db_client)
    try:
        context = _load_transition_context(client, request_id, instruction_type)
        documentation = context["documentation"]
        return client.upsert_transition_instruction_by_move_request(
            request_id,
            instruction_type,
            {
                "status": "running",
                "content_markdown": "",
                "input_snapshot": _base_input_snapshot(context),
                "source_documentation_id": documentation["id"],
                "source_documentation_updated_at": documentation["updated_at"],
                "model_metadata": None,
                "last_error": None,
            },
        )
    finally:
        if owned:
            client.close()


async def generate_transition_instruction(
    request_id: int,
    instruction_type: str,
    *,
    db_client: DbApiClient | None = None,
    github_client: GitHubClient | None = None,
    openai_client: Any | None = None,
) -> dict[str, Any]:
    _validate_instruction_type(instruction_type)
    client, owned = _db_client(db_client)
    github = github_client or GitHubClient()
    try:
        context = _load_transition_context(client, request_id, instruction_type)
        commit_context = []
        if instruction_type == "offboarding" and not _is_mock_documentation(
            context["documentation"]
        ):
            commit_context = await _fetch_commit_context(
                github,
                context["context_project"].get("github_repositories") or [],
                context["employee"]["github_username"],
            )
        context["commit_context"] = commit_context
        content_markdown = await asyncio.to_thread(
            _generate_markdown,
            context,
            openai_client,
        )
        documentation = context["documentation"]
        return client.upsert_transition_instruction_by_move_request(
            request_id,
            instruction_type,
            {
                "status": "ready",
                "content_markdown": content_markdown,
                "input_snapshot": _input_snapshot(context),
                "source_documentation_id": documentation["id"],
                "source_documentation_updated_at": documentation["updated_at"],
                "model_metadata": {
                    "model": get_openai_model(),
                    "prompt_version": PROMPT_VERSION,
                },
                "last_error": None,
            },
        )
    except Exception as exc:
        return client.upsert_transition_instruction_by_move_request(
            request_id,
            instruction_type,
            {
                "status": "failed",
                "last_error": str(exc),
            },
        )
    finally:
        if owned:
            client.close()


def _load_transition_context(
    client: DbApiClient,
    request_id: int,
    instruction_type: str,
) -> dict[str, Any]:
    move_request = client.get_move_request(request_id)
    _validate_move_request_active(move_request)
    employee = client.get_employee(move_request["employee_id"])
    target_project = (
        client.get_project(move_request["to_project_id"])
        if move_request.get("to_project_id") is not None
        else None
    )
    if instruction_type == "onboarding" and target_project is None:
        raise ValueError("Offboarding-only moves do not require onboarding instructions.")
    if instruction_type == "offboarding" and move_request.get("from_project_id") is None:
        raise ValueError("Bench-to-project moves do not require offboarding instructions.")
    source_project = (
        client.get_project(move_request["from_project_id"])
        if move_request.get("from_project_id") is not None
        else _fallback_source_project(client, employee, target_project["id"])
    )
    context_project = target_project if instruction_type == "onboarding" else source_project
    documentation = client.get_project_documentation_by_project(context_project["id"])
    if documentation.get("status") != "ready" or not documentation.get("content_markdown"):
        raise ValueError("Project documentation is not ready yet.")
    employees = client.list_employees(limit=500)
    team = [
        _team_member_summary(member)
        for member in employees
        if context_project["id"] in (member.get("current_project_ids") or [])
    ]
    return {
        "instruction_type": instruction_type,
        "move_request": move_request,
        "employee": employee,
        "source_project": source_project,
        "target_project": target_project,
        "context_project": context_project,
        "documentation": documentation,
        "team": team,
    }


def _validate_move_request_active(move_request: dict[str, Any]) -> None:
    if (
        move_request.get("status") in ACTIVE_MOVE_STATUSES
        and
        move_request.get("cto_approval_status") == "approved"
        and move_request.get("employee_approval_status") == "approved"
    ):
        return
    raise ValueError(
        "Move request must be approved by both CTO and employee and have transition started first."
    )


def _is_mock_documentation(documentation: dict[str, Any]) -> bool:
    source_snapshot = documentation.get("source_snapshot")
    model_metadata = documentation.get("model_metadata")
    return (
        isinstance(source_snapshot, dict)
        and source_snapshot.get("generated_from") == "mock"
    ) or (
        isinstance(model_metadata, dict)
        and model_metadata.get("source") == "mock_documentation_seed"
    )


def _fallback_source_project(
    client: DbApiClient,
    employee: dict[str, Any],
    target_project_id: int,
) -> dict[str, Any]:
    for project_id in employee.get("current_project_ids") or []:
        if project_id != target_project_id:
            return client.get_project(project_id)
    if employee.get("current_project_ids"):
        return client.get_project(employee["current_project_ids"][0])
    return client.get_project(target_project_id)


async def _fetch_commit_context(
    github: GitHubClient,
    repositories: list[str],
    username: str,
) -> list[dict[str, Any]]:
    contexts = []
    for repo_url in repositories:
        owner, repo = github.parse_github_url(repo_url)
        context = await github.get_user_commit_context(owner, repo, username)
        context["url"] = repo_url
        contexts.append(context)
    return contexts


def _generate_markdown(
    context: dict[str, Any],
    openai_client: Any | None = None,
) -> str:
    instruction_type = context["instruction_type"]
    system_prompt = f"""You are a senior engineering transition lead.
Generate concise {instruction_type} instructions in Markdown for an employee transition.
Use the stored project documentation, employee role/skills, team context, and project metadata.
For onboarding, focus on ramp-up, first files/docs to read, setup, key workflows, and who to ask.
For offboarding, focus on handoff, ownership transfer, risky areas, pending verification, and the employee's public commit history when available.
Do not invent private facts. If context is incomplete, state what must be verified.
Return JSON with exactly one key: content_markdown."""
    user_content = {
        "instruction_type": instruction_type,
        "move_request": context["move_request"],
        "employee": _employee_summary(context["employee"]),
        "source_project": _project_summary(context["source_project"]),
        "target_project": _project_summary(context["target_project"]),
        "context_project": _project_summary(context["context_project"]),
        "context_project_team": context["team"],
        "documentation_markdown": context["documentation"]["content_markdown"],
        "commit_context": context.get("commit_context") or [],
    }
    client = openai_client or get_openai_client()
    response = client.chat.completions.create(
        model=get_openai_model(),
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": json.dumps(user_content)},
        ],
        response_format={"type": "json_object"},
    )
    data = _load_json_response(response)
    content = data.get("content_markdown")
    if not isinstance(content, str) or not content.strip():
        raise ValueError("LLM response did not include content_markdown.")
    return content.strip()


def _load_json_response(response: Any) -> dict[str, Any]:
    content = response.choices[0].message.content or "{}"
    data = json.loads(content)
    if not isinstance(data, dict):
        raise ValueError("LLM response was not a JSON object.")
    return data


def _base_input_snapshot(context: dict[str, Any]) -> dict[str, Any]:
    return {
        "instruction_type": context["instruction_type"],
        "move_request_id": context["move_request"]["id"],
        "employee_id": context["employee"]["id"],
        "source_project_id": context["source_project"]["id"],
        "target_project_id": (
            context["target_project"]["id"] if context["target_project"] else None
        ),
        "documentation_id": context["documentation"]["id"],
    }


def _input_snapshot(context: dict[str, Any]) -> dict[str, Any]:
    snapshot = _base_input_snapshot(context)
    snapshot["context_project_id"] = context["context_project"]["id"]
    snapshot["commit_repositories"] = [
        {
            "repository": item.get("repository"),
            "url": item.get("url"),
            "commit_count": len(item.get("commits") or []),
        }
        for item in context.get("commit_context") or []
    ]
    return snapshot


def _employee_summary(employee: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": employee["id"],
        "name": employee["name"],
        "role": employee["role"],
        "github_username": employee["github_username"],
        "skills": employee["skills"],
        "preferences": employee.get("preferences") or [],
        "interests": employee.get("interests") or [],
        "current_project_ids": employee.get("current_project_ids") or [],
        "current_project_names": employee.get("current_project_names") or [],
    }


def _team_member_summary(employee: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": employee["id"],
        "name": employee["name"],
        "role": employee["role"],
        "skills": employee["skills"],
    }


def _project_summary(project: dict[str, Any] | None) -> dict[str, Any] | None:
    if project is None:
        return None

    return {
        "id": project["id"],
        "name": project["project_name"],
        "description": project["project_description"],
        "phase": project["project_phase"],
        "required_people_amount": project["required_people_amount"],
        "required_skills": project["required_skills"],
        "github_repositories": project.get("github_repositories") or [],
        "current_team_member_ids": project.get("current_team_member_ids") or [],
        "current_team_members": project.get("current_team_members") or [],
    }


def _validate_instruction_type(instruction_type: str) -> None:
    if instruction_type not in INSTRUCTION_TYPES:
        raise ValueError("instruction_type must be onboarding or offboarding.")


def _db_client(db_client: DbApiClient | None) -> tuple[DbApiClient, bool]:
    if db_client is not None:
        return db_client, False
    return DbApiClient(), True
