import unittest

from services.matching.config import StrictRuleConfig, build_rule_config
from services.matching.strict_rules import (
    compute_project_coverage,
    normalize_snapshot,
    run_strict_rules,
    select_scope,
)


SKILL_ZERO = {
    "android": 0,
    "ios": 0,
    "web": 0,
    "backend": 0,
    "infrastructure": 0,
    "ai": 0,
}


def project(
    project_id: int,
    *,
    name: str,
    required_people_amount: int,
    required_skills: dict,
    members: list[int] | None = None,
    phase: str = "growth",
) -> dict:
    return {
        "id": project_id,
        "project_name": name,
        "project_phase": phase,
        "required_people_amount": required_people_amount,
        "required_skills": {**SKILL_ZERO, **required_skills},
        "current_team_member_ids": members or [],
    }


def employee(
    employee_id: int,
    *,
    role: str = "Backend engineer",
    skills: dict | None = None,
    projects: list[int] | None = None,
    preferences: list[str] | None = None,
) -> dict:
    return {
        "id": employee_id,
        "name": f"Employee {employee_id}",
        "role": role,
        "skills": {**SKILL_ZERO, **(skills or {})},
        "current_project_ids": projects or [],
        "preferences": preferences or [],
        "interests": [],
    }


class TestMatchingStrictRules(unittest.TestCase):
    def assert_candidate_plans_satisfy_invariants(self, result, config):
        self.assertLessEqual(len(result.candidate_plans), config.max_candidate_plans)

        for candidate in result.candidate_plans:
            with self.subTest(candidate_plan_id=candidate.candidate_plan_id):
                self.assertGreater(candidate.strict_score, 0)
                self.assertLessEqual(candidate.strict_score, 1)
                self.assertLessEqual(len(candidate.moves), config.max_moves)
                self.assertEqual(
                    len({move.employee_id for move in candidate.moves}),
                    len(candidate.moves),
                )
                self.assertTrue(candidate.hard_rule_summary["valid"])

                target_project_id = candidate.hard_rule_summary["target_project_id"]
                before = result.coverage_before[target_project_id]
                after = candidate.project_coverage_after[target_project_id]
                self.assertLess(after.total_gap, before.total_gap)
                if before.total_gap > 0:
                    improvement_ratio = (
                        before.total_gap - after.total_gap
                    ) / before.total_gap
                    self.assertGreaterEqual(
                        improvement_ratio,
                        config.minimum_target_coverage_improvement,
                    )

                for move in candidate.moves:
                    self.assertEqual(move.to_project_id, target_project_id)
                    if move.from_project_id is None:
                        continue
                    source_after = candidate.project_coverage_after[move.from_project_id]
                    self.assertGreaterEqual(
                        source_after.coverage_ratio,
                        config.minimum_remaining_project_coverage,
                    )

    def test_unknown_skill_keys_are_rejected(self):
        with self.assertRaises(ValueError):
            normalize_snapshot(
                [
                    project(
                        1,
                        name="Target",
                        required_people_amount=1,
                        required_skills={"security": 2},
                    )
                ],
                [],
            )

    def test_project_scoped_run_excludes_unrelated_projects(self):
        snapshot = normalize_snapshot(
            [
                project(1, name="Target", required_people_amount=1, required_skills={"backend": 2}),
                project(2, name="Donor", required_people_amount=1, required_skills={"backend": 1}, members=[20]),
                project(3, name="Unrelated", required_people_amount=1, required_skills={"ios": 1}, members=[30]),
            ],
            [
                employee(20, skills={"backend": 3}, projects=[2]),
                employee(30, skills={"ios": 3}, projects=[3]),
                employee(40, skills={"backend": 3}, preferences=["Target"]),
            ],
        )

        scoped = select_scope(
            use_case="project_rebalance",
            target_project_id=1,
            snapshot=snapshot,
            config=StrictRuleConfig(max_projects_in_scope=2),
        )

        self.assertIn(1, scoped.projects)
        self.assertNotIn(3, scoped.projects)
        self.assertIn(40, scoped.employees)

    def test_generates_stable_strict_candidates_with_limits(self):
        snapshot = normalize_snapshot(
            [
                project(1, name="Target", required_people_amount=1, required_skills={"backend": 3, "infrastructure": 1}),
                project(2, name="Healthy", required_people_amount=1, required_skills={"web": 1}, members=[20]),
            ],
            [
                employee(10, skills={"backend": 3, "infrastructure": 2}, preferences=["Target"]),
                employee(20, skills={"web": 2}, projects=[2]),
            ],
        )

        result = run_strict_rules(
            use_case="project_rebalance",
            target_project_id=1,
            snapshot=snapshot,
            config=StrictRuleConfig(max_candidate_plans=1),
        )

        self.assertEqual(len(result.candidate_plans), 1)
        self.assertEqual(result.candidate_plans[0].candidate_plan_id, "plan_01")
        self.assertGreater(result.candidate_plans[0].strict_score, 0)
        self.assertEqual(result.candidate_plans[0].moves[0].employee_id, 10)

    def test_generated_candidates_satisfy_core_quality_invariants(self):
        snapshot = normalize_snapshot(
            [
                project(
                    1,
                    name="Target",
                    required_people_amount=2,
                    required_skills={"backend": 3, "infrastructure": 2},
                ),
                project(
                    2,
                    name="Healthy",
                    required_people_amount=1,
                    required_skills={"web": 1},
                    members=[20, 21],
                ),
            ],
            [
                employee(10, skills={"backend": 3, "infrastructure": 2}),
                employee(20, skills={"backend": 3, "infrastructure": 2}, projects=[2]),
                employee(21, skills={"web": 2}, projects=[2]),
            ],
        )
        config = StrictRuleConfig(max_candidate_plans=5, max_moves=2)

        result = run_strict_rules(
            use_case="project_rebalance",
            target_project_id=1,
            snapshot=snapshot,
            config=config,
        )

        self.assertGreater(len(result.candidate_plans), 0)
        self.assert_candidate_plans_satisfy_invariants(result, config)

    def test_unassigned_expert_is_preferred_over_reassignment(self):
        snapshot = normalize_snapshot(
            [
                project(
                    1,
                    name="Target",
                    required_people_amount=1,
                    required_skills={"backend": 3, "infrastructure": 2},
                ),
                project(
                    2,
                    name="Source",
                    required_people_amount=1,
                    required_skills={"backend": 1},
                    members=[20, 21],
                ),
            ],
            [
                employee(20, skills={"backend": 3, "infrastructure": 2}, projects=[2]),
                employee(21, skills={"backend": 1}, projects=[2]),
                employee(
                    30,
                    skills={"backend": 3, "infrastructure": 2},
                    preferences=["Target"],
                ),
            ],
        )

        result = run_strict_rules(
            use_case="project_rebalance",
            target_project_id=1,
            snapshot=snapshot,
            config=StrictRuleConfig(
                allow_multi_project_assignment=False,
                max_candidate_plans=3,
            ),
        )

        top_move = result.candidate_plans[0].moves[0]
        self.assertEqual(top_move.employee_id, 30)
        self.assertEqual(top_move.action, "assign")
        self.assertIsNone(top_move.from_project_id)

    def test_exact_skill_gap_match_beats_generic_headcount_fill(self):
        snapshot = normalize_snapshot(
            [
                project(
                    1,
                    name="Target",
                    required_people_amount=2,
                    required_skills={"backend": 3, "web": 3},
                    members=[10],
                ),
            ],
            [
                employee(10, skills={"backend": 3}, projects=[1]),
                employee(20, skills={"web": 3}),
                employee(30, skills={"backend": 3}),
            ],
        )

        result = run_strict_rules(
            use_case="project_rebalance",
            target_project_id=1,
            snapshot=snapshot,
            config=StrictRuleConfig(max_candidate_plans=3),
        )

        top_move = result.candidate_plans[0].moves[0]
        self.assertEqual(top_move.employee_id, 20)
        self.assertEqual(
            result.candidate_plans[0].hard_rule_summary["target_gap_after"],
            0,
        )

    def test_low_disruption_donor_move_beats_destructive_move(self):
        snapshot = normalize_snapshot(
            [
                project(
                    1,
                    name="Target",
                    required_people_amount=1,
                    required_skills={"backend": 3},
                ),
                project(
                    2,
                    name="Fragile Source",
                    required_people_amount=1,
                    required_skills={"backend": 3},
                    members=[10],
                ),
                project(
                    3,
                    name="Resilient Source",
                    required_people_amount=1,
                    required_skills={"backend": 1},
                    members=[20, 21],
                ),
            ],
            [
                employee(10, skills={"backend": 3}, projects=[2]),
                employee(20, skills={"backend": 3}, projects=[3]),
                employee(21, skills={"backend": 1}, projects=[3]),
            ],
        )

        result = run_strict_rules(
            use_case="project_rebalance",
            target_project_id=1,
            snapshot=snapshot,
            config=StrictRuleConfig(
                allow_multi_project_assignment=False,
                allow_understaff_current_project=True,
                max_candidate_plans=3,
            ),
        )

        top_move = result.candidate_plans[0].moves[0]
        self.assertEqual(top_move.employee_id, 20)
        self.assertEqual(top_move.current_project_impact, "low")

    def test_project_scope_blocks_target_with_open_move_request(self):
        snapshot = normalize_snapshot(
            [
                project(
                    1,
                    name="Target",
                    required_people_amount=1,
                    required_skills={"backend": 3},
                ),
            ],
            [
                employee(10, skills={"backend": 3}),
                employee(99, skills={"backend": 1}),
            ],
            [
                {
                    "id": 100,
                    "employee_id": 99,
                    "from_project_id": None,
                    "to_project_id": 1,
                    "status": "pending",
                }
            ],
        )

        result = run_strict_rules(
            use_case="project_rebalance",
            target_project_id=1,
            snapshot=snapshot,
            config=StrictRuleConfig(),
        )

        self.assertEqual(result.candidate_plans, ())

    def test_full_gap_closure_beats_preferred_partial_match(self):
        snapshot = normalize_snapshot(
            [
                project(
                    1,
                    name="Target",
                    required_people_amount=1,
                    required_skills={"backend": 3, "web": 3, "ai": 3},
                ),
            ],
            [
                employee(
                    10,
                    skills={"backend": 3, "web": 3},
                    preferences=["Target"],
                ),
                employee(20, skills={"backend": 3}),
                employee(21, skills={"web": 3, "ai": 3}),
            ],
        )

        result = run_strict_rules(
            use_case="project_rebalance",
            target_project_id=1,
            snapshot=snapshot,
            config=StrictRuleConfig(max_moves=3, max_candidate_plans=5),
        )

        top_candidate = result.candidate_plans[0]
        self.assertEqual(top_candidate.hard_rule_summary["target_gap_after"], 0)
        self.assertGreater(len(top_candidate.moves), 1)
        self.assertNotEqual({move.employee_id for move in top_candidate.moves}, {10})

    def test_source_project_protection_rejects_destructive_moves(self):
        snapshot = normalize_snapshot(
            [
                project(1, name="Target", required_people_amount=1, required_skills={"backend": 3}),
                project(2, name="Source", required_people_amount=1, required_skills={"backend": 3}, members=[20]),
            ],
            [
                employee(20, skills={"backend": 3}, projects=[2]),
            ],
        )

        result = run_strict_rules(
            use_case="project_rebalance",
            target_project_id=1,
            snapshot=snapshot,
            config=StrictRuleConfig(
                allow_multi_project_assignment=False,
                allow_understaff_current_project=False,
            ),
        )

        self.assertEqual(result.candidate_plans, ())
        self.assertEqual(len(result.hiring_gaps), 1)

    def test_pending_move_requests_block_candidates(self):
        snapshot = normalize_snapshot(
            [
                project(1, name="Target", required_people_amount=1, required_skills={"backend": 3}),
            ],
            [
                employee(10, skills={"backend": 3}),
            ],
            [
                {
                    "id": 100,
                    "employee_id": 10,
                    "from_project_id": None,
                    "to_project_id": 1,
                    "status": "pending",
                }
            ],
        )

        result = run_strict_rules(
            use_case="project_rebalance",
            target_project_id=1,
            snapshot=snapshot,
            config=StrictRuleConfig(),
        )

        self.assertEqual(result.candidate_plans, ())
        self.assertEqual(len(result.hiring_gaps), 1)

    def test_coverage_calculation_uses_max_skill_coverage(self):
        snapshot = normalize_snapshot(
            [
                project(1, name="Target", required_people_amount=2, required_skills={"backend": 3, "web": 2}, members=[10, 11]),
            ],
            [
                employee(10, skills={"backend": 2, "web": 1}, projects=[1]),
                employee(11, skills={"backend": 3}, projects=[1]),
            ],
        )

        coverage = compute_project_coverage(snapshot, 1)

        self.assertEqual(coverage.headcount_gap, 0)
        self.assertEqual(coverage.available_skills["backend"], 3)
        self.assertEqual(coverage.skill_gap["web"], 1)

    def test_config_overrides_request_candidate_limit(self):
        config = build_rule_config(
            max_candidate_plans=7,
            overrides={"max_moves": 2, "allow_understaff_current_project": True},
        )

        self.assertEqual(config.max_candidate_plans, 7)
        self.assertEqual(config.max_moves, 2)
        self.assertTrue(config.allow_understaff_current_project)


if __name__ == "__main__":
    unittest.main()
