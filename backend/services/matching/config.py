from __future__ import annotations

from dataclasses import asdict, dataclass, replace
from typing import Any


@dataclass(frozen=True)
class StrictRuleConfig:
    max_candidate_plans: int = 25
    max_moves: int = 3
    max_projects_in_scope: int = 8
    max_employees_in_scope: int = 60
    max_employee_project_count: int = 2
    minimum_remaining_project_coverage: float = 0.75
    minimum_target_coverage_improvement: float = 0.1
    allow_unassigned_employees: bool = True
    allow_multi_project_assignment: bool = True
    allow_understaff_current_project: bool = False
    exclude_pending_move_requests: bool = True
    prefer_employee_preferences: bool = True
    emit_hiring_gaps: bool = True

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def build_rule_config(
    *,
    max_candidate_plans: int | None = None,
    policy_config: Any = None,
    overrides: Any = None,
) -> StrictRuleConfig:
    data = _config_data(policy_config)
    data.update(_config_data(overrides))

    if max_candidate_plans is not None:
        data["max_candidate_plans"] = max_candidate_plans

    config = replace(StrictRuleConfig(), **data)
    _validate_config(config)
    return config


def _config_data(value: Any) -> dict[str, Any]:
    if value is None:
        return {}
    if hasattr(value, "model_dump"):
        return value.model_dump(exclude_none=True)
    if hasattr(value, "dict"):
        return value.dict(exclude_none=True)
    return {key: item for key, item in dict(value).items() if item is not None}


def _validate_config(config: StrictRuleConfig) -> None:
    if config.max_moves < 1 or config.max_moves > 3:
        raise ValueError("max_moves must be between 1 and 3")
    if config.max_candidate_plans < 1:
        raise ValueError("max_candidate_plans must be positive")
    if config.max_projects_in_scope < 1:
        raise ValueError("max_projects_in_scope must be positive")
    if config.max_employees_in_scope < 1:
        raise ValueError("max_employees_in_scope must be positive")
    if config.max_employee_project_count < 1:
        raise ValueError("max_employee_project_count must be positive")
    if not 0 <= config.minimum_remaining_project_coverage <= 1:
        raise ValueError("minimum_remaining_project_coverage must be between 0 and 1")
    if not 0 <= config.minimum_target_coverage_improvement <= 1:
        raise ValueError("minimum_target_coverage_improvement must be between 0 and 1")
