import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI

from schemas import SkillProfileRequest, SkillProfileResponse
from services import skill_profile_service


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
