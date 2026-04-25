import asyncio
import os
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from schemas import MatchingLlmRequest, MatchingLlmResponse, Skills
from schemas.matching import (
    AlternativePlan,
    BenchMove,
    BestPlan,
    CandidatePlan,
    CoverageAfter,
    GapClosingMove,
    HiringGapHint,
    HiringRecommendation,
    RecommendedBenchMove,
    RecommendedMove,
    SourceProjectImpact,
    TargetProject,
)
from services.matching_llm_service import (
    MatchingLlmError,
    _validate_against_input,
    evaluate_matching,
)


def _zero_skills(**overrides: int) -> Skills:
    base = {"android": 0, "ios": 0, "web": 0, "backend": 0, "infrastructure": 0, "ai": 0}
    base.update(overrides)
    return Skills(**base)


def _request() -> MatchingLlmRequest:
    return MatchingLlmRequest(
        use_case="project_rebalance",
        target_project=TargetProject(
            id=7,
            name="Eventbrite",
            phase="growth",
            required_people_amount=3,
            required_skills=_zero_skills(web=2, backend=3, infrastructure=2, ai=1),
        ),
        candidate_plans=[
            CandidatePlan(
                candidate_plan_id="plan_01",
                gap_closing_moves=[
                    GapClosingMove(
                        employee_id=3,
                        name="Sofia Romano",
                        role="Backend Engineer",
                        from_project_id=2,
                        from_project_name="WeTransfer",
                        to_project_id=7,
                        to_project_name="Eventbrite",
                        skills=_zero_skills(backend=3, infrastructure=2, web=1),
                        preferences=["Eventbrite"],
                        interests=["platform"],
                    ),
                ],
                bench_moves=[
                    BenchMove(
                        employee_id=9,
                        name="Marco Bianchi",
                        role="iOS Engineer",
                        to_project_id=4,
                        to_project_name="Spotify",
                        skills=_zero_skills(ios=3, backend=1),
                        interests=["mobile platforms"],
                    ),
                ],
                coverage_after=CoverageAfter(
                    headcount_gap=0,
                    skill_gap=_zero_skills(),
                ),
                source_project_impacts=[
                    SourceProjectImpact(project_id=2, project_name="WeTransfer", impact="low"),
                ],
            ),
        ],
        hiring_gap_hints=[
            HiringGapHint(
                project_id=7,
                role_title="Senior backend/platform engineer",
                count=1,
                required_skills=_zero_skills(web=1, backend=3, infrastructure=2),
            ),
        ],
    )


def _valid_best() -> BestPlan:
    return BestPlan(
        candidate_plan_id="plan_01",
        fit_score=0.9,
        reason="Closes target gap with low source impact.",
        moves=[
            RecommendedMove(
                employee_id=3,
                from_project_id=2,
                to_project_id=7,
                action="move",
                suggested_role="Backend/platform engineer",
                current_project_impact="low",
            ),
        ],
        bench_moves=[
            RecommendedBenchMove(
                employee_id=9,
                to_project_id=4,
                suggested_role="iOS support",
                reason="Mobile background fits Spotify.",
            ),
        ],
        risks=["WeTransfer loses one infra-capable engineer."],
    )


