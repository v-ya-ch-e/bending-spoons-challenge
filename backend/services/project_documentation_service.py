from __future__ import annotations

import asyncio
import json
from datetime import UTC, datetime
from typing import Any, Iterator

from clients import DbApiClient, GitHubClient, get_openai_client, get_openai_model
from schemas import ProjectDocumentationChatRequest, ProjectDocumentationChatResponse


PROMPT_VERSION = "project_documentation_v1"


def start_documentation_refresh(
    project_id: int,
    *,
    db_client: DbApiClient | None = None,
) -> dict[str, Any]:
    client, owned = _db_client(db_client)
    try:
        project = client.get_project(project_id)
        repositories = project.get("github_repositories") or []
        if not repositories:
            return client.upsert_project_documentation_by_project(
                project_id,
                {
                    "status": "failed",
                    "content_markdown": "",
                    "source_repositories": [],
                    "source_snapshot": None,
                    "model_metadata": None,
                    "last_error": "Project has no GitHub repositories configured.",
                },
            )

        return client.upsert_project_documentation_by_project(
            project_id,
            {
                "status": "running",
                "source_repositories": repositories,
                "source_snapshot": None,
                "model_metadata": None,
                "last_error": None,
            },
        )
    finally:
        if owned:
            client.close()


async def generate_project_documentation(
    project_id: int,
    *,
    db_client: DbApiClient | None = None,
    github_client: GitHubClient | None = None,
    openai_client: Any | None = None,
) -> dict[str, Any]:
    client, owned = _db_client(db_client)
    github = github_client or GitHubClient()
    try:
        project = client.get_project(project_id)
        repositories = project.get("github_repositories") or []
        if not repositories:
            raise ValueError("Project has no GitHub repositories configured.")

        contexts = []
        for repo_url in repositories:
            owner, repo = github.parse_github_url(repo_url)
            context = await github.get_repository_documentation_context(owner, repo)
            context["url"] = repo_url
            contexts.append(context)

        source_snapshot = {
            "generated_from": "github",
            "repositories": [_repository_snapshot(context) for context in contexts],
        }
        content_markdown = await asyncio.to_thread(
            _generate_markdown,
            project,
            contexts,
            openai_client,
        )
        generated_at = datetime.now(UTC).replace(tzinfo=None).isoformat()

        return client.upsert_project_documentation_by_project(
            project_id,
            {
                "status": "ready",
                "content_markdown": content_markdown,
                "source_repositories": repositories,
                "source_snapshot": source_snapshot,
                "model_metadata": {
                    "model": get_openai_model(),
                    "prompt_version": PROMPT_VERSION,
                },
                "last_error": None,
                "last_generated_at": generated_at,
            },
        )
    except Exception as exc:
        return client.upsert_project_documentation_by_project(
            project_id,
            {
                "status": "failed",
                "last_error": str(exc),
            },
        )
    finally:
        if owned:
            client.close()


def chat_with_documentation(
    project_id: int,
    payload: ProjectDocumentationChatRequest,
    *,
    db_client: DbApiClient | None = None,
    openai_client: Any | None = None,
) -> ProjectDocumentationChatResponse:
    client, owned = _db_client(db_client)
    try:
        project = client.get_project(project_id)
        documentation = client.get_project_documentation_by_project(project_id)
    finally:
        if owned:
            client.close()

    if not documentation.get("content_markdown"):
        raise ValueError("Project documentation is not ready yet.")

    response_payload = _chat_with_llm(
        project=project,
        documentation=documentation,
        payload=payload,
        openai_client=openai_client,
    )
    return ProjectDocumentationChatResponse(
        answer=response_payload.get("answer") or "I could not produce an answer.",
        updated_content_markdown=response_payload.get("updated_content_markdown"),
    )


def stream_project_documentation_generation(
    project_id: int,
    *,
    db_client: DbApiClient | None = None,
    github_client: GitHubClient | None = None,
    openai_client: Any | None = None,
) -> Iterator[str]:
    client, owned = _db_client(db_client)
    github = github_client or GitHubClient()
    try:
        documentation = start_documentation_refresh(project_id, db_client=client)
        yield _sse("status", {"message": "Queued GitHub documentation scan.", "documentation": documentation})
        if documentation["status"] != "running":
            yield _sse("done", {"documentation": documentation})
            return

        project = client.get_project(project_id)
        contexts = asyncio.run(_collect_repository_contexts(project, github))
        source_snapshot = {
            "generated_from": "github",
            "repositories": [_repository_snapshot(context) for context in contexts],
        }
        yield _sse("status", {"message": "Repository context collected. Generating Markdown."})

        content_parts: list[str] = []
        for delta in _stream_markdown(project, contexts, openai_client):
            content_parts.append(delta)
            yield _sse("content_delta", {"delta": delta})

        content_markdown = "".join(content_parts).strip()
        if not content_markdown:
            raise ValueError("LLM response did not include documentation content.")

        generated_at = datetime.now(UTC).replace(tzinfo=None).isoformat()
        saved = client.upsert_project_documentation_by_project(
            project_id,
            {
                "status": "ready",
                "content_markdown": content_markdown,
                "source_repositories": project.get("github_repositories") or [],
                "source_snapshot": source_snapshot,
                "model_metadata": {
                    "model": get_openai_model(),
                    "prompt_version": PROMPT_VERSION,
                    "streamed": True,
                },
                "last_error": None,
                "last_generated_at": generated_at,
            },
        )
        yield _sse("done", {"documentation": saved})
    except Exception as exc:
        try:
            failed = client.upsert_project_documentation_by_project(
                project_id,
                {
                    "status": "failed",
                    "last_error": str(exc),
                },
            )
        except Exception:
            failed = None
        yield _sse("error", {"message": str(exc), "documentation": failed})
    finally:
        if owned:
            client.close()


