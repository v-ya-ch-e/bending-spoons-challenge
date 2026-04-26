import asyncio
import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from schemas import ProjectDocumentationChatRequest
from services import project_documentation_service


class FakeDbClient:
    def __init__(self) -> None:
        self.project = {
            "id": 1,
            "project_name": "Atlas Staffing",
            "project_description": "Internal staffing platform.",
            "project_phase": "growth",
            "github_repositories": ["https://github.com/example/atlas"],
        }
        self.documentation = {
            "id": 1,
            "project_id": 1,
            "project_name": "Atlas Staffing",
            "status": "pending",
            "content_markdown": "",
            "source_repositories": [],
            "source_snapshot": None,
            "model_metadata": None,
            "last_error": None,
            "last_generated_at": None,
            "created_at": "2026-04-26T00:00:00",
            "updated_at": "2026-04-26T00:00:00",
        }
        self.closed = False

    def close(self) -> None:
        self.closed = True

    def get_project(self, project_id: int) -> dict:
        if project_id != self.project["id"]:
            raise AssertionError("Unexpected project id")
        return self.project

    def get_project_documentation_by_project(self, project_id: int) -> dict:
        if project_id != self.project["id"]:
            raise AssertionError("Unexpected project id")
        return self.documentation

    def upsert_project_documentation_by_project(self, project_id: int, payload: dict) -> dict:
        if project_id != self.project["id"]:
            raise AssertionError("Unexpected project id")
        self.documentation.update(payload)
        return self.documentation


class FakeGitHubClient:
    @staticmethod
    def parse_github_url(url: str) -> tuple[str, str]:
        return "example", "atlas"

    async def get_repository_documentation_context(self, owner: str, repo: str) -> dict:
        return {
            "owner": owner,
            "name": repo,
            "full_name": f"{owner}/{repo}",
            "default_branch": "main",
            "language": "Python",
            "topics": ["staffing"],
            "readme": "# Atlas",
            "file_tree": ["README.md", "main.py"],
            "sampled_files": [{"path": "main.py", "content": "print('hello')"}],
        }


class FakeCompletions:
    def __init__(self, payload: dict) -> None:
        self.payload = payload

    def create(self, **_kwargs):
        if _kwargs.get("stream"):
            text = self.payload.get("content_markdown") or self.payload.get("answer") or ""
            delta = type("Delta", (), {"content": text})
            choice = type("Choice", (), {"delta": delta})
            return [type("Chunk", (), {"choices": [choice]})]
        message = type("Message", (), {"content": json.dumps(self.payload)})
        choice = type("Choice", (), {"message": message})
        return type("Response", (), {"choices": [choice]})


class FakeOpenAIClient:
    def __init__(self, payload: dict) -> None:
        completions = FakeCompletions(payload)
        self.chat = type("Chat", (), {"completions": completions})


class ProjectDocumentationServiceTest(unittest.TestCase):
    def test_start_refresh_marks_documentation_running(self) -> None:
        db_client = FakeDbClient()

        documentation = project_documentation_service.start_documentation_refresh(
            1,
            db_client=db_client,
        )

        self.assertEqual(documentation["status"], "running")
        self.assertEqual(
            documentation["source_repositories"],
            ["https://github.com/example/atlas"],
        )
        self.assertIsNone(documentation["last_error"])
        self.assertFalse(db_client.closed)

    def test_generate_project_documentation_writes_ready_markdown(self) -> None:
        async def run_test() -> None:
            db_client = FakeDbClient()
            openai_client = FakeOpenAIClient(
                {"content_markdown": "# Atlas Staffing\n\nGenerated docs."}
            )

            documentation = await project_documentation_service.generate_project_documentation(
                1,
                db_client=db_client,
                github_client=FakeGitHubClient(),
                openai_client=openai_client,
            )

            self.assertEqual(documentation["status"], "ready")
            self.assertIn("Generated docs", documentation["content_markdown"])
            self.assertEqual(
                documentation["source_snapshot"]["repositories"][0]["full_name"],
                "example/atlas",
            )
            self.assertIsNone(documentation["last_error"])

        asyncio.run(run_test())

    def test_chat_returns_answer_and_optional_updated_markdown(self) -> None:
        db_client = FakeDbClient()
        db_client.documentation["content_markdown"] = "# Atlas Staffing\n\nExisting docs."
        openai_client = FakeOpenAIClient(
            {
                "answer": "Use the API section for onboarding.",
                "updated_content_markdown": "# Atlas Staffing\n\nUpdated docs.",
            }
        )

        response = project_documentation_service.chat_with_documentation(
            1,
            ProjectDocumentationChatRequest(message="Add onboarding notes", mode="edit"),
            db_client=db_client,
            openai_client=openai_client,
        )

        self.assertEqual(response.answer, "Use the API section for onboarding.")
        self.assertIn("Updated docs", response.updated_content_markdown)

    def test_stream_project_documentation_emits_content_and_done(self) -> None:
        db_client = FakeDbClient()
        openai_client = FakeOpenAIClient(
            {"content_markdown": "# Atlas Staffing\n\nGenerated docs."}
        )

        events = list(
            project_documentation_service.stream_project_documentation_generation(
                1,
                db_client=db_client,
                github_client=FakeGitHubClient(),
                openai_client=openai_client,
            )
        )

        self.assertTrue(any("event: content_delta" in event for event in events))
        self.assertTrue(any("event: done" in event for event in events))
        self.assertEqual(db_client.documentation["status"], "ready")

    def test_stream_chat_emits_answer_delta(self) -> None:
        db_client = FakeDbClient()
        db_client.documentation["content_markdown"] = "# Atlas Staffing\n\nExisting docs."
        openai_client = FakeOpenAIClient({"answer": "Read the setup section first."})

        events = list(
            project_documentation_service.stream_documentation_chat(
                1,
                ProjectDocumentationChatRequest(message="Where do I start?"),
                db_client=db_client,
                openai_client=openai_client,
            )
        )

        self.assertTrue(any("event: answer_delta" in event for event in events))
        self.assertTrue(any("Read the setup section first." in event for event in events))


if __name__ == "__main__":
    unittest.main()
