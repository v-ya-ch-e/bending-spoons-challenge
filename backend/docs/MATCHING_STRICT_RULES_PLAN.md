# Matching Pipeline Step 1: Strict Rules And Candidate Generation

## Purpose

Step 1 creates valid matching possibilities before any LLM evaluation happens.
It is deterministic, configurable, and responsible for keeping the search small.

Outputs from this step are candidate assignment plans. Every candidate must:

- Reference only real employee and project IDs from the DB snapshot.
- Satisfy hard rules.
- Stay within configured search limits.
- Explain why it is valid and what tradeoffs it creates.

The OpenAI step may rank or explain candidates, but it may not repair invalid
candidates. Invalid candidates must never leave step 1.

Step 1 also identifies hiring gaps. If all safe reassignment candidates leave
one or more projects below acceptable coverage, the pipeline should return the
role profiles the company needs to hire for existing project roles.

## Inputs

Step 1 receives a normalized pipeline request:

```json
{
  "use_case": "project_rebalance",
  "target_project_id": 7,
  "policy_id": 1
}
```

Configuration is loaded from the selected database policy, defaulting to
`Balanced strict matching`. Step 1 also receives a snapshot loaded through the
DB API:

- Projects with `id`, `required_people_amount`, `required_skills`,
  `project_phase`, and `current_team_member_ids`.
- Employees with `id`, `role`, `skills`, `preferences`, `interests`, and
  `current_project_ids`.
- Open move requests, especially pending requests involving scoped employees or
  projects.

## Outputs

Step 1 returns candidate plans ordered by deterministic strict score, plus
optional hiring gaps for uncovered needs.

```json
{
  "candidate_plans": [
    {
      "candidate_plan_id": "plan_01",
      "strict_score": 0.82,
      "summary": "Move employee 3 to project 7 while preserving source coverage.",
      "moves": [
        {
          "employee_id": 3,
          "from_project_id": 2,
          "to_project_id": 7,
          "action": "move",
          "suggested_role": "Backend/platform engineer",
          "current_project_impact": "low",
          "hard_rule_reasons": [
            "Employee satisfies target backend and infrastructure gaps.",
            "Source project remains above minimum coverage."
          ]
        }
      ],
      "risks": [
        "Source project loses one infrastructure-capable engineer."
      ]
    }
  ],
  "project_coverage_after": {
    "7": {
      "headcount_gap": 0,
      "skill_gap": {
        "android": 0,
        "ios": 0,
        "web": 0,
        "backend": 0,
        "infrastructure": 0,
        "ai": 0
      }
    }
  },
  "hiring_gaps": [
    {
      "project_id": 7,
      "role_title": "Senior backend/platform engineer",
      "count": 1,
      "required_skills": {
        "android": 0,
        "ios": 0,
        "web": 1,
        "backend": 3,
        "infrastructure": 2,
        "ai": 0
      },
      "reason": "No safe reassignment can close the backend and infrastructure gap.",
      "urgency": "high"
    }
  ]
}
```

## Use-Case Scope Selection

The most important performance rule is to avoid full-portfolio search unless the
use case explicitly asks for it.

### Portfolio rebalance

Include:

- Projects with current headcount below `required_people_amount`.
- Projects with a material skill gap after evaluating assigned employees.
- Projects above target headcount that can donate capacity.
- Employees assigned to those projects.
- Unassigned employees, if enabled.

Exclude by default:

- Fully staffed maintenance projects with no skill gap.
- Employees with pending move requests.
- Projects already involved in another active matching run.

Bound the scope with `max_projects_in_scope` and `max_employees_in_scope`. If
the portfolio is larger, select the highest-need projects first.

### Project matching or rebalance

Include:

- The target project.
- Current members of the target project.
- Unassigned employees.
- Employees whose skills cover target project gaps.
- Employees from projects with surplus headcount or surplus skill coverage.
- Employees whose preferences include the target project name.

Exclude by default:

- Employees from source projects that would fall below hard minimums.
- Employees with pending move requests.
- Employees already assigned to the target project unless the plan needs to
  evaluate keeping or reshuffling them.

This use case should usually touch only the target project, plausible source
projects, and unassigned employees.

### Hiring gap detection

Hiring gap detection runs after portfolio or project-scoped candidate generation.
It is not an employee-placement use case.

Detect a hiring gap when:

- No valid candidate plan satisfies the target project needs.
- Valid candidate plans satisfy the target but create unacceptable source
  project gaps.
- The same scarce skill is required by multiple projects and reassignment only
  moves the shortage around.
- Required headcount exceeds the available safe internal capacity.

The output should describe the role profiles needed for existing project roles,
not assign hypothetical people to projects.

## Hard Rules

Hard rules decide whether a candidate is allowed at all.

