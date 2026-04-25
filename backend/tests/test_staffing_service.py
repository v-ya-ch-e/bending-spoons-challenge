import unittest
import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from schemas import ProjectPhase, SkillProfileSuggestRequest, StaffingSuggestion
from services.skill_profile_service import suggest_skill_profile

ALLOWED_SKILL_KEYS = {"android", "ios", "web", "backend", "infrastructure", "ai"}

class TestStaffingService(unittest.TestCase):
    def test_suggest_skill_profile_returns_real_staffing_answer(self):
        """Verify the service returns a real suggestion for a public GitHub repo."""
        if not os.getenv("OPENAI_API_KEY"):
            self.skipTest("OPENAI_API_KEY is required for the live staffing test")

        async def run_test():
            payload = SkillProfileSuggestRequest(
                github_repo_urls=[
                    "https://github.com/fastapi/fastapi",
                    "https://github.com/pydantic/pydantic",
                ],
                project_phase=ProjectPhase.GROWTH,
                task_description=(
                    "Extend a production Python API framework with better "
                    "documentation, CI, and deployment workflows."
                ),
            )

            result = await suggest_skill_profile(project_id=1, payload=payload)
            print("\nStaffing suggestion:", flush=True)
            print(result.model_dump_json(indent=2), flush=True)

            self.assertIsInstance(result, StaffingSuggestion)
            self.assertGreater(result.total_headcount, 0)
            self.assertGreater(len(result.roles), 0)
            self.assertTrue(result.summary.strip())

            counted_headcount = sum(role.count for role in result.roles)
            self.assertEqual(result.total_headcount, counted_headcount)

            suggested_categories = set()
            for role in result.roles:
                self.assertTrue(role.role_name.strip())
                self.assertGreaterEqual(role.count, 1)
                self.assertTrue(role.reasoning.strip())
                self.assertTrue(role.required_skills)

                for key, level in role.required_skills.model_dump().items():
                    self.assertIn(key, ALLOWED_SKILL_KEYS)
                    self.assertIn(level, {0, 1, 2, 3})
                    if level > 0:
                        suggested_categories.add(key)

            self.assertTrue(
                {"backend", "infrastructure", "web"} & suggested_categories,
                f"Expected repo-relevant skills, got {suggested_categories}",
            )

        asyncio.run(run_test())

if __name__ == "__main__":
    unittest.main()
