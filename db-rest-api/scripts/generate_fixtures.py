"""Generate Atlas demo fixtures using the OpenAI API."""

from __future__ import annotations

import argparse
import json
import os
import sys
from collections import Counter
from pathlib import Path
from typing import Literal

from dotenv import load_dotenv
from openai import OpenAI
from pydantic import BaseModel, ConfigDict, Field

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUTPUT = Path(__file__).resolve().parent.parent / "fixtures" / "seed_data.json"
DEFAULT_EMPLOYEE_COUNT = 20
DEFAULT_PROJECT_COUNT = 8
DEFAULT_MOVE_REQUEST_COUNT = 12
DEFAULT_ATTEMPTS = 3
DEFAULT_MODEL = "gpt-4o-mini"
DEFAULT_TIMEOUT_SECONDS = 90.0
PROJECT_PHASES = ("new acquisition", "growth", "maintenance")
MOVE_STATUSES = ("pending", "accepted", "rejected", "clarification_requested")


class StrictBaseModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Skills(StrictBaseModel):
    android: int = Field(ge=0, le=3)
    ios: int = Field(ge=0, le=3)
    web: int = Field(ge=0, le=3)
    backend: int = Field(ge=0, le=3)
    infrastructure: int = Field(ge=0, le=3)
    ai: int = Field(ge=0, le=3)


class Employee(StrictBaseModel):
    name: str
    role: str
    current_project: str | None
    skills: Skills
    preferences: list[str] = Field(max_length=3)
    interests: list[str] = Field(min_length=2, max_length=4)


class Project(StrictBaseModel):
    project_name: str
    project_description: str
    project_phase: Literal["new acquisition", "growth", "maintenance"]
    current_team_members: list[str]
    required_people_amount: int = Field(ge=0)
    required_skills: Skills
    github_repositories: list[str] = Field(min_length=1, max_length=3)


class MoveRequest(StrictBaseModel):
    employee_name: str
    from_project_name: str | None
    to_project_name: str
    reason: str
    expected_role: str
    current_project_impact: Literal["low", "medium", "high"]
    status: Literal["pending", "accepted", "rejected", "clarification_requested"]


class SeedData(StrictBaseModel):
    employees: list[Employee]
    projects: list[Project]
    move_requests: list[MoveRequest]


class ProjectBatch(StrictBaseModel):
    projects: list[Project]


class EmployeeBatch(StrictBaseModel):
    employees: list[Employee]


class MoveRequestBatch(StrictBaseModel):
    move_requests: list[MoveRequest]


SYSTEM_PROMPT = """You are generating realistic seed data for an internal Bending Spoons platform called Atlas that manages dynamic project staffing. Produce a varied, believable dataset that fits the company context: an Italian tech company that buys and runs many consumer apps.

Hard requirements:
- Use only the JSON shape defined by the response schema; do not invent extra fields.
- Skill levels are integers from 0 to 3, where 0 means no experience and 3 means expert. Use the keys android, ios, web, backend, infrastructure, ai exactly.
- project_phase must be one of: "new acquisition", "growth", "maintenance", and the dataset must include every phase at least once.
- move_requests current_project_impact must be one of: "low", "medium", "high".
- move_requests status must cover all four values: "pending", "accepted", "rejected", "clarification_requested".
- Every employee.current_project must be either null or match a project_name from projects.
- Every project.current_team_members entry must match an employee name from employees.
- Project membership must be symmetric: if an employee has current_project set, that employee must appear in that project's current_team_members; if a project lists a member, that employee's current_project must be that project.
- Every employee.preferences entry must match a project_name from projects.
- Every move_request.employee_name must match an employee name; from_project_name (if not null) and to_project_name must match a project_name.
- A move request's from_project_name must match that employee's current_project, and to_project_name must be different from from_project_name.
- Vary roles, seniority, skill profiles, project mixes, and staffing gaps. Include multiple acquired-company projects in the "new acquisition" phase when the requested project count allows it.
"""


