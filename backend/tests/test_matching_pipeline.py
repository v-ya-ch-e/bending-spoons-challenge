import os
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

os.environ.setdefault("BACKEND_ROOT_PATH", "")

from main import app
from schemas import MatchingRunRequest, MatchingRunResponse
from services.matching.pipeline import run_matching_pipeline


SKILL_ZERO = {
    "android": 0,
    "ios": 0,
    "web": 0,
    "backend": 0,
    "infrastructure": 0,
    "ai": 0,
}

DEFAULT_POLICY_CONFIG = {
    "max_candidate_plans": 9,
    "max_moves": 2,
    "max_projects_in_scope": 8,
    "max_employees_in_scope": 60,
    "max_employee_project_count": 2,
    "minimum_remaining_project_coverage": 0.75,
    "minimum_target_coverage_improvement": 0.1,
    "allow_unassigned_employees": True,
    "allow_multi_project_assignment": True,
    "allow_understaff_current_project": False,
    "exclude_pending_move_requests": True,
    "prefer_employee_preferences": True,
    "emit_hiring_gaps": True,
}


class FakeDbApiClient:
    def __init__(self):
        self.projects = [
            {
                "id": 1,
                "project_name": "Target",
                "project_phase": "growth",
                "required_people_amount": 1,
                "required_skills": {**SKILL_ZERO, "backend": 3},
                "current_team_member_ids": [],
            }
        ]
        self.employees = [
            {
                "id": 10,
                "name": "Ada",
                "role": "Senior backend engineer",
                "skills": {**SKILL_ZERO, "backend": 3},
                "current_project_ids": [],
                "preferences": ["Target"],
                "interests": [],
            }
        ]
        self.move_requests = []
        self.runs = []
        self.candidates = []
        self.hiring_recommendations = []
        self.events = []
        self.updated_runs = []
        self.active_policy = {
            "id": 7,
            "name": "Default strict matching",
            "config": DEFAULT_POLICY_CONFIG,
        }

    def close(self):
        pass

    def list_projects(self, limit=100, offset=0):
        return self.projects[offset : offset + limit]

    def list_employees(self, limit=100, offset=0):
        return self.employees[offset : offset + limit]

    def list_move_requests(self, limit=100, offset=0):
        return self.move_requests[offset : offset + limit]

    def get_active_policy(self):
        return self.active_policy

    def create_matching_run(self, payload):
        run = {"id": 42, **payload}
        self.runs.append(run)
        return run

    def update_matching_run(self, run_id, payload):
        run = {"id": run_id, **payload}
        self.updated_runs.append(run)
        return run

    def create_matching_candidate(self, run_id, payload):
        candidate = {"id": len(self.candidates) + 1, "run_id": run_id, **payload}
        self.candidates.append(candidate)
        return candidate

    def create_matching_hiring_recommendation(self, run_id, payload):
        recommendation = {
            "id": len(self.hiring_recommendations) + 1,
            "run_id": run_id,
            **payload,
        }
        self.hiring_recommendations.append(recommendation)
        return recommendation

    def create_matching_run_event(self, run_id, payload):
        event = {"id": len(self.events) + 1, "run_id": run_id, **payload}
        self.events.append(event)
        return event


class TestMatchingPipeline(unittest.TestCase):
    def test_pipeline_persists_run_candidates_events_and_counts(self):
        db_client = FakeDbApiClient()

        response = run_matching_pipeline(
            use_case="project_rebalance",
            target_project_id=1,
            request=MatchingRunRequest(
                requested_by="test-suite",
            ),
            db_client=db_client,
        )

        self.assertEqual(response.run_id, 42)
        self.assertEqual(response.candidate_count, 1)
        self.assertEqual(response.recommendation_count, 0)
        self.assertEqual(len(db_client.candidates), 1)
        self.assertEqual(db_client.candidates[0]["candidate_plan_id"], "plan_01")
        self.assertEqual(db_client.candidates[0]["plan_payload"]["moves"][0]["employee_id"], 10)
        self.assertEqual(db_client.runs[0]["rule_config"]["policy_id"], 7)
        self.assertEqual(db_client.runs[0]["rule_config"]["policy_name"], "Default strict matching")
        self.assertEqual(db_client.runs[0]["rule_config"]["policy_config"], DEFAULT_POLICY_CONFIG)
        self.assertNotIn("request_overrides", db_client.runs[0]["rule_config"])
        self.assertEqual(db_client.runs[0]["rule_config"]["effective_config"]["max_candidate_plans"], 9)
        self.assertEqual(db_client.runs[0]["rule_config"]["effective_config"]["max_moves"], 2)
        self.assertEqual(db_client.updated_runs[-1]["status"], "completed")
        self.assertIn(
            "strict_rules.completed",
            [event["event_type"] for event in db_client.events],
        )

    def test_active_policy_is_the_only_rule_configuration_source(self):
        db_client = FakeDbApiClient()

        run_matching_pipeline(
            use_case="project_rebalance",
            target_project_id=1,
            request=MatchingRunRequest(),
            db_client=db_client,
        )

        rule_config = db_client.runs[0]["rule_config"]
        self.assertEqual(rule_config["effective_config"]["max_candidate_plans"], 9)
        self.assertEqual(rule_config["effective_config"]["max_moves"], 2)
        self.assertFalse(rule_config["effective_config"]["allow_understaff_current_project"])

    def test_project_matching_route_delegates_to_service(self):
        client = TestClient(app)
        service_response = MatchingRunResponse(
            run_id=99,
            use_case="project_rebalance",
            status="completed",
            target_project_id=1,
            candidate_count=0,
            recommendation_count=0,
            hiring_recommendation_count=0,
            summary="No candidates.",
            candidates=[],
            hiring_recommendations=[],
            logs=[],
        )

        with patch("main.matching_service.run_matching", return_value=service_response) as run_matching:
            response = client.post("/projects/1/matching:run")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["run_id"], 99)
        run_matching.assert_called_once()
        self.assertEqual(run_matching.call_args.kwargs["use_case"], "project_rebalance")
        self.assertEqual(run_matching.call_args.kwargs["target_project_id"], 1)

    def test_project_matching_route_rejects_inline_config(self):
        client = TestClient(app)

        response = client.post(
            "/projects/1/matching:run",
            json={"rule_config": {"max_moves": 1}},
        )

        self.assertEqual(response.status_code, 422)


if __name__ == "__main__":
    unittest.main()
