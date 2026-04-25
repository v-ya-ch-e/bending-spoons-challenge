"""Generate Atlas demo fixtures using the OpenAI API."""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Literal

from dotenv import load_dotenv
from openai import OpenAI
from pydantic import BaseModel, Field

DEFAULT_OUTPUT = Path(__file__).resolve().parent.parent / "fixtures" / "seed_data.json"
SKILL_KEYS = ("android", "ios", "web", "backend", "infrastructure", "ai")


class Skills(BaseModel):
    android: int = Field(ge=0, le=3)
    ios: int = Field(ge=0, le=3)
    web: int = Field(ge=0, le=3)
    backend: int = Field(ge=0, le=3)
    infrastructure: int = Field(ge=0, le=3)
    ai: int = Field(ge=0, le=3)


class Employee(BaseModel):
    name: str
    role: str
    current_project: str | None
    skills: Skills
    preferences: list[str]
    interests: list[str]


class Project(BaseModel):
    project_name: str
    project_description: str
    project_phase: Literal["new acquisition", "growth", "maintenance"]
    current_team_members: list[str]
    required_people_amount: int = Field(ge=0)
    required_skills: Skills
    github_repositories: list[str]


class MoveRequest(BaseModel):
    employee_name: str
    from_project_name: str | None
    to_project_name: str
    reason: str
    expected_role: str
    current_project_impact: Literal["low", "medium", "high"]
    status: Literal["pending", "accepted", "rejected", "clarification_requested"]


class SeedData(BaseModel):
    employees: list[Employee]
    projects: list[Project]
    move_requests: list[MoveRequest]


SYSTEM_PROMPT = """You are generating realistic seed data for an internal Bending Spoons platform called Atlas that manages dynamic project staffing. Produce a varied, believable dataset that fits the company context: an Italian tech company that buys and runs many consumer apps.

Hard requirements:
- Use only the JSON shape defined by the response schema; do not invent extra fields.
- Skill levels are integers from 0 to 3, where 0 means no experience and 3 means expert. Use the keys android, ios, web, backend, infrastructure, ai exactly.
- project_phase must be one of: "new acquisition", "growth", "maintenance".
- move_requests current_project_impact must be one of: "low", "medium", "high".
- move_requests status must cover all four values: "pending", "accepted", "rejected", "clarification_requested".
- Every employee.current_project must be either null or match a project_name from projects.
- Every project.current_team_members entry must match an employee name from employees.
- Every move_request.employee_name must match an employee name; from_project_name (if not null) and to_project_name must match a project_name.
- Vary roles, skill profiles, and project mixes. Include at least one acquired-company project ("new acquisition" phase).
"""

USER_PROMPT = """Generate exactly:
- 12 employees with varied roles (iOS, Android, web, backend, infrastructure, AI/ML, mixed). Use realistic European/international names. Each preferences list should have up to 3 project names that exist in projects. Each interests list should have 2-4 short keyword phrases.
- 6 projects spanning all three phases. At least one should be a recent acquisition. Each should have 1-3 github_repositories formatted as "https://github.com/bendingspoons/<repo-slug>".
- 5 move_requests covering all four status values. Make reasons specific and grounded in the involved employee's skills and the target project's needs.

Make sure cross-references are consistent (employee.current_project, project.current_team_members, move_request.employee_name, from_project_name, to_project_name)."""


def validate_cross_references(data: SeedData) -> list[str]:
    errors: list[str] = []
    employee_names = {e.name for e in data.employees}
    project_names = {p.project_name for p in data.projects}

    for employee in data.employees:
        if employee.current_project is not None and employee.current_project not in project_names:
            errors.append(
                f"Employee {employee.name!r} references unknown project {employee.current_project!r}"
            )

    for project in data.projects:
        for member in project.current_team_members:
            if member not in employee_names:
                errors.append(
                    f"Project {project.project_name!r} lists unknown member {member!r}"
                )

    statuses_seen = set()
    for request in data.move_requests:
        statuses_seen.add(request.status)
        if request.employee_name not in employee_names:
            errors.append(
                f"Move request references unknown employee {request.employee_name!r}"
            )
        if request.from_project_name is not None and request.from_project_name not in project_names:
            errors.append(
                f"Move request references unknown from_project {request.from_project_name!r}"
            )
        if request.to_project_name not in project_names:
            errors.append(
                f"Move request references unknown to_project {request.to_project_name!r}"
            )

    required_statuses = {"pending", "accepted", "rejected", "clarification_requested"}
    missing = required_statuses - statuses_seen
    if missing:
        errors.append(f"Missing move_request statuses: {sorted(missing)}")

    return errors


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate Atlas seed fixtures via OpenAI.")
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help=f"Path to write the fixture JSON (default: {DEFAULT_OUTPUT}).",
    )
    args = parser.parse_args()

    load_dotenv()

    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        sys.exit("Missing OPENAI_API_KEY environment variable.")

    model = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
    client = OpenAI(api_key=api_key)

    print(f"Requesting fixtures from model {model}...")
    completion = client.chat.completions.parse(
        model=model,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": USER_PROMPT},
        ],
        response_format=SeedData,
    )

    message = completion.choices[0].message
    if message.parsed is None:
        sys.exit(f"Model refused to produce fixtures: {message.refusal}")

    data = message.parsed
    errors = validate_cross_references(data)
    if errors:
        for err in errors:
            print(f"validation error: {err}", file=sys.stderr)
        sys.exit("Generated fixtures failed validation.")

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(data.model_dump(), indent=2) + "\n")
    print(
        f"Wrote {len(data.employees)} employees, {len(data.projects)} projects, "
        f"{len(data.move_requests)} move requests to {args.output}."
    )


if __name__ == "__main__":
    main()