def positive_int(value: str) -> int:
    parsed = int(value)
    if parsed < 1:
        raise argparse.ArgumentTypeError("must be a positive integer")
    return parsed


def build_project_prompt(project_count: int) -> str:
    return f"""Generate exactly {project_count} projects.

Project guidance:
- Span all three project_phase values: "new acquisition", "growth", and "maintenance".
- Use a mix of internal platforms, scaled consumer apps, growth products, and recent acquisitions.
- Set current_team_members to an empty array for every project; employees will be generated in a later step.
- Set required_people_amount to the number of additional people the project still needs, not total team size.
- Each project should have 1-3 github_repositories formatted as "https://github.com/bendingspoons/<repo-slug>"."""


def build_employee_prompt(
    employee_count: int,
    projects: list[Project],
    existing_employee_names: list[str],
) -> str:
    project_names = [project.project_name for project in projects]
    project_context = [
        {
            "project_name": project.project_name,
            "project_phase": project.project_phase,
            "required_skills": project.required_skills.model_dump(),
        }
        for project in projects
    ]
    return f"""Generate exactly {employee_count} employees.

Available projects:
{json.dumps(project_context, indent=2)}

Existing employee names to avoid:
{existing_employee_names}

Employee guidance:
- Use only these project names for current_project and preferences: {project_names}.
- Assign at least one employee to every project.
- Assign most employees to a current_project, but leave a few employees unassigned by setting current_project to null.
- Do not reuse any existing employee name.
- Use varied roles across iOS, Android, web, backend, infrastructure, AI/ML, product engineering, tech lead, and engineering manager profiles.
- Use realistic European/international names.
- Each preferences list should contain 1-3 project names from the available project list.
- Each interests list should contain 2-4 short keyword phrases."""


def build_move_request_prompt(
    move_request_count: int,
    projects: list[Project],
    employees: list[Employee],
) -> str:
    project_names = [project.project_name for project in projects]
    employee_context = [
        {
            "name": employee.name,
            "role": employee.role,
            "current_project": employee.current_project,
            "skills": employee.skills.model_dump(),
            "preferences": employee.preferences,
        }
        for employee in employees
    ]
    return f"""Generate exactly {move_request_count} move_requests.

Available projects:
{project_names}

Available employees:
{json.dumps(employee_context, indent=2)}

Move-request guidance:
- Use only employee names from the available employees list.
- Use only project names from the available projects list.
- Cover all four status values: "pending", "accepted", "rejected", "clarification_requested".
- For each request, from_project_name must match the employee's current_project. If current_project is null, from_project_name must be null.
- to_project_name must be different from from_project_name.
- Make reasons specific and grounded in the employee's skills, preferences, and the target project's needs.
- Make some requests low impact because the source project is stable, and some medium/high impact because a key skill would leave."""


def duplicates(values: list[str]) -> list[str]:
    return sorted(value for value, count in Counter(values).items() if count > 1)


def normalize_seed_data(data: SeedData) -> None:
    """Use employees as the source of truth for denormalized team membership."""
    members_by_project = {project.project_name: [] for project in data.projects}

    for employee in data.employees:
        if employee.current_project == "null":
            employee.current_project = None
    for request in data.move_requests:
        if request.from_project_name == "null":
            request.from_project_name = None

    employee_projects = {
        employee.name: employee.current_project for employee in data.employees
    }

    for employee in data.employees:
        if employee.current_project in members_by_project:
            members_by_project[employee.current_project].append(employee.name)

    for project in data.projects:
        project.current_team_members = members_by_project[project.project_name]

    for request in data.move_requests:
        if request.employee_name in employee_projects:
            request.from_project_name = employee_projects[request.employee_name]


