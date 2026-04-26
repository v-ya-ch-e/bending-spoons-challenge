import asyncio
import os
from pathlib import Path
from typing import Any, Literal

from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from clients import DbApiClient, DbApiError
from schemas import (
    MatchingRunRequest,
    MatchingRunResponse,
    ProjectDocumentationChatRequest,
    ProjectDocumentationChatResponse,
    ProjectDocumentationResponse,
    SkillProfileRequest,
    SkillProfileResponse,
    TransitionInstructionResponse,
)
from services import (
    matching_service,
    project_documentation_service,
    skill_profile_service,
    transition_instruction_service,
)
from services.matching_llm_service import MatchingLlmError


load_dotenv(Path(__file__).resolve().parent.parent / ".env")

ROOT_PATH = os.environ["BACKEND_ROOT_PATH"]
LOCAL_CORS_ORIGIN_REGEX = os.getenv(
    "BACKEND_CORS_ALLOW_ORIGIN_REGEX",
    r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
)

app = FastAPI(
    title="Bending Spoons Challenge Backend API",
    root_path=ROOT_PATH,
)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=LOCAL_CORS_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class MoveRequestApprovalRequest(BaseModel):
    approver: Literal["cto", "employee"]
    approval_status: Literal["pending", "approved", "rejected"]


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/skill-profile", response_model=SkillProfileResponse)
async def suggest_skill_profile(payload: SkillProfileRequest) -> SkillProfileResponse:
    return await skill_profile_service.suggest_skill_profile(payload)


@app.post("/projects/{project_id}/documentation:refresh", response_model=ProjectDocumentationResponse)
async def refresh_project_documentation(
    project_id: int,
    background_tasks: BackgroundTasks,
) -> dict:
    try:
        documentation = await asyncio.to_thread(
            project_documentation_service.start_documentation_refresh,
            project_id,
        )
        if documentation["status"] == "running":
            background_tasks.add_task(
                project_documentation_service.generate_project_documentation,
                project_id,
            )
        return documentation
    except DbApiError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/projects/{project_id}/documentation:refresh-stream")
def stream_project_documentation_refresh(project_id: int) -> StreamingResponse:
    return StreamingResponse(
        project_documentation_service.stream_project_documentation_generation(project_id),
        media_type="text/event-stream",
    )


@app.post(
    "/projects/{project_id}/documentation:chat",
    response_model=ProjectDocumentationChatResponse,
)
async def chat_with_project_documentation(
    project_id: int,
    payload: ProjectDocumentationChatRequest,
) -> ProjectDocumentationChatResponse:
    try:
        return await asyncio.to_thread(
            project_documentation_service.chat_with_documentation,
            project_id,
            payload,
        )
    except DbApiError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/projects/{project_id}/documentation:chat-stream")
def stream_project_documentation_chat(
    project_id: int,
    payload: ProjectDocumentationChatRequest,
) -> StreamingResponse:
    return StreamingResponse(
        project_documentation_service.stream_documentation_chat(project_id, payload),
        media_type="text/event-stream",
    )


@app.post(
    "/move-requests/{request_id}/instructions/{instruction_type}:generate",
    response_model=TransitionInstructionResponse,
)
async def generate_move_request_transition_instruction(
    request_id: int,
    instruction_type: str,
    background_tasks: BackgroundTasks,
) -> dict:
    try:
        instruction = await asyncio.to_thread(
            transition_instruction_service.start_transition_instruction_generation,
            request_id,
            instruction_type,
        )
        if instruction["status"] == "running":
            background_tasks.add_task(
                transition_instruction_service.generate_transition_instruction,
                request_id,
                instruction_type,
            )
        return instruction
    except DbApiError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/move-requests/{request_id}/approval")
async def approve_move_request(
    request_id: int,
    payload: MoveRequestApprovalRequest,
    background_tasks: BackgroundTasks,
) -> dict[str, Any]:
    try:
        move_request, running_instruction_types = await asyncio.to_thread(
            _approve_move_request_and_start_transition,
            request_id,
            payload.model_dump(),
        )
        for instruction_type in running_instruction_types:
            background_tasks.add_task(
                transition_instruction_service.generate_transition_instruction,
                request_id,
                instruction_type,
            )
        return move_request
    except DbApiError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


def _approve_move_request_and_start_transition(
    request_id: int,
    payload: dict[str, str],
) -> tuple[dict[str, Any], list[str]]:
    client = DbApiClient()
    try:
        move_request = client.update_move_request_approval(request_id, payload)
        running_instruction_types: list[str] = []
        if _move_request_transition_started(move_request):
            for instruction_type in _instruction_types_for_move_request(move_request):
                try:
                    instruction = transition_instruction_service.start_transition_instruction_generation(
                        request_id,
                        instruction_type,
                        db_client=client,
                    )
                except Exception as exc:
                    client.upsert_transition_instruction_by_move_request(
                        request_id,
                        instruction_type,
                        {
                            "status": "failed",
                            "content_markdown": "",
                            "last_error": str(exc),
                        },
                    )
                    continue
                if instruction.get("status") == "running":
                    running_instruction_types.append(instruction_type)
        return move_request, running_instruction_types
    finally:
        client.close()


def _move_request_transition_started(move_request: dict[str, Any]) -> bool:
    return (
        move_request.get("status") == "transition_started"
        and move_request.get("cto_approval_status") == "approved"
        and move_request.get("employee_approval_status") == "approved"
    )


def _instruction_types_for_move_request(move_request: dict[str, Any]) -> tuple[str, ...]:
    if move_request.get("from_project_id") is None:
        return ("onboarding",)
    return ("onboarding", "offboarding")


@app.post("/projects/{project_id}/matching:run", response_model=MatchingRunResponse)
async def run_project_matching(
    project_id: int,
    payload: MatchingRunRequest | None = None,
) -> MatchingRunResponse:
    try:
        return await asyncio.to_thread(
            matching_service.run_matching,
            use_case="project_rebalance",
            target_project_id=project_id,
            request=payload or MatchingRunRequest(),
        )
    except DbApiError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except MatchingLlmError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.post("/matching/portfolio:rebalance", response_model=MatchingRunResponse)
async def run_portfolio_rebalance(
    payload: MatchingRunRequest | None = None,
) -> MatchingRunResponse:
    try:
        return await asyncio.to_thread(
            matching_service.run_matching,
            use_case="portfolio_rebalance",
            target_project_id=None,
            request=payload or MatchingRunRequest(),
        )
    except DbApiError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except MatchingLlmError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