class TestValidateAgainstInput(unittest.TestCase):
    def test_passes_for_consistent_response(self):
        payload = _request()
        response = MatchingLlmResponse(
            best=_valid_best(), alternatives=[], hiring_recommendations=[]
        )

        result = _validate_against_input(response, payload)

        self.assertEqual(result.best.candidate_plan_id, "plan_01")
        self.assertEqual(result.alternatives, [])

    def test_unknown_best_plan_id_raises(self):
        payload = _request()
        bad = _valid_best().model_copy(update={"candidate_plan_id": "ghost_plan"})
        response = MatchingLlmResponse(
            best=bad, alternatives=[], hiring_recommendations=[]
        )

        with self.assertRaises(MatchingLlmError):
            _validate_against_input(response, payload)

    def test_best_with_invented_move_raises(self):
        payload = _request()
        bad = _valid_best().model_copy(
            update={
                "moves": [
                    RecommendedMove(
                        employee_id=999,
                        from_project_id=2,
                        to_project_id=7,
                        action="move",
                        suggested_role="Made up",
                        current_project_impact="low",
                    ),
                ],
            }
        )
        response = MatchingLlmResponse(
            best=bad, alternatives=[], hiring_recommendations=[]
        )

        with self.assertRaises(MatchingLlmError):
            _validate_against_input(response, payload)

    def test_best_with_invented_bench_move_raises(self):
        payload = _request()
        bad = _valid_best().model_copy(
            update={
                "bench_moves": [
                    RecommendedBenchMove(
                        employee_id=9,
                        to_project_id=99,
                        suggested_role="x",
                        reason="x",
                    ),
                ],
            }
        )
        response = MatchingLlmResponse(
            best=bad, alternatives=[], hiring_recommendations=[]
        )

        with self.assertRaises(MatchingLlmError):
            _validate_against_input(response, payload)

    def test_invalid_alternative_is_dropped_silently(self):
        payload = _request()
        good_alt = AlternativePlan(
            candidate_plan_id="plan_01",
            fit_score=0.7,
            reason="Same plan, different framing.",
            tradeoff="Slightly slower ramp-up.",
            moves=_valid_best().moves,
            bench_moves=_valid_best().bench_moves,
            risks=[],
        )
        bad_alt = good_alt.model_copy(update={"candidate_plan_id": "ghost_plan"})

        response = MatchingLlmResponse(
            best=_valid_best(),
            alternatives=[good_alt, bad_alt],
            hiring_recommendations=[],
        )

        result = _validate_against_input(response, payload)

        self.assertEqual(len(result.alternatives), 1)
        self.assertEqual(result.alternatives[0].candidate_plan_id, "plan_01")

    def test_hiring_recommendation_unknown_project_dropped(self):
        payload = _request()
        good = HiringRecommendation(
            project_id=7,
            role_title="Senior backend engineer",
            count=1,
            required_skills=_zero_skills(backend=3),
            urgency="high",
            reason="Internal reassignment cannot fully cover backend.",
        )
        bad = good.model_copy(update={"project_id": 999})

        response = MatchingLlmResponse(
            best=_valid_best(),
            alternatives=[],
            hiring_recommendations=[good, bad],
        )

        result = _validate_against_input(response, payload)

        self.assertEqual(len(result.hiring_recommendations), 1)
        self.assertEqual(result.hiring_recommendations[0].project_id, 7)


class TestSchemaConstraints(unittest.TestCase):
    def test_fit_score_out_of_range_rejected(self):
        from pydantic import ValidationError

        with self.assertRaises(ValidationError):
            BestPlan(
                candidate_plan_id="plan_01",
                fit_score=1.5,
                reason="x",
                moves=[],
                bench_moves=[],
                risks=[],
            )

    def test_more_than_two_alternatives_rejected(self):
        from pydantic import ValidationError

        alt = AlternativePlan(
            candidate_plan_id="plan_01",
            fit_score=0.5,
            reason="x",
            tradeoff="x",
            moves=[],
            bench_moves=[],
            risks=[],
        )
        with self.assertRaises(ValidationError):
            MatchingLlmResponse(
                best=_valid_best(),
                alternatives=[alt, alt, alt],
                hiring_recommendations=[],
            )

    def test_alternative_requires_tradeoff(self):
        from pydantic import ValidationError

        with self.assertRaises(ValidationError):
            AlternativePlan(
                candidate_plan_id="plan_01",
                fit_score=0.5,
                reason="x",
                tradeoff="",
                moves=[],
                bench_moves=[],
                risks=[],
            )