def stream_documentation_chat(
    project_id: int,
    payload: ProjectDocumentationChatRequest,
    *,
    db_client: DbApiClient | None = None,
    openai_client: Any | None = None,
) -> Iterator[str]:
    client, owned = _db_client(db_client)
    try:
        project = client.get_project(project_id)
        documentation = client.get_project_documentation_by_project(project_id)
    finally:
        if owned:
            client.close()

    if not documentation.get("content_markdown"):
        yield _sse("error", {"message": "Project documentation is not ready yet."})
        return

    try:
        if payload.mode == "edit":
            draft_parts: list[str] = []
            yield _sse("answer_delta", {"delta": "Drafting an updated Markdown version..."})
            for delta in _stream_edit_markdown(
                project=project,
                documentation=documentation,
                payload=payload,
                openai_client=openai_client,
            ):
                draft_parts.append(delta)
                yield _sse("draft_delta", {"delta": delta})
            yield _sse(
                "done",
                {
                    "answer": "Draft ready. Review it in the editor and save when it looks right.",
                    "updated_content_markdown": "".join(draft_parts).strip(),
                },
            )
            return

        answer_parts: list[str] = []
        for delta in _stream_answer(
            project=project,
            documentation=documentation,
            payload=payload,
            openai_client=openai_client,
        ):
            answer_parts.append(delta)
            yield _sse("answer_delta", {"delta": delta})
        yield _sse("done", {"answer": "".join(answer_parts).strip()})
    except Exception as exc:
        yield _sse("error", {"message": str(exc)})


