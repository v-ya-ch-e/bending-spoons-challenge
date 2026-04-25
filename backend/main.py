import os

from dotenv import load_dotenv
from fastapi import FastAPI


load_dotenv()

APP_VERSION = os.getenv("APP_VERSION", "0.1.0")
ROOT_PATH = os.getenv("ROOT_PATH", "/api")

app = FastAPI(
    title="Bending Spoons Challenge Backend API",
    version=APP_VERSION,
    root_path=ROOT_PATH,
)


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}
