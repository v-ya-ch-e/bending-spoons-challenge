"""HTTP client for the db-rest-api service.

Mirrors the contract documented in ``docs/DB_API_DOCUMENTATION.md``. All payloads
are passed as plain dicts that match the documented JSON shape; callers (or
backend Pydantic models) are responsible for higher-level validation.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import httpx
from dotenv import load_dotenv


load_dotenv(Path(__file__).resolve().parents[2] / ".env")


def get_db_api_base_url() -> str:
    return os.environ["DB_API_BASE_URL"].rstrip("/")


class DbApiError(Exception):
    """Raised for any non-2xx response from the DB REST API."""

    def __init__(self, status_code: int, detail: Any):
        super().__init__(f"DB API {status_code}: {detail}")
        self.status_code = status_code
        self.detail = detail


class DbApiClient:
    def __init__(self, base_url: str | None = None, timeout: float = 30.0):
        self.base_url = (base_url or get_db_api_base_url()).rstrip("/")
        self._client = httpx.Client(base_url=self.base_url, timeout=timeout)

    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> "DbApiClient":
        return self

    def __exit__(self, *_exc: Any) -> None:
        self.close()

    def _request(self, method: str, path: str, **kwargs: Any) -> Any:
        resp = self._client.request(method, path, **kwargs)
        if resp.status_code == 204:
            return None
        if resp.status_code >= 400:
            try:
                detail = resp.json().get("detail", resp.text)
            except Exception:
                detail = resp.text
            raise DbApiError(resp.status_code, detail)
        return resp.json()

    # ---- service metadata ------------------------------------------------

    def health(self) -> dict:
        return self._request("GET", "/health")

    def health_db(self) -> dict:
        return self._request("GET", "/health/db")

    def version(self) -> dict:
        return self._request("GET", "/version")

    # ---- projects --------------------------------------------------------

    def list_projects(self, limit: int = 100, offset: int = 0) -> list[dict]:
        return self._request(
            "GET", "/projects", params={"limit": limit, "offset": offset}
        )

    def get_project(self, project_id: int) -> dict:
        return self._request("GET", f"/projects/{project_id}")

    def create_project(self, payload: dict) -> dict:
        return self._request("POST", "/projects", json=payload)

    def update_project(self, project_id: int, payload: dict) -> dict:
        return self._request("PUT", f"/projects/{project_id}", json=payload)

    def delete_project(self, project_id: int) -> None:
        self._request("DELETE", f"/projects/{project_id}")

    # ---- employees -------------------------------------------------------

    def list_employees(self, limit: int = 100, offset: int = 0) -> list[dict]:
        return self._request(
            "GET", "/employees", params={"limit": limit, "offset": offset}
        )

    def get_employee(self, employee_id: int) -> dict:
        return self._request("GET", f"/employees/{employee_id}")

    def create_employee(self, payload: dict) -> dict:
        return self._request("POST", "/employees", json=payload)

    def update_employee(self, employee_id: int, payload: dict) -> dict:
        return self._request("PUT", f"/employees/{employee_id}", json=payload)

    def delete_employee(self, employee_id: int) -> None:
        self._request("DELETE", f"/employees/{employee_id}")

    # ---- move requests ---------------------------------------------------

    def list_move_requests(self, limit: int = 100, offset: int = 0) -> list[dict]:
        return self._request(
            "GET", "/move-requests", params={"limit": limit, "offset": offset}
        )

    def get_move_request(self, request_id: int) -> dict:
        return self._request("GET", f"/move-requests/{request_id}")

    def create_move_request(self, payload: dict) -> dict:
        return self._request("POST", "/move-requests", json=payload)

    def update_move_request(self, request_id: int, payload: dict) -> dict:
        return self._request("PUT", f"/move-requests/{request_id}", json=payload)

    def delete_move_request(self, request_id: int) -> None:
        self._request("DELETE", f"/move-requests/{request_id}")
