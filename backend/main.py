import asyncio
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.responses import StreamingResponse

from clients import DbApiError
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

app = FastAPI(
    title="Bending Spoons Challenge Backend API",
    root_path=ROOT_PATH,
)


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
