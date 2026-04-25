"""Integration tests for clients.db_client.DbApiClient.

Hits a live db-rest-api instance pointed to by ``DB_API_BASE_URL`` (defaults
loaded from the repo-root .env). All write tests use unique, prefixed names
and clean up after themselves so they are safe to run against the dev
environment.

Run with:
    uv run python -m unittest discover -s tests -p "test_db_client.py"
"""

from __future__ import annotations

import os
import sys
import unittest
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import httpx

from clients.db_client import DbApiClient, DbApiError, get_db_api_base_url


SKILL_ZERO = {
    "android": 0,
    "ios": 0,
    "web": 0,
    "backend": 0,
    "infrastructure": 0,
    "ai": 0,
}


def _unique(label: str) -> str:
    return f"bsc-test-{label}-{uuid.uuid4().hex[:8]}"


def _api_reachable() -> bool:
    try:
        base = get_db_api_base_url()
    except KeyError:
        return False
    try:
        r = httpx.get(f"{base}/health", timeout=5.0)
        return r.status_code == 200
    except httpx.HTTPError:
        return False


def _matching_api_reachable() -> bool:
    try:
        base = get_db_api_base_url()
    except KeyError:
        return False
    try:
        r = httpx.get(f"{base}/openapi.json", timeout=5.0)
        return r.status_code == 200 and "/matching-runs" in r.json().get("paths", {})
    except (httpx.HTTPError, ValueError):
        return False


