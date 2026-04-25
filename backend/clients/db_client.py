import os
from pathlib import Path

from dotenv import load_dotenv


load_dotenv(Path(__file__).resolve().parents[2] / ".env")


def get_db_api_base_url() -> str:
    return os.environ["DB_API_BASE_URL"].rstrip("/")
