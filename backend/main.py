import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
import httpx

from schemas import (
    MatchingResult,
    MatchRequest,
    Project,
    ProjectCreate,
    ProjectUpdate,
    SkillProfile,
    SkillProfileSuggestRequest,
    StaffingSuggestion,
)
from services import matching_service, skill_profile_service


load_dotenv(Path(__file__).resolve().parent.parent / ".env")

ROOT_PATH = os.environ["BACKEND_ROOT_PATH"]

app = FastAPI(
    title="Bending Spoons Challenge Backend API",
    root_path=ROOT_PATH,
)


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/projects", response_model=Project)
def create_project(payload: ProjectCreate) -> Project:
    raise HTTPException(status_code=501, detail="Project creation is not implemented yet")


@app.get("/projects/{project_id}", response_model=Project)
def get_project(project_id: int) -> Project:
    raise HTTPException(status_code=501, detail="Project lookup is not implemented yet")


@app.put("/projects/{project_id}", response_model=Project)
def update_project(project_id: int, payload: ProjectUpdate) -> Project:
    raise HTTPException(status_code=501, detail="Project update is not implemented yet")


async def run_skill_profile_suggestion(
    project_id: int, payload: SkillProfileSuggestRequest
) -> StaffingSuggestion:
    try:
        return await skill_profile_service.suggest_skill_profile(project_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=exc.response.status_code,
            detail="GitHub repository lookup failed",
        ) from exc
    except NotImplementedError as exc:
        raise HTTPException(status_code=501, detail=str(exc)) from exc


@app.post("/skill-profile:suggest", response_model=StaffingSuggestion)
async def suggest_skill_profile_without_project(
    payload: SkillProfileSuggestRequest,
) -> StaffingSuggestion:
    return await run_skill_profile_suggestion(project_id=0, payload=payload)


@app.post("/projects/{project_id}/skill-profile:suggest", response_model=StaffingSuggestion)
async def suggest_skill_profile(
    project_id: int, payload: SkillProfileSuggestRequest
) -> StaffingSuggestion:
    return await run_skill_profile_suggestion(project_id, payload)


@app.put("/projects/{project_id}/skill-profile", response_model=SkillProfile)
def save_skill_profile(project_id: int, payload: SkillProfile) -> SkillProfile:
    try:
        return skill_profile_service.save_skill_profile(project_id, payload)
    except NotImplementedError as exc:
        raise HTTPException(status_code=501, detail=str(exc)) from exc


@app.post("/projects/{project_id}/matching:run", response_model=MatchingResult)
def run_matching(project_id: int, payload: MatchRequest) -> MatchingResult:
    try:
        return matching_service.run_matching(project_id, payload)
    except NotImplementedError as exc:
        raise HTTPException(status_code=501, detail=str(exc)) from exc


@app.get("/projects/{project_id}/matching/latest", response_model=MatchingResult)
def get_latest_matching_result(project_id: int) -> MatchingResult:
    try:
        return matching_service.get_latest_matching_result(project_id)
    except NotImplementedError as exc:
        raise HTTPException(status_code=501, detail=str(exc)) from exc
