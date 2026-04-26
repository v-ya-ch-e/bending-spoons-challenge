import asyncio
import json
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from services.transition_instruction_service import (  # noqa: E402
    generate_transition_instruction,
    start_transition_instruction_generation,
)


class FakeDbClient:
    def __init__(self) -> None:
        self.move_request = {
            "id": 7,
            "employee_id": 1,
            "employee_name": "Marco Bianchi",
            "from_project_id": 10,
            "from_project_name": "Evernote",
            "to_project_id": 20,
            "to_project_name": "Remini",
            "reason": "Backend fit.",
            "expected_role": "Backend/platform engineer",
            "current_project_impact": "low",
            "status": "transition_started",
            "cto_approval_status": "approved",
            "cto_approved_at": "2026-04-25T12:00:00",
            "employee_approval_status": "approved",
            "employee_approved_at": "2026-04-25T12:01:00",
            "created_at": "2026-04-25T11:00:00",
            "responded_at": "2026-04-25T12:01:00",
        }
        self.employee = {
            "id": 1,
            "name": "Marco Bianchi",
            "role": "Backend engineer",
            "github_username": "marco-bianchi",
            "skills": {
                "android": 0,
                "ios": 0,
                "web": 1,
                "backend": 3,
                "infrastructure": 2,
                "ai": 1,
            },
            "preferences": ["Remini"],
            "interests": ["platform reliability"],
            "current_project_ids": [10],
            "current_project_names": ["Evernote"],
            "current_project": "Evernote",
        }
        self.projects = {
            10: _project(10, "Evernote", ["https://github.com/example/evernote"]),
            20: _project(20, "Remini", ["https://github.com/example/remini"]),
        }
        self.documentation = {
            10: _documentation(100, 10, "# Evernote Docs\n\nOwns sync and storage."),
            20: _documentation(200, 20, "# Remini Docs\n\nOwns AI image workflows."),
        }
        self.instructions: list[dict] = []
        self.closed = False

    def close(self) -> None:
        self.closed = True

    def get_move_request(self, request_id: int) -> dict:
        assert request_id == self.move_request["id"]
        return self.move_request

    def get_employee(self, employee_id: int) -> dict:
        assert employee_id == self.employee["id"]
        return self.employee

    def get_project(self, project_id: int) -> dict:
        return self.projects[project_id]

    def get_project_documentation_by_project(self, project_id: int) -> dict:
        return self.documentation[project_id]

    def list_employees(self, limit: int = 100, offset: int = 0) -> list[dict]:
        return [self.employee]

    def upsert_transition_instruction_by_move_request(
        self,
        request_id: int,
        instruction_type: str,
        payload: dict,
    ) -> dict:
        instruction = {
            "id": len(self.instructions) + 1,
            "move_request_id": request_id,
            "instruction_type": instruction_type,
            "status": "pending",
            "content_markdown": "",
            "input_snapshot": None,
            "source_documentation_id": None,
            "source_documentation_updated_at": None,
            "model_metadata": None,
            "last_error": None,
            "solved_at": None,
            "solved_by_employee_id": None,
            "employee_id": self.employee["id"],
            "employee_name": self.employee["name"],
            "from_project_id": self.move_request["from_project_id"],
            "from_project_name": self.move_request["from_project_name"],
            "to_project_id": self.move_request["to_project_id"],
            "to_project_name": self.move_request["to_project_name"],
            "created_at": "2026-04-25T12:00:00",
            "updated_at": "2026-04-25T12:00:00",
        }
        instruction.update(payload)
        self.instructions.append(instruction)
        return instruction


class FakeGitHubClient:
    def __init__(self) -> None:
        self.calls: list[tuple[str, str, str]] = []

    @staticmethod
    def parse_github_url(url: str) -> tuple[str, str]:
        parts = url.rstrip("/").split("/")
        return parts[-2], parts[-1]

    async def get_user_commit_context(self, owner: str, repo: str, username: str) -> dict:
        self.calls.append((owner, repo, username))
        return {
            "repository": f"{owner}/{repo}",
            "author": username,
            "commits": [
                {
                    "sha": "abc123",
                    "message": "Improve sync worker",
                    "files": [{"filename": "sync.py", "status": "modified"}],
                }
            ],
        }


class FakeOpenAIClient:
    def __init__(self) -> None:
        self.messages: list[dict] = []
        self.chat = SimpleNamespace(
            completions=SimpleNamespace(create=self._create_completion)
        )

    def _create_completion(self, **kwargs):
        self.messages = kwargs["messages"]
        return SimpleNamespace(
            choices=[
                SimpleNamespace(
                    message=SimpleNamespace(
                        content=json.dumps(
                            {"content_markdown": "# Transition\n\n- Follow the handoff."}
                        )
                    )
                )
            ]
        )


def _project(project_id: int, name: str, repositories: list[str]) -> dict:
    return {
        "id": project_id,
        "project_name": name,
        "project_description": f"{name} project.",
        "project_phase": "growth",
        "required_people_amount": 2,
        "required_skills": {
            "android": {"level_1": 0, "level_2": 0, "level_3": 0},
            "ios": {"level_1": 0, "level_2": 0, "level_3": 0},
            "web": {"level_1": 0, "level_2": 1, "level_3": 0},
            "backend": {"level_1": 0, "level_2": 0, "level_3": 1},
            "infrastructure": {"level_1": 0, "level_2": 1, "level_3": 0},
            "ai": {"level_1": 0, "level_2": 0, "level_3": 0},
        },
        "github_repositories": repositories,
        "current_team_member_ids": [1],
        "current_team_members": ["Marco Bianchi"],
    }


