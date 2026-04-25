# Matching Policy Documentation

Matching policies control how strict or flexible the matching engine is when it
suggests staffing moves. The system stores policies in the `policies` table, and
exactly one policy should be active at a time.

Every matching run uses this order:

1. Start from backend code defaults.
2. Apply the active database policy.
3. Apply any explicit request overrides.
4. Save the final effective configuration on the matching run for auditability.

## Current Default Policy

`Default strict matching` is created automatically when the database has no
policies. It matches the original backend strict-rule defaults:

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

## Rule Guide

- `max_candidate_plans`: Maximum candidate plans generated before returning results. Higher values give more options but add noise.
- `max_moves`: Maximum people moved in one candidate plan. `1` is conservative; `3` allows broader reshuffles.
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
- Keep `max_moves` at `3`.
- Lower `minimum_remaining_project_coverage` toward `0.6`.
- Consider `allow_understaff_current_project: true` only if leadership accepts the source-project risk.

## Policy Changes vs Request Overrides

Changing the active policy affects future matching runs for everyone. Request
overrides affect only one run and are saved in `matching_runs.rule_config` along
with the active policy snapshot and final effective config.

Use policy changes for durable organization-wide tuning. Use request overrides
for experiments, debugging, and one-off leadership decisions.