def _step1_output_fixture() -> MatchingLlmRequest:
    """Simulates step-1 deterministic output: several candidate plans with
    genuine tradeoffs, bench placements, and a residual coverage gap that the
    LLM may turn into a hiring recommendation.
    """
    target = TargetProject(
        id=7,
        name="Eventbrite",
        phase="growth",
        required_people_amount=3,
        required_skills=_zero_skills(web=2, backend=3, infrastructure=2, ai=1),
    )

    # Plan A — single high-fit move, low source disruption.
    plan_a = CandidatePlan(
        candidate_plan_id="plan_A_low_disruption",
        gap_closing_moves=[
            GapClosingMove(
                employee_id=3,
                name="Sofia Romano",
                role="Backend Engineer",
                from_project_id=2,
                from_project_name="WeTransfer",
                to_project_id=7,
                to_project_name="Eventbrite",
                skills=_zero_skills(backend=3, infrastructure=2, web=1),
                preferences=["Eventbrite"],
                interests=["platform", "events"],
            ),
        ],
        bench_moves=[
            BenchMove(
                employee_id=11,
                name="Marco Bianchi",
                role="iOS Engineer",
                to_project_id=4,
                to_project_name="Spotify",
                skills=_zero_skills(ios=3, backend=1),
                interests=["mobile platforms"],
            ),
        ],
        coverage_after=CoverageAfter(
            headcount_gap=2,
            skill_gap=_zero_skills(web=1, ai=1),
        ),
        source_project_impacts=[
            SourceProjectImpact(project_id=2, project_name="WeTransfer", impact="low"),
        ],
    )

    # Plan B — two-move plan, closes more of the gap but takes a senior off Spotify.
    plan_b = CandidatePlan(
        candidate_plan_id="plan_B_two_moves_high_impact",
        gap_closing_moves=[
            GapClosingMove(
                employee_id=5,
                name="Diego Alvarez",
                role="Backend Tech Lead",
                from_project_id=4,
                from_project_name="Spotify",
                to_project_id=7,
                to_project_name="Eventbrite",
                skills=_zero_skills(backend=3, infrastructure=1, ai=1),
                preferences=[],
                interests=["distributed systems"],
            ),
            GapClosingMove(
                employee_id=8,
                name="Aisha Khan",
                role="Web Engineer",
                from_project_id=3,
                from_project_name="Vinted",
                to_project_id=7,
                to_project_name="Eventbrite",
                skills=_zero_skills(web=3, backend=1),
                preferences=["Eventbrite"],
                interests=["frontend platforms"],
            ),
        ],
        bench_moves=[
            BenchMove(
                employee_id=11,
                name="Marco Bianchi",
                role="iOS Engineer",
                to_project_id=2,
                to_project_name="WeTransfer",
                skills=_zero_skills(ios=3, backend=1),
                interests=["mobile platforms"],
            ),
        ],
        coverage_after=CoverageAfter(
            headcount_gap=1,
            skill_gap=_zero_skills(infrastructure=1),
        ),
        source_project_impacts=[
            SourceProjectImpact(project_id=4, project_name="Spotify", impact="high"),
            SourceProjectImpact(project_id=3, project_name="Vinted", impact="medium"),
        ],
    )

    # Plan C — moves only juniors; preserves source projects but slow ramp-up.
    plan_c = CandidatePlan(
        candidate_plan_id="plan_C_junior_ramp",
        gap_closing_moves=[
            GapClosingMove(
                employee_id=14,
                name="Lena Park",
                role="Junior Backend Engineer",
                from_project_id=6,
                from_project_name="Bench",
                to_project_id=7,
                to_project_name="Eventbrite",
                skills=_zero_skills(backend=2, web=1),
                preferences=["Eventbrite"],
                interests=["learning backend platforms"],
            ),
            GapClosingMove(
                employee_id=15,
                name="Tomas Berg",
                role="Junior Web Engineer",
                from_project_id=6,
                from_project_name="Bench",
                to_project_id=7,
                to_project_name="Eventbrite",
                skills=_zero_skills(web=2, backend=1),
                preferences=[],
                interests=["frontend"],
            ),
        ],
        bench_moves=[],
        coverage_after=CoverageAfter(
            headcount_gap=1,
            skill_gap=_zero_skills(backend=1, infrastructure=2, ai=1),
        ),
        source_project_impacts=[],
    )

    return MatchingLlmRequest(
        use_case="project_rebalance",
        target_project=target,
        candidate_plans=[plan_a, plan_b, plan_c],
        hiring_gap_hints=[
            HiringGapHint(
                project_id=7,
                role_title="AI/ML engineer",
                count=1,
                required_skills=_zero_skills(ai=2, backend=1),
            ),
        ],
    )


class TestEvaluateMatchingLive(unittest.TestCase):
    def test_evaluate_matching_on_step1_fixture(self):
        if not os.getenv("OPENAI_API_KEY"):
            self.skipTest("OPENAI_API_KEY is required for the live matching test")

        async def run_test():
            payload = _step1_output_fixture()
            print("\nStep 1 fixture sent to LLM:", flush=True)
            print(payload.model_dump_json(indent=2), flush=True)

            result = await evaluate_matching(payload)
            print("\nLLM matching response:", flush=True)
            print(result.model_dump_json(indent=2), flush=True)

            self.assertIsInstance(result, MatchingLlmResponse)
            valid_plan_ids = {p.candidate_plan_id for p in payload.candidate_plans}
            self.assertIn(result.best.candidate_plan_id, valid_plan_ids)
            self.assertGreaterEqual(result.best.fit_score, 0.0)
            self.assertLessEqual(result.best.fit_score, 1.0)
            self.assertLessEqual(len(result.alternatives), 2)
            for alt in result.alternatives:
                self.assertIn(alt.candidate_plan_id, valid_plan_ids)
                self.assertNotEqual(alt.candidate_plan_id, result.best.candidate_plan_id)
                self.assertTrue(alt.tradeoff.strip())

        asyncio.run(run_test())


if __name__ == "__main__":
    unittest.main()