def ensure_project_staffing(employees: list[Employee], projects: list[Project]) -> None:
    project_names = [project.project_name for project in projects]
    if not project_names:
        return

    for index, project_name in enumerate(project_names):
        has_member = any(
            employee.current_project == project_name for employee in employees
        )
        if has_member:
            continue

        unassigned = next(
            (employee for employee in employees if employee.current_project is None),
            None,
        )
        if unassigned is not None:
            unassigned.current_project = project_name
            continue

        source_project_counts = Counter(
            employee.current_project
            for employee in employees
            if employee.current_project is not None
        )
        source_project = next(
            (
                name
                for name, _ in source_project_counts.most_common()
                if name != project_name and source_project_counts[name] > 1
            ),
            None,
        )
        if source_project is None:
            employees[index % len(employees)].current_project = project_name
            continue

        employee_to_move = next(
            employee
            for employee in employees
            if employee.current_project == source_project
        )
        employee_to_move.current_project = project_name


def dedupe_employees(employees: list[Employee]) -> list[Employee]:
    unique_employees = []
    seen_names = set()
    for employee in employees:
        if employee.name in seen_names:
            continue
        seen_names.add(employee.name)
        unique_employees.append(employee)
    return unique_employees


def validate_seed_data(
    data: SeedData,
    expected_employee_count: int,
    expected_project_count: int,
    expected_move_request_count: int,
) -> list[str]:
    errors: list[str] = []
    employee_names = [employee.name for employee in data.employees]
    project_names = [project.project_name for project in data.projects]
    employee_name_set = set(employee_names)
    project_name_set = set(project_names)
    employee_projects = {
        employee.name: employee.current_project for employee in data.employees
    }
    project_members = {
        project.project_name: set(project.current_team_members) for project in data.projects
    }

    if len(data.employees) != expected_employee_count:
        errors.append(
            f"Expected {expected_employee_count} employees, got {len(data.employees)}"
        )
    if len(data.projects) != expected_project_count:
        errors.append(f"Expected {expected_project_count} projects, got {len(data.projects)}")
    if len(data.move_requests) != expected_move_request_count:
        errors.append(
            f"Expected {expected_move_request_count} move_requests, "
            f"got {len(data.move_requests)}"
        )

    for name in duplicates(employee_names):
        errors.append(f"Duplicate employee name: {name!r}")
    for name in duplicates(project_names):
        errors.append(f"Duplicate project name: {name!r}")

    phases_seen = {project.project_phase for project in data.projects}
    missing_phases = set(PROJECT_PHASES) - phases_seen
    if missing_phases:
        errors.append(f"Missing project phases: {sorted(missing_phases)}")

    for employee in data.employees:
        if employee.current_project is not None and employee.current_project not in project_name_set:
            errors.append(
                f"Employee {employee.name!r} references unknown project "
                f"{employee.current_project!r}"
            )
        for preference in employee.preferences:
            if preference not in project_name_set:
                errors.append(
                    f"Employee {employee.name!r} has unknown preference {preference!r}"
                )

    for project in data.projects:
        if not project.current_team_members:
            errors.append(f"Project {project.project_name!r} has no current team members")
        for member in project.current_team_members:
            if member not in employee_name_set:
                errors.append(
                    f"Project {project.project_name!r} lists unknown member {member!r}"
                )
                continue
            if employee_projects[member] != project.project_name:
                errors.append(
                    f"Project {project.project_name!r} lists {member!r}, but that "
                    f"employee.current_project is {employee_projects[member]!r}"
                )
        for repo in project.github_repositories:
            if not repo.startswith("https://github.com/bendingspoons/"):
                errors.append(
                    f"Project {project.project_name!r} has invalid GitHub repo URL {repo!r}"
                )

    for employee in data.employees:
        if employee.current_project is None:
            continue
        members = project_members.get(employee.current_project, set())
        if employee.name not in members:
            errors.append(
                f"Employee {employee.name!r} has current_project "
                f"{employee.current_project!r} but is not listed on that project"
            )

    statuses_seen = set()
    for request in data.move_requests:
        statuses_seen.add(request.status)
        employee_project = employee_projects.get(request.employee_name)
        if request.employee_name not in employee_name_set:
            errors.append(
                f"Move request references unknown employee {request.employee_name!r}"
            )
        if request.from_project_name is not None and request.from_project_name not in project_name_set:
            errors.append(
                f"Move request references unknown from_project "
                f"{request.from_project_name!r}"
            )
        if request.to_project_name not in project_name_set:
            errors.append(
                f"Move request references unknown to_project {request.to_project_name!r}"
            )
        if request.employee_name in employee_name_set and request.from_project_name != employee_project:
            errors.append(
                f"Move request for {request.employee_name!r} has from_project_name "
                f"{request.from_project_name!r}, but employee.current_project is "
                f"{employee_project!r}"
            )
        if request.from_project_name == request.to_project_name:
            errors.append(
                f"Move request for {request.employee_name!r} targets the same project "
                f"{request.to_project_name!r}"
            )

    missing_statuses = set(MOVE_STATUSES) - statuses_seen
    if missing_statuses:
        errors.append(f"Missing move_request statuses: {sorted(missing_statuses)}")

    return errors