### Identity and existence

- Every `employee_id` must exist in the snapshot.
- Every `project_id` must exist in the snapshot.
- A candidate cannot assign the same employee to the same project twice.
- A candidate cannot include contradictory moves for the same employee.

### Skill contract

- Only the canonical six skill keys are valid:
  `android`, `ios`, `web`, `backend`, `infrastructure`, and `ai`.
- Skill levels must be integers from 0 to 3.
- A candidate should improve or preserve target skill coverage unless explicitly
  running a pure load-balancing scenario.

### Headcount

- A target project should not remain below required headcount if enough valid
  candidates exist.
- A source project should not be pushed below configured minimum headcount.
- The number of moves must be less than or equal to `max_moves`.

### Source project protection

Before moving an employee away from a project, compute whether the source
project still has acceptable coverage:

- Remaining headcount versus `required_people_amount`.
- Remaining max skill coverage per required skill.
- Whether the removed employee is the only employee with a required skill at
  level 2 or 3.

Reject the move if it creates an unacceptable gap and the config does not allow
temporary understaffing.

### Pending requests

Reject candidates that move an employee already involved in a pending move
request, unless the request explicitly asks to include pending transitions.

### Reasonable disruption

Reject candidates that:

- Move more employees than necessary to satisfy the target gap.
- Move an employee away from a project and then back to the same project.
- Swap employees without improving headcount, skill coverage, or stated
  preferences.

## Configurable Rules

Start with code defaults in `backend/services/matching/config.py`.

Recommended config:

```json
{
  "max_candidate_plans": 25,
  "max_moves": 3,
  "max_projects_in_scope": 8,
  "max_employees_in_scope": 60,
  "max_employee_project_count": 2,
  "minimum_remaining_project_coverage": 0.75,
  "minimum_target_coverage_improvement": 0.1,
  "allow_unassigned_employees": true,
  "allow_multi_project_assignment": true,
  "allow_understaff_current_project": false,
  "exclude_pending_move_requests": true,
  "prefer_employee_preferences": true,
  "emit_hiring_gaps": true
}
```

Every run should persist the effective config after defaults and request
overrides are merged.

## Coverage Calculation

The strict step needs a simple deterministic coverage model.

For each project:

1. Start with `required_skills`.
2. For assigned employees, compute the max available level per skill.
3. Compute skill gaps as `max(required_level - available_level, 0)`.
4. Compute headcount gap as
   `max(required_people_amount - current_team_size, 0)`.

Example:

```json
{
  "required_skills": {
    "android": 0,
    "ios": 0,
    "web": 2,
    "backend": 3,
    "infrastructure": 2,
    "ai": 1
  },
  "available_skills": {
    "android": 0,
    "ios": 0,
    "web": 2,
    "backend": 2,
    "infrastructure": 1,
    "ai": 0
  },
  "skill_gap": {
    "android": 0,
    "ios": 0,
    "web": 0,
    "backend": 1,
    "infrastructure": 1,
    "ai": 1
  }
}
```

This model is intentionally simple for the first implementation. Future versions
can add combined team coverage, domain experience, availability windows, or
seniority distribution.

## Candidate Generation Algorithm

Recommended first implementation:

1. Load and normalize the snapshot.
2. Select scoped projects and employees for the use case.
3. Compute current coverage for scoped projects.
4. Identify target gaps.
5. Generate single-move candidates.
6. Generate bounded two-move and three-move candidates only when a single move
   cannot satisfy the main gap.
7. Validate every candidate against hard rules.
8. Score valid candidates deterministically.
9. Keep the top `max_candidate_plans`.
10. Compute unresolved coverage after the best valid plans.
11. Emit hiring gaps for needs that cannot be safely covered internally.

Use a beam-search style approach rather than a full combinatorial search:

```text
current_state
  -> valid one-move candidates
  -> keep top beam_width states
  -> expand to two-move candidates
  -> keep top beam_width states
  -> expand to three-move candidates
```

Stop early when enough high-quality candidates fully satisfy the target gap.
If no safe plan fully satisfies the gap, keep the best partial candidates and
produce hiring gaps for the unresolved coverage.

## Hiring Gap Calculation

Hiring gaps are derived from project coverage after safe reassignment. They
should be deterministic and based on the same canonical skill object as projects
and employees.

For each unresolved project:

1. Compute remaining headcount gap.
2. Compute remaining skill gap.
3. Group skill gaps into practical role profiles.
4. Estimate count from headcount gap and critical missing skills.
5. Assign urgency from project phase, gap size, and whether no valid candidate
   plan exists.

Example role profile:

