# Matching Policy Documentation

Matching policies control how strict or flexible the matching engine is when it
suggests staffing moves. The system stores policies in the `policies` table, and
exactly one policy should be active at a time.

Every matching run uses this order:

1. Start from backend code defaults.
2. Apply the selected database policy. If the API request does not select one,
   use `Balanced strict matching`.
3. Save the final effective configuration on the matching run for auditability.

Run endpoints accept `policy_id` or `policy_name` for per-run policy selection.
They do not accept raw rule overrides. To change durable policy values, update
or activate a policy in the DB API.

## Seeded Policies

`Conservative strict matching`, `Balanced strict matching`, and
`Aggressive strict matching` are created automatically when missing. Balanced is
active and is the default used by matching endpoints.

Conservative:

```json
{
  "max_candidate_plans": 25,
  "max_moves": 1,
  "max_projects_in_scope": 8,
  "max_employees_in_scope": 60,
  "max_employee_project_count": 2,
  "minimum_remaining_project_coverage": 0.85,
  "minimum_target_coverage_improvement": 0.1,
  "allow_unassigned_employees": true,
  "allow_multi_project_assignment": true,
  "allow_understaff_current_project": false,
  "exclude_pending_move_requests": true,
  "prefer_employee_preferences": true,
  "emit_hiring_gaps": true
}
```

Balanced:

```json
{
  "max_candidate_plans": 25,
  "max_moves": 2,
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

Aggressive:

```json
{
  "max_candidate_plans": 25,
  "max_moves": 3,
  "max_projects_in_scope": 8,
  "max_employees_in_scope": 60,
  "max_employee_project_count": 2,
  "minimum_remaining_project_coverage": 0.6,
  "minimum_target_coverage_improvement": 0.1,
  "allow_unassigned_employees": true,
  "allow_multi_project_assignment": true,
  "allow_understaff_current_project": true,
  "exclude_pending_move_requests": true,
  "prefer_employee_preferences": true,
  "emit_hiring_gaps": true
}
```

## Rule Guide

- `max_candidate_plans`: Maximum candidate plans generated before returning results. Higher values give more options but add noise.
- `max_moves`: Maximum people moved in one candidate plan. Valid range is `1` to `5`; `1` is conservative, while `5` allows broader reshuffles.
- `max_projects_in_scope`: Number of nearby/relevant projects considered as possible source projects.
- `max_employees_in_scope`: Number of employees considered by strict rules.
- `max_employee_project_count`: Maximum simultaneous project assignments allowed for one employee.
- `minimum_remaining_project_coverage`: Minimum coverage a source project must keep after losing someone. Higher values protect current teams.
- `minimum_target_coverage_improvement`: Minimum improvement required for the target project. Higher values reject weak moves.
- `allow_unassigned_employees`: Allows matching employees who are not currently assigned to a project.
- `allow_multi_project_assignment`: Allows adding an employee to another project without removing them from the current one.
- `allow_understaff_current_project`: Allows a move that leaves the source project understaffed. Keep this `false` unless urgency is high.
- `exclude_pending_move_requests`: Excludes employees who already have pending move requests.
- `prefer_employee_preferences`: Gives preference-aligned moves a ranking boost.
- `emit_hiring_gaps`: Creates hiring recommendations when internal reassignment cannot safely solve the gap.

## Suggested Tuning

Conservative:

- Use when avoiding disruption is more important than filling gaps quickly.
- Set `max_moves` to `1`.
- Keep `allow_understaff_current_project` as `false`.
- Raise `minimum_remaining_project_coverage` toward `0.85`.

Balanced:

- Good default for demos and normal planning.
- Keep `max_moves` at `2` or `3`.
- Keep `minimum_remaining_project_coverage` around `0.75`.
- Keep `emit_hiring_gaps` enabled so impossible cases become hiring signals.

Aggressive:

- Use when a strategic project urgently needs staffing.
- Keep `max_moves` at `3`, or raise it up to `5` when broader reshuffles are acceptable.
- Lower `minimum_remaining_project_coverage` toward `0.6`.
- Consider `allow_understaff_current_project: true` only if leadership accepts the source-project risk.

## Policy Changes

Changing the active policy affects consumers that explicitly use
`/db-api/policies/active`. Backend matching endpoints use balanced by default
unless the request selects another policy. Existing runs remain explainable
because `matching_runs.rule_config` stores the selected policy snapshot and
final effective config used at run time.

Use policy changes for durable organization-wide tuning. For experiments or
debugging, pass `policy_id` or `policy_name` on a matching run request.