def _generate_markdown(
    project: dict[str, Any],
    contexts: list[dict[str, Any]],
    openai_client: Any | None = None,
) -> str:
    system_prompt = """You are a senior engineering documentation lead.
Generate concise, accurate project documentation for a CTO workspace from GitHub repository context.
Focus on architecture, key flows, setup, operational notes, onboarding pointers, offboarding/ownership notes, and open questions.
Do not invent private facts. If the repository context is incomplete, say what should be verified.
Return JSON with exactly one key: content_markdown."""
    user_content = {
        "project": {
            "id": project["id"],
            "name": project["project_name"],
            "description": project["project_description"],
            "phase": project["project_phase"],
            "github_repositories": project.get("github_repositories", []),
        },
        "repositories": contexts,
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


async def _collect_repository_contexts(
    project: dict[str, Any],
    github: GitHubClient,
) -> list[dict[str, Any]]:
    repositories = project.get("github_repositories") or []
    if not repositories:
        raise ValueError("Project has no GitHub repositories configured.")

    contexts = []
    for repo_url in repositories:
        owner, repo = github.parse_github_url(repo_url)
        context = await github.get_repository_documentation_context(owner, repo)
        context["url"] = repo_url
        contexts.append(context)
    return contexts


def _stream_markdown(
    project: dict[str, Any],
    contexts: list[dict[str, Any]],
    openai_client: Any | None = None,
) -> Iterator[str]:
    system_prompt = """You are a senior engineering documentation lead.
Generate concise, accurate Markdown project documentation for a CTO workspace from GitHub repository context.
Focus on architecture, key flows, setup, operational notes, onboarding pointers, offboarding/ownership notes, and open questions.
Do not invent private facts. If the repository context is incomplete, say what should be verified.
Return Markdown only, with headings, lists, and code fences where useful."""
    user_content = {
        "project": {
            "id": project["id"],
            "name": project["project_name"],
            "description": project["project_description"],
            "phase": project["project_phase"],
            "github_repositories": project.get("github_repositories", []),
        },
        "repositories": contexts,
    }
    yield from _stream_completion_text(
        system_prompt=system_prompt,
        user_content=json.dumps(user_content),
        openai_client=openai_client,
    )


def _chat_with_llm(
    *,
    project: dict[str, Any],
    documentation: dict[str, Any],
    payload: ProjectDocumentationChatRequest,
    openai_client: Any | None = None,
) -> dict[str, Any]:
    system_prompt = """You answer as the CTO's documentation assistant.
Use only the stored project documentation and project metadata.
If mode is "edit", return an updated markdown draft when the user asks for a documentation change.
Return JSON with keys: answer and updated_content_markdown."""
    messages: list[dict[str, str]] = [
        {"role": "system", "content": system_prompt},
        {
            "role": "user",
            "content": json.dumps(
                {
                    "mode": payload.mode,
                    "project": {
                        "id": project["id"],
                        "name": project["project_name"],
                        "description": project["project_description"],
                        "phase": project["project_phase"],
                    },
                    "documentation_markdown": documentation["content_markdown"],
                }
            ),
        },
    ]
    for message in payload.history[-6:]:
        messages.append({"role": message.role, "content": message.content})
    messages.append({"role": "user", "content": payload.message})

    client = openai_client or get_openai_client()
    response = client.chat.completions.create(
        model=get_openai_model(),
        messages=messages,
        response_format={"type": "json_object"},
    )
    data = _load_json_response(response)
    updated_content = data.get("updated_content_markdown")
    if not isinstance(updated_content, str):
        updated_content = None
    return {
        "answer": data.get("answer") if isinstance(data.get("answer"), str) else "",
        "updated_content_markdown": updated_content,
    }


def _stream_answer(
    *,
    project: dict[str, Any],
    documentation: dict[str, Any],
    payload: ProjectDocumentationChatRequest,
    openai_client: Any | None = None,
) -> Iterator[str]:
    system_prompt = """You answer as the CTO's documentation assistant.
Use only the stored project documentation and project metadata.
Be concise, concrete, and cite relevant sections by name when helpful.
Return plain text only."""
    yield from _stream_completion_text(
        system_prompt=system_prompt,
        user_content=_chat_context(project, documentation, payload),
        history=[message.model_dump() for message in payload.history[-6:]],
        openai_client=openai_client,
    )


def _stream_edit_markdown(
    *,
    project: dict[str, Any],
    documentation: dict[str, Any],
    payload: ProjectDocumentationChatRequest,
    openai_client: Any | None = None,
) -> Iterator[str]:
    system_prompt = """You are editing project documentation for a CTO.
Apply the user's requested change to the current Markdown documentation.
Preserve useful existing content, improve structure when needed, and return the full updated Markdown document only."""
    yield from _stream_completion_text(
        system_prompt=system_prompt,
        user_content=_chat_context(project, documentation, payload),
        history=[message.model_dump() for message in payload.history[-6:]],
        openai_client=openai_client,
    )


def _chat_context(
    project: dict[str, Any],
    documentation: dict[str, Any],
    payload: ProjectDocumentationChatRequest,
) -> str:
    return json.dumps(
        {
            "mode": payload.mode,
            "user_request": payload.message,
            "project": {
                "id": project["id"],
                "name": project["project_name"],
                "description": project["project_description"],
                "phase": project["project_phase"],
            },
            "documentation_markdown": documentation["content_markdown"],
        }
    )


def _stream_completion_text(
    *,
    system_prompt: str,
    user_content: str,
    history: list[dict[str, str]] | None = None,
    openai_client: Any | None = None,
) -> Iterator[str]:
    client = openai_client or get_openai_client()
    messages: list[dict[str, str]] = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_content},
    ]
    for message in history or []:
        role = message.get("role")
        content = message.get("content")
        if role in {"user", "assistant"} and isinstance(content, str):
            messages.append({"role": role, "content": content})

    response = client.chat.completions.create(
        model=get_openai_model(),
        messages=messages,
        stream=True,
    )
    for chunk in response:
        choices = getattr(chunk, "choices", None) or []
        if not choices:
            continue
        delta = getattr(choices[0], "delta", None)
        content = getattr(delta, "content", None)
        if content:
            yield content


def _load_json_response(response: Any) -> dict[str, Any]:
    content = response.choices[0].message.content or "{}"
    data = json.loads(content)
    if not isinstance(data, dict):
        raise ValueError("LLM response was not a JSON object.")
    return data


def _repository_snapshot(context: dict[str, Any]) -> dict[str, Any]:
    return {
        "url": context.get("url"),
        "full_name": context.get("full_name"),
        "default_branch": context.get("default_branch"),
        "language": context.get("language"),
        "topics": context.get("topics") or [],
        "sampled_files": [file["path"] for file in context.get("sampled_files", [])],
        "tree_path_count": len(context.get("file_tree") or []),
    }


def _db_client(db_client: DbApiClient | None) -> tuple[DbApiClient, bool]:
    if db_client is not None:
        return db_client, False
    return DbApiClient(), True


def _sse(event: str, data: dict[str, Any]) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"