def _documentation(documentation_id: int, project_id: int, markdown: str) -> dict:
    return {
        "id": documentation_id,
        "project_id": project_id,
        "project_name": "Project",
        "status": "ready",
        "content_markdown": markdown,
        "source_repositories": [],
        "source_snapshot": None,
        "model_metadata": None,
        "last_error": None,
        "last_generated_at": "2026-04-25T12:00:00",
        "created_at": "2026-04-25T11:00:00",
        "updated_at": "2026-04-25T12:00:00",
    }


def test_start_generation_requires_approved_move_request() -> None:
    db = FakeDbClient()
    db.move_request["status"] = "pending"
    db.move_request["cto_approval_status"] = "pending"

    with pytest.raises(ValueError, match="approved"):
        start_transition_instruction_generation(7, "onboarding", db_client=db)


def test_start_generation_rejects_completed_move_request() -> None:
    db = FakeDbClient()
    db.move_request["status"] = "completed"

    with pytest.raises(ValueError, match="transition started"):
        start_transition_instruction_generation(7, "onboarding", db_client=db)


def test_start_generation_skips_offboarding_for_bench_move() -> None:
    db = FakeDbClient()
    db.move_request["from_project_id"] = None
    db.move_request["from_project_name"] = None
    db.employee["current_project_ids"] = []
    db.employee["current_project_names"] = []

    with pytest.raises(ValueError, match="Bench-to-project"):
        start_transition_instruction_generation(7, "offboarding", db_client=db)

    result = start_transition_instruction_generation(7, "onboarding", db_client=db)
    assert result["status"] == "running"
    assert result["source_documentation_id"] == 200


def test_start_generation_supports_offboarding_only_move() -> None:
    db = FakeDbClient()
    db.move_request["to_project_id"] = None
    db.move_request["to_project_name"] = None

    with pytest.raises(ValueError, match="Offboarding-only"):
        start_transition_instruction_generation(7, "onboarding", db_client=db)

    result = start_transition_instruction_generation(7, "offboarding", db_client=db)
    assert result["status"] == "running"
    assert result["source_documentation_id"] == 100
    assert result["input_snapshot"]["target_project_id"] is None


def test_start_generation_stores_running_instruction_with_documentation_source() -> None:
    db = FakeDbClient()

    result = start_transition_instruction_generation(7, "onboarding", db_client=db)

    assert result["status"] == "running"
    assert result["source_documentation_id"] == 200
    assert result["input_snapshot"]["target_project_id"] == 20


def test_generate_onboarding_uses_target_docs_without_commit_context() -> None:
    db = FakeDbClient()
    github = FakeGitHubClient()
    openai = FakeOpenAIClient()

    result = asyncio.run(
        generate_transition_instruction(
            7,
            "onboarding",
            db_client=db,
            github_client=github,
            openai_client=openai,
        )
    )

    assert result["status"] == "ready"
    assert result["content_markdown"].startswith("# Transition")
    assert result["source_documentation_id"] == 200
    assert github.calls == []
    prompt_payload = json.loads(openai.messages[1]["content"])
    assert prompt_payload["context_project"]["name"] == "Remini"
    assert prompt_payload["commit_context"] == []


def test_generate_offboarding_includes_source_docs_and_commit_context() -> None:
    db = FakeDbClient()
    github = FakeGitHubClient()
    openai = FakeOpenAIClient()

    result = asyncio.run(
        generate_transition_instruction(
            7,
            "offboarding",
            db_client=db,
            github_client=github,
            openai_client=openai,
        )
    )

    assert result["status"] == "ready"
    assert result["source_documentation_id"] == 100
    assert result["input_snapshot"]["commit_repositories"][0]["commit_count"] == 1
    assert github.calls == [("example", "evernote", "marco-bianchi")]
    prompt_payload = json.loads(openai.messages[1]["content"])
    assert prompt_payload["context_project"]["name"] == "Evernote"
    assert prompt_payload["commit_context"][0]["commits"][0]["message"] == "Improve sync worker"


def test_generate_offboarding_only_has_no_target_project_context() -> None:
    db = FakeDbClient()
    db.move_request["to_project_id"] = None
    db.move_request["to_project_name"] = None
    github = FakeGitHubClient()
    openai = FakeOpenAIClient()

    result = asyncio.run(
        generate_transition_instruction(
            7,
            "offboarding",
            db_client=db,
            github_client=github,
            openai_client=openai,
        )
    )

    assert result["status"] == "ready"
    assert result["source_documentation_id"] == 100
    prompt_payload = json.loads(openai.messages[1]["content"])
    assert prompt_payload["target_project"] is None


def test_generate_offboarding_skips_commit_context_for_mock_documentation() -> None:
    db = FakeDbClient()
    db.documentation[10]["source_snapshot"] = {"generated_from": "mock"}
    db.documentation[10]["model_metadata"] = {"source": "mock_documentation_seed"}
    github = FakeGitHubClient()
    openai = FakeOpenAIClient()

    result = asyncio.run(
        generate_transition_instruction(
            7,
            "offboarding",
            db_client=db,
            github_client=github,
            openai_client=openai,
        )
    )

    assert result["status"] == "ready"
    assert result["input_snapshot"]["commit_repositories"] == []
    assert github.calls == []
    prompt_payload = json.loads(openai.messages[1]["content"])
    assert prompt_payload["commit_context"] == []


def test_generate_marks_instruction_failed_when_documentation_is_not_ready() -> None:
    db = FakeDbClient()
    db.documentation[20]["status"] = "running"

    result = asyncio.run(
        generate_transition_instruction(
            7,
            "onboarding",
            db_client=db,
            github_client=FakeGitHubClient(),
            openai_client=FakeOpenAIClient(),
        )
    )

    assert result["status"] == "failed"
    assert "not ready" in result["last_error"]