@unittest.skipUnless(_api_reachable(), "DB API not reachable at DB_API_BASE_URL")
class TestDbApiClientMetadata(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.client = DbApiClient()

    @classmethod
    def tearDownClass(cls) -> None:
        cls.client.close()

    def test_health(self):
        self.assertEqual(self.client.health(), {"status": "ok"})

    def test_health_db(self):
        self.assertEqual(self.client.health_db(), {"status": "ok"})

    def test_version(self):
        v = self.client.version()
        self.assertIn("version", v)


@unittest.skipUnless(_api_reachable(), "DB API not reachable at DB_API_BASE_URL")
class TestDbApiClientProjects(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.client = DbApiClient()
        cls.created_ids: list[int] = []

    @classmethod
    def tearDownClass(cls) -> None:
        for pid in cls.created_ids:
            try:
                cls.client.delete_project(pid)
            except DbApiError:
                pass
        cls.client.close()

    def _make_payload(self, name: str | None = None) -> dict:
        return {
            "project_name": name or _unique("proj"),
            "project_description": "Created by db_client integration tests.",
            "project_phase": "growth",
            "icon_url": "https://example.com/icon.png",
            "poster_url": "https://example.com/poster.png",
            "current_team_member_ids": [],
            "required_people_amount": 2,
            "required_skills": {**SKILL_ZERO, "backend": 2, "web": 1},
            "github_repositories": ["https://github.com/example/repo"],
        }

    def test_list_pagination(self):
        result = self.client.list_projects(limit=5, offset=0)
        self.assertIsInstance(result, list)
        self.assertLessEqual(len(result), 5)

    def test_full_crud_cycle(self):
        payload = self._make_payload()
        created = self.client.create_project(payload)
        self.created_ids.append(created["id"])

        self.assertEqual(created["project_name"], payload["project_name"])
        self.assertEqual(created["project_phase"], "growth")
        self.assertEqual(created["required_skills"]["backend"], 2)
        self.assertEqual(created["icon_url"], payload["icon_url"])
        self.assertEqual(created["poster_url"], payload["poster_url"])
        self.assertEqual(created["current_team_member_ids"], [])
        self.assertEqual(created["current_team_members"], [])

        fetched = self.client.get_project(created["id"])
        self.assertEqual(fetched, created)

        updated = self.client.update_project(
            created["id"],
            {"project_phase": "maintenance", "required_people_amount": 1},
        )
        self.assertEqual(updated["project_phase"], "maintenance")
        self.assertEqual(updated["required_people_amount"], 1)
        self.assertEqual(updated["project_name"], payload["project_name"])

        self.client.delete_project(created["id"])
        self.created_ids.remove(created["id"])

        with self.assertRaises(DbApiError) as ctx:
            self.client.get_project(created["id"])
        self.assertEqual(ctx.exception.status_code, 404)

    def test_duplicate_name_returns_409(self):
        payload = self._make_payload()
        created = self.client.create_project(payload)
        self.created_ids.append(created["id"])

        with self.assertRaises(DbApiError) as ctx:
            self.client.create_project(payload)
        self.assertEqual(ctx.exception.status_code, 409)

    def test_empty_update_rejected(self):
        payload = self._make_payload()
        created = self.client.create_project(payload)
        self.created_ids.append(created["id"])

        with self.assertRaises(DbApiError) as ctx:
            self.client.update_project(created["id"], {})
        self.assertIn(ctx.exception.status_code, {400, 422})

    def test_delete_missing_returns_404(self):
        with self.assertRaises(DbApiError) as ctx:
            self.client.delete_project(2_000_000_000)
        self.assertEqual(ctx.exception.status_code, 404)


@unittest.skipUnless(_api_reachable(), "DB API not reachable at DB_API_BASE_URL")
class TestDbApiClientEmployees(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.client = DbApiClient()
        cls.created_ids: list[int] = []

    @classmethod
    def tearDownClass(cls) -> None:
        for eid in cls.created_ids:
            try:
                cls.client.delete_employee(eid)
            except DbApiError:
                pass
        cls.client.close()

    def _make_payload(self, name: str | None = None) -> dict:
        return {
            "name": name or _unique("emp"),
            "role": "Backend engineer",
            "current_project_ids": [],
            "skills": {**SKILL_ZERO, "backend": 3, "infrastructure": 2},
            "preferences": [],
            "interests": ["platform reliability"],
        }

    def test_list_pagination(self):
        result = self.client.list_employees(limit=5)
        self.assertIsInstance(result, list)
        self.assertLessEqual(len(result), 5)

    def test_full_crud_cycle(self):
        payload = self._make_payload()
        created = self.client.create_employee(payload)
        self.created_ids.append(created["id"])

        self.assertEqual(created["name"], payload["name"])
        self.assertEqual(created["skills"]["backend"], 3)
        self.assertEqual(created["current_project_ids"], [])
        self.assertEqual(created["current_project_names"], [])
        self.assertIsNone(created["current_project"])

        fetched = self.client.get_employee(created["id"])
        self.assertEqual(fetched, created)

        updated = self.client.update_employee(
            created["id"],
            {"role": "Staff engineer", "interests": ["scaling", "observability"]},
        )
        self.assertEqual(updated["role"], "Staff engineer")
        self.assertEqual(updated["interests"], ["scaling", "observability"])

        self.client.delete_employee(created["id"])
        self.created_ids.remove(created["id"])

        with self.assertRaises(DbApiError) as ctx:
            self.client.get_employee(created["id"])
        self.assertEqual(ctx.exception.status_code, 404)

    def test_duplicate_name_returns_409(self):
        payload = self._make_payload()
        created = self.client.create_employee(payload)
        self.created_ids.append(created["id"])

        with self.assertRaises(DbApiError) as ctx:
            self.client.create_employee(payload)
        self.assertEqual(ctx.exception.status_code, 409)


@unittest.skipUnless(_api_reachable(), "DB API not reachable at DB_API_BASE_URL")
class TestDbApiClientMoveRequests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.client = DbApiClient()
        cls.project_a = cls.client.create_project(
            {
                "project_name": _unique("mr-from"),
                "project_description": "Move-request from-project fixture.",
                "project_phase": "maintenance",
                "icon_url": "https://example.com/icon.png",
                "poster_url": "https://example.com/poster.png",
                "current_team_member_ids": [],
                "required_people_amount": 1,
                "required_skills": SKILL_ZERO,
                "github_repositories": [],
            }
        )
        cls.project_b = cls.client.create_project(
            {
                "project_name": _unique("mr-to"),
                "project_description": "Move-request to-project fixture.",
                "project_phase": "growth",
                "icon_url": "https://example.com/icon.png",
                "poster_url": "https://example.com/poster.png",
                "current_team_member_ids": [],
                "required_people_amount": 2,
                "required_skills": {**SKILL_ZERO, "backend": 2},
                "github_repositories": [],
            }
        )
        cls.employee = cls.client.create_employee(
            {
                "name": _unique("mr-emp"),
                "role": "Backend engineer",
                "current_project_ids": [cls.project_a["id"]],
                "skills": {**SKILL_ZERO, "backend": 3},
                "preferences": [cls.project_b["project_name"]],
                "interests": [],
            }
        )
        cls.created_request_ids: list[int] = []

    @classmethod
    def tearDownClass(cls) -> None:
        # Move requests cascade-delete from employees; deleting the employee
        # also clears any requests we created against project_b.
        for rid in cls.created_request_ids:
            try:
                cls.client.delete_move_request(rid)
            except DbApiError:
                pass
        try:
            cls.client.delete_employee(cls.employee["id"])
        except DbApiError:
            pass
        for proj in (cls.project_a, cls.project_b):
            try:
                cls.client.delete_project(proj["id"])
            except DbApiError:
                pass
        cls.client.close()

    def _make_payload(self) -> dict:
        return {
            "employee_id": self.employee["id"],
            "from_project_id": self.project_a["id"],
            "to_project_id": self.project_b["id"],
            "reason": "Backend skills match the target project's needs.",
            "expected_role": "Backend engineer",
            "current_project_impact": "low",
        }

    def test_list_pagination(self):
        result = self.client.list_move_requests(limit=5)
        self.assertIsInstance(result, list)
        self.assertLessEqual(len(result), 5)

    def test_create_defaults_to_pending_with_joined_names(self):
        created = self.client.create_move_request(self._make_payload())
        self.created_request_ids.append(created["id"])

        self.assertEqual(created["status"], "pending")
        self.assertIsNone(created["responded_at"])
        self.assertEqual(created["employee_name"], self.employee["name"])
        self.assertEqual(created["from_project_name"], self.project_a["project_name"])
        self.assertEqual(created["to_project_name"], self.project_b["project_name"])
        self.assertIsNotNone(created["created_at"])

    def test_status_transitions_set_responded_at(self):
        created = self.client.create_move_request(self._make_payload())
        self.created_request_ids.append(created["id"])

        accepted = self.client.update_move_request(
            created["id"], {"status": "accepted"}
        )
        self.assertEqual(accepted["status"], "accepted")
        self.assertIsNotNone(accepted["responded_at"])

        reverted = self.client.update_move_request(
            created["id"], {"status": "pending"}
        )
        self.assertEqual(reverted["status"], "pending")
        self.assertIsNone(reverted["responded_at"])

    def test_invalid_foreign_key_returns_400(self):
        bad = self._make_payload()
        bad["to_project_id"] = 2_000_000_000
        with self.assertRaises(DbApiError) as ctx:
            self.client.create_move_request(bad)
        self.assertEqual(ctx.exception.status_code, 400)

    def test_delete_and_404(self):
        created = self.client.create_move_request(self._make_payload())
        self.client.delete_move_request(created["id"])
        with self.assertRaises(DbApiError) as ctx:
            self.client.get_move_request(created["id"])
        self.assertEqual(ctx.exception.status_code, 404)


@unittest.skipUnless(
    _matching_api_reachable(),
    "matching DB API endpoints not reachable at DB_API_BASE_URL",
)
class TestDbApiClientMatchingPersistence(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.client = DbApiClient()
        cls.project = cls.client.create_project(
            {
                "project_name": _unique("match-proj"),
                "project_description": "Matching persistence fixture.",
                "project_phase": "growth",
                "icon_url": "https://example.com/icon.png",
                "poster_url": "https://example.com/poster.png",
                "current_team_member_ids": [],
                "required_people_amount": 2,
                "required_skills": {**SKILL_ZERO, "backend": 2},
                "github_repositories": [],
            }
        )
        cls.employee = cls.client.create_employee(
            {
                "name": _unique("match-emp"),
                "role": "Backend engineer",
                "current_project_ids": [],
                "skills": {**SKILL_ZERO, "backend": 3},
                "preferences": [cls.project["project_name"]],
                "interests": ["matching tests"],
            }
        )
        cls.created_run_ids: list[int] = []
        cls.created_move_request_ids: list[int] = []

    @classmethod
    def tearDownClass(cls) -> None:
        for request_id in cls.created_move_request_ids:
            try:
                cls.client.delete_move_request(request_id)
            except DbApiError:
                pass
        for run_id in cls.created_run_ids:
            try:
                cls.client.delete_matching_run(run_id)
            except DbApiError:
                pass
        try:
            cls.client.delete_employee(cls.employee["id"])
        except DbApiError:
            pass
        try:
            cls.client.delete_project(cls.project["id"])
        except DbApiError:
            pass
        cls.client.close()

    def test_matching_run_child_resources_and_move_request_action(self):
        run = self.client.create_matching_run(
            {
                "use_case": "project_rebalance",
                "target_project_id": self.project["id"],
                "status": "pending",
                "requested_by": "test-suite",
                "rule_config": {"max_moves": 1},
                "input_snapshot": {"project_ids": [self.project["id"]]},
            }
        )
        self.created_run_ids.append(run["id"])

        candidate = self.client.create_matching_candidate(
            run["id"],
            {
                "candidate_plan_id": "plan_01",
                "strict_score": 0.8,
                "hard_rule_summary": {"valid": True},
                "plan_payload": {"moves": []},
            },
        )
        self.assertEqual(candidate["candidate_plan_id"], "plan_01")

        recommendation = self.client.create_matching_recommendation(
            run["id"],
            {
                "candidate_plan_id": "plan_01",
                "rank": 1,
                "fit_score": 0.9,
                "summary": "Recommended staffing move.",
                "risks": [],
                "suggested_moves": [
                    {
                        "employee_id": self.employee["id"],
                        "from_project_id": None,
                        "to_project_id": self.project["id"],
                        "suggested_role": "Backend engineer",
                        "current_project_impact": "low",
                        "move_request_reason": "Backend skills match the project.",
                    }
                ],
            },
        )
        self.assertEqual(recommendation["rank"], 1)

        hiring = self.client.create_matching_hiring_recommendation(
            run["id"],
            {
                "candidate_plan_id": "plan_01",
                "project_id": self.project["id"],
                "role_title": "Senior backend engineer",
                "count": 1,
                "required_skills": {**SKILL_ZERO, "backend": 3},
                "reason": "Hiring gap remains after reassignment.",
                "urgency": "high",
            },
        )
        self.assertEqual(hiring["urgency"], "high")

        event = self.client.create_matching_run_event(
            run["id"],
            {
                "level": "info",
                "stage": "strict_rules",
                "event_type": "strict_rules.completed",
                "message": "Generated one candidate.",
                "metadata": {"candidate_count": 1},
            },
        )
        self.assertEqual(event["metadata"]["candidate_count"], 1)

        latest = self.client.get_latest_project_matching_run(self.project["id"])
        self.assertEqual(latest["id"], run["id"])

        action = self.client.create_move_requests_from_matching_recommendation(
            run["id"],
            "plan_01",
        )
        self.assertEqual(len(action["move_requests"]), 1)
        self.created_move_request_ids.append(action["move_requests"][0]["id"])

        updated = self.client.update_matching_run(
            run["id"],
            {"status": "completed", "selected_candidate_plan_id": "plan_01"},
        )
        self.assertEqual(updated["status"], "completed")


if __name__ == "__main__":
    unittest.main()