```json
{
  "project_id": 7,
  "role_title": "Senior backend/platform engineer",
  "count": 1,
  "required_skills": {
    "android": 0,
    "ios": 0,
    "web": 1,
    "backend": 3,
    "infrastructure": 2,
    "ai": 0
  },
  "reason": "Existing employees cannot cover backend 3 and infrastructure 2 without creating a source-project gap.",
  "urgency": "high"
}
```

The strict step should avoid overfitting titles. Use concise role names derived
from the largest required skill gaps, such as:

- `Senior backend/platform engineer`
- `Senior web engineer`
- `Mobile engineer`
- `AI/ML engineer`
- `Infrastructure engineer`

## Deterministic Scoring

The strict score is not the final user-facing fit score. It is a pre-ranking to
choose which valid candidates are worth sending to the LLM.

Suggested factors:

- Target headcount gap reduction.
- Target skill gap reduction.
- Source project coverage preservation.
- Fewer moves.
- Employee preference match.
- Lower pending-transition risk.
- Keeping already-good target team members in place.

Example:

```text
strict_score =
  0.35 * target_skill_gap_reduction +
  0.25 * target_headcount_gap_reduction +
  0.20 * source_project_preservation +
  0.10 * low_disruption_score +
  0.10 * preference_score
```

Weights should be config values, but the first implementation can keep them as
constants.

## Current Project Impact

Each proposed move should compute a value compatible with the existing
`current_project_impact` enum:

- `low`: source project remains staffed and required skill coverage is mostly
  unchanged.
- `medium`: source project loses useful coverage but stays above hard minimums.
- `high`: source project would lose critical coverage. High-impact moves should
  normally be rejected unless explicitly allowed.

This value can be reused when creating `move_requests`.

## Logs Emitted By Step 1

Frontend-visible events:

- `strict_rules.started`
- `strict_rules.scope_selected`
- `strict_rules.coverage_computed`
- `strict_rules.candidates_generated`
- `strict_rules.candidates_pruned`
- `strict_rules.hiring_gaps_detected`
- `strict_rules.completed`
- `strict_rules.no_candidates`

Example event:

```json
{
  "level": "info",
  "stage": "strict_rules",
  "event_type": "strict_rules.candidates_generated",
  "message": "Generated 18 valid candidate plans.",
  "metadata": {
    "projects_in_scope": 4,
    "employees_in_scope": 23,
    "candidate_count": 18
  }
}
```

## Module Responsibilities

`backend/services/matching/strict_rules.py`:

- Scope selection.
- Coverage calculations.
- Candidate expansion.
- Hard-rule validation.
- Deterministic scoring.
- Hiring gap detection.

`backend/services/matching/models.py`:

- Internal DTOs for scoped projects, employees, candidate plans, moves, and
  coverage snapshots.

`backend/services/matching/config.py`:

- Defaults.
- Request override validation.
- Score weight definitions.

`backend/services/matching/logging.py`:

- Helper for recording matching run events through `DbApiClient`.

## Implemented Step 1 Notes

The first implementation lives in:

- `backend/services/matching/config.py`
- `backend/services/matching/models.py`
- `backend/services/matching/strict_rules.py`
- `backend/services/matching/pipeline.py`
- `backend/services/matching/logging.py`
- `backend/services/matching_service.py`

Operational behavior:

- `POST /projects/{project_id}/matching:run` runs `project_rebalance`.
- `POST /matching/portfolio:rebalance` runs `portfolio_rebalance`.
- Runs are synchronous and persist through the existing db-rest-api matching
  endpoints.
- Strict candidates are persisted to `matching_candidates`, not
  `matching_recommendations`.
- `plan_payload` contains the candidate summary, proposed moves, risks, and
  `project_coverage_after`.
- `hard_rule_summary` contains validation and coverage deltas used by the LLM
  ranking step.
- When strict candidates exist, the shared pipeline immediately runs the LLM
  step, persists final ranked recommendations to `matching_recommendations`, and
  sets `recommendation_count` from those rows.
- No `project_assignments` mutation and no move-request creation happens during
  Step 1.

## Testing

Unit tests should cover:

- Project-scoped runs exclude unrelated projects.
- Portfolio runs select under-staffed and over-staffed projects before healthy
  projects.
- Unknown skill keys are rejected or normalized before scoring.
- Source project protection rejects destructive moves.
- Pending move requests block candidate generation.
- Candidate count never exceeds configured limits.
- Runs with no candidates return a useful no-candidate summary.
- Runs with insufficient safe internal capacity return deterministic hiring
  gaps.

Use fixed snapshots in tests so candidate ordering is stable.

## Future Extensions

- Availability windows and planned return dates.
- Project priority or urgency weighting.
- Domain experience inferred from repositories, docs, and previous projects.
- Replacement-chain generation for more complex rebalances.
- Cached coverage summaries for larger portfolios.
- Hiring recommendation aggregation across multiple projects.
