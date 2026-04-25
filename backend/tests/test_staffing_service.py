import asyncio
import os
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from schemas import SkillProfileRequest, SkillProfileResponse
from services.skill_profile_service import suggest_skill_profile

ALLOWED_SKILL_KEYS = {"android", "ios", "web", "backend", "infrastructure", "ai"}


class TestSkillProfileService(unittest.TestCase):
    def test_suggest_skill_profile_returns_real_answer(self):
        if not os.getenv("OPENAI_API_KEY"):
            self.skipTest("OPENAI_API_KEY is required for the live skill-profile test")

        async def run_test():
            payload = SkillProfileRequest(
                project_id=1,
                github_page="https://github.com/fastapi/fastapi",
                project_description=(
                    "Extend a production Python API framework with better "
                    "documentation, CI, and deployment workflows."
                ),
            )

            result = await suggest_skill_profile(payload)
            print("\nSkill profile:", flush=True)
            print(result.model_dump_json(indent=2), flush=True)

            self.assertIsInstance(result, SkillProfileResponse)
            self.assertGreater(result.required_people_amount, 0)
            self.assertEqual(
                result.required_people_amount,
                len(result.required_skills_per_person),
            )

            suggested_categories = set()
            for skills in result.required_skills_per_person:
                for key, level in skills.model_dump().items():
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
