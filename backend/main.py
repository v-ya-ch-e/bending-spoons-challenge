import asyncio
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from clients import DbApiError
from schemas import (
    MatchingRunRequest,
    MatchingRunResponse,
    SkillProfileRequest,
    SkillProfileResponse,
)
from services import matching_service, skill_profile_service
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


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/skill-profile", response_model=SkillProfileResponse)
async def suggest_skill_profile(payload: SkillProfileRequest) -> SkillProfileResponse:
    return await skill_profile_service.suggest_skill_profile(payload)


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