def request_parsed(
    client: OpenAI,
    model: str,
    prompt: str,
    temperature: float,
    response_format: type[StrictBaseModel],
) -> StrictBaseModel:
    completion = client.chat.completions.parse(
        model=model,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        response_format=response_format,
        temperature=temperature,
    )

    message = completion.choices[0].message
    if message.parsed is None:
        sys.exit(f"Model refused to produce fixtures: {message.refusal}")
    return message.parsed


def log_errors(errors: list[str]) -> None:
    for err in errors:
        print(f"validation error: {err}", file=sys.stderr)


def request_employees(
    client: OpenAI,
    model: str,
    projects: list[Project],
    employee_count: int,
    attempts: int,
    temperature: float,
) -> list[Employee]:
    employees: list[Employee] = []
    max_calls = attempts * ((employee_count + 9) // 10 + 1)

    for call_number in range(1, max_calls + 1):
        remaining = employee_count - len(employees)
        if remaining <= 0:
            return employees[:employee_count]

        chunk_size = min(10, remaining)
        print(
            f"Requesting {chunk_size} employees from model {model} "
            f"(batch {call_number}/{max_calls})..."
        )
        batch = request_parsed(
            client,
            model,
            build_employee_prompt(
                chunk_size,
                projects,
                [employee.name for employee in employees],
            ),
            temperature,
            EmployeeBatch,
        )
        employees.extend(batch.employees)
        employees = dedupe_employees(employees)

    return employees[:employee_count]


def generate_seed_data(
    client: OpenAI,
    model: str,
    employee_count: int,
    project_count: int,
    move_request_count: int,
    attempts: int,
    temperature: float,
) -> SeedData:
    for attempt in range(1, attempts + 1):
        print(
            f"Requesting projects from model {model} "
            f"(attempt {attempt}/{attempts})..."
        )
        projects_batch = request_parsed(
            client,
            model,
            build_project_prompt(project_count),
            temperature,
            ProjectBatch,
        )
        projects = projects_batch.projects

        project_data = SeedData(employees=[], projects=projects, move_requests=[])
        project_errors = validate_seed_data(
            project_data,
            expected_employee_count=0,
            expected_project_count=project_count,
            expected_move_request_count=0,
        )
        project_errors = [
            error
            for error in project_errors
            if "has no current team members" not in error
            and "Missing move_request statuses" not in error
        ]
        if project_errors:
            log_errors(project_errors)
            continue

        employees = request_employees(
            client,
            model,
            projects,
            employee_count,
            attempts,
            temperature,
        )
        ensure_project_staffing(employees, projects)

        partial_data = SeedData(
            employees=employees,
            projects=projects,
            move_requests=[],
        )
        normalize_seed_data(partial_data)
        employee_errors = validate_seed_data(
            partial_data,
            expected_employee_count=employee_count,
            expected_project_count=project_count,
            expected_move_request_count=0,
        )
        employee_errors = [
            error
            for error in employee_errors
            if "Missing move_request statuses" not in error
        ]
        if employee_errors:
            log_errors(employee_errors)
            continue

        print(
            f"Requesting move requests from model {model} "
            f"(attempt {attempt}/{attempts})..."
        )
        move_requests_batch = request_parsed(
            client,
            model,
            build_move_request_prompt(move_request_count, projects, employees),
            temperature,
            MoveRequestBatch,
        )

        data = SeedData(
            employees=employees,
            projects=projects,
            move_requests=move_requests_batch.move_requests,
        )
        normalize_seed_data(data)
        errors = validate_seed_data(
            data,
            expected_employee_count=employee_count,
            expected_project_count=project_count,
            expected_move_request_count=move_request_count,
        )
        if not errors:
            return data

        log_errors(errors)

    sys.exit("Generated fixtures failed validation.")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate Atlas seed fixtures via OpenAI.")
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help=f"Path to write the fixture JSON (default: {DEFAULT_OUTPUT}).",
    )
    parser.add_argument(
        "--employees",
        type=positive_int,
        default=DEFAULT_EMPLOYEE_COUNT,
        help=f"Number of employees to generate (default: {DEFAULT_EMPLOYEE_COUNT}).",
    )
    parser.add_argument(
        "--projects",
        type=positive_int,
        default=DEFAULT_PROJECT_COUNT,
        help=f"Number of projects to generate (default: {DEFAULT_PROJECT_COUNT}).",
    )
    parser.add_argument(
        "--move-requests",
        type=positive_int,
        default=DEFAULT_MOVE_REQUEST_COUNT,
        help=(
            "Number of move requests to generate "
            f"(default: {DEFAULT_MOVE_REQUEST_COUNT})."
        ),
    )
    parser.add_argument(
        "--attempts",
        type=positive_int,
        default=DEFAULT_ATTEMPTS,
        help=f"Maximum generation attempts if validation fails (default: {DEFAULT_ATTEMPTS}).",
    )
    parser.add_argument(
        "--model",
        default=os.environ.get("OPENAI_MODEL", DEFAULT_MODEL),
        help=f"OpenAI model to use (default: env OPENAI_MODEL or {DEFAULT_MODEL}).",
    )
    parser.add_argument(
        "--temperature",
        type=float,
        default=0.7,
        help="Sampling temperature for varied demo data (default: 0.7).",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=DEFAULT_TIMEOUT_SECONDS,
        help=(
            "OpenAI request timeout in seconds "
            f"(default: {DEFAULT_TIMEOUT_SECONDS:g})."
        ),
    )
    args = parser.parse_args()

    if args.projects < len(PROJECT_PHASES):
        parser.error(f"--projects must be at least {len(PROJECT_PHASES)}")
    if args.move_requests < len(MOVE_STATUSES):
        parser.error(f"--move-requests must be at least {len(MOVE_STATUSES)}")
    if args.employees < args.projects:
        parser.error("--employees must be greater than or equal to --projects")

    return args


def main() -> None:
    args = parse_args()

    load_dotenv(REPO_ROOT / ".env")

    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        sys.exit("Missing OPENAI_API_KEY environment variable.")

    client = OpenAI(api_key=api_key, timeout=args.timeout)
    data = generate_seed_data(
        client=client,
        model=args.model,
        employee_count=args.employees,
        project_count=args.projects,
        move_request_count=args.move_requests,
        attempts=args.attempts,
        temperature=args.temperature,
    )

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(data.model_dump(), indent=2) + "\n")
    print(
        f"Wrote {len(data.employees)} employees, {len(data.projects)} projects, "
        f"{len(data.move_requests)} move requests to {args.output}."
    )


if __name__ == "__main__":
    main()
