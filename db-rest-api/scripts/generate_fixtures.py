"""Generate Atlas demo fixtures using the OpenAI API."""

from __future__ import annotations

import argparse
import json
import os
import sys
from collections import Counter
from pathlib import Path
from typing import Any, Literal

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
MOVE_STATUSES = (
    "pending",
    "accepted",
    "rejected",
    "clarification_requested",
    "transition_started",
    "completed",
)
APPROVAL_STATUSES = ("pending", "approved", "rejected")


class StrictBaseModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Skills(StrictBaseModel):
    android: int = Field(ge=0, le=3)
    ios: int = Field(ge=0, le=3)
    web: int = Field(ge=0, le=3)
    backend: int = Field(ge=0, le=3)
    infrastructure: int = Field(ge=0, le=3)
    ai: int = Field(ge=0, le=3)


class ProjectSkillRequirement(StrictBaseModel):
    level_1: int = Field(ge=0)
    level_2: int = Field(ge=0)
    level_3: int = Field(ge=0)


class ProjectSkillRequirements(StrictBaseModel):
    android: ProjectSkillRequirement
    ios: ProjectSkillRequirement
    web: ProjectSkillRequirement
    backend: ProjectSkillRequirement
    infrastructure: ProjectSkillRequirement
    ai: ProjectSkillRequirement


class Employee(StrictBaseModel):
    name: str
    role: str
    github_username: str | None = None
    github_username: str | None = None
    current_projects: list[str] = Field(max_length=3)
    skills: Skills
    preferences: list[str] = Field(max_length=3)
    interests: list[str] = Field(min_length=2, max_length=4)


class Project(StrictBaseModel):
    project_name: str
    project_description: str
    project_phase: Literal["new acquisition", "growth", "maintenance"]
    icon_url: str
    poster_url: str
    required_people_amount: int = Field(ge=0)
    required_skills: ProjectSkillRequirements
    github_repositories: list[str] = Field(min_length=1, max_length=3)


class MoveRequest(StrictBaseModel):
    employee_name: str
    from_project_name: str | None
    to_project_name: str
    reason: str
    expected_role: str
    current_project_impact: Literal["low", "medium", "high"]
    status: Literal[
        "pending",
        "accepted",
        "rejected",
        "clarification_requested",
        "transition_started",
        "completed",
    ]
    cto_approval_status: Literal["pending", "approved", "rejected"] = "pending"
    employee_approval_status: Literal["pending", "approved", "rejected"] = "pending"


class SeedData(StrictBaseModel):
    employees: list[Employee]
    projects: list[Project]
    move_requests: list[MoveRequest]


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
- move_requests status must cover all six values: "pending", "accepted", "rejected", "clarification_requested", "transition_started", "completed".
- move_requests approval fields must match the status: pending/clarification_requested use pending approvals; accepted has exactly one approved side; rejected has at least one rejected side; transition_started/completed have both sides approved.
- Every employee.current_projects entry must match a project_name from projects.
- Every employee.preferences entry must match a project_name from projects.
- Every move_request.employee_name must match an employee name; from_project_name (if not null) and to_project_name must match a project_name.
- A non-completed move request's from_project_name must be one of that employee's current_projects, and to_project_name must be different from from_project_name. A completed request should reflect the already-migrated assignment, so the employee should be assigned to to_project_name.
- Every employee.github_username must be a unique, realistic mock GitHub username using only letters, numbers, and hyphens.
- Vary roles, seniority, skill profiles, project mixes, and staffing gaps.
"""


def favicon_url(domain: str) -> str:
    return f"https://www.google.com/s2/favicons?domain={domain}&sz=128"


def poster_url(product_url: str) -> str:
    return f"https://image.thum.io/get/width/1200/crop/630/{product_url}"


PRODUCT_CATALOG: list[dict[str, Any]] = [
    {
        "project_name": "Evernote",
        "project_description": "Personal productivity and note-taking app focused on fast sync, collaborative editing, AI-powered search, and reliable capture across devices.",
        "project_phase": "growth",
        "domain": "evernote.com",
        "product_url": "https://evernote.com",
        "required_people_amount": 5,
        "required_skills": {"android": 2, "ios": 2, "web": 3, "backend": 3, "infrastructure": 2, "ai": 2},
        "github_repositories": ["https://github.com/bendingspoons/evernote-core", "https://github.com/bendingspoons/evernote-sync"],
    },
    {
        "project_name": "Remini",
        "project_description": "AI photo enhancement and generation product for restoring blurry images, creating professional portraits, and scaling generative image models.",
        "project_phase": "growth",
        "domain": "remini.ai",
        "product_url": "https://remini.ai",
        "required_people_amount": 6,
        "required_skills": {"android": 2, "ios": 2, "web": 2, "backend": 3, "infrastructure": 3, "ai": 3},
        "github_repositories": ["https://github.com/bendingspoons/remini-app", "https://github.com/bendingspoons/remini-ml"],
    },
    {
        "project_name": "WeTransfer",
        "project_description": "Creative file-sharing platform focused on large transfer reliability, faster upload flows, expired-transfer recovery, and creator-friendly collaboration.",
        "project_phase": "growth",
        "domain": "wetransfer.com",
        "product_url": "https://wetransfer.com",
        "required_people_amount": 5,
        "required_skills": {"android": 1, "ios": 1, "web": 3, "backend": 3, "infrastructure": 3, "ai": 1},
        "github_repositories": ["https://github.com/bendingspoons/wetransfer-web", "https://github.com/bendingspoons/wetransfer-storage"],
    },
    {
        "project_name": "Meetup",
        "project_description": "Community platform for discovering groups, organizing events, and helping people meet around shared interests with modern mobile and web experiences.",
        "project_phase": "maintenance",
        "domain": "meetup.com",
        "product_url": "https://www.meetup.com",
        "required_people_amount": 3,
        "required_skills": {"android": 2, "ios": 2, "web": 2, "backend": 2, "infrastructure": 1, "ai": 1},
        "github_repositories": ["https://github.com/bendingspoons/meetup-app", "https://github.com/bendingspoons/meetup-events"],
    },
    {
        "project_name": "Komoot",
        "project_description": "Outdoor route-planning product for hiking and cycling, with offline maps, sport-specific routing, and strong wearable integrations.",
        "project_phase": "growth",
        "domain": "komoot.com",
        "product_url": "https://www.komoot.com",
        "required_people_amount": 4,
        "required_skills": {"android": 3, "ios": 3, "web": 2, "backend": 2, "infrastructure": 2, "ai": 1},
        "github_repositories": ["https://github.com/bendingspoons/komoot-mobile", "https://github.com/bendingspoons/komoot-routing"],
    },
    {
        "project_name": "StreamYard",
        "project_description": "Browser-based live streaming and recording studio for creators and businesses, including 4K local recordings and AI-assisted editing workflows.",
        "project_phase": "maintenance",
        "domain": "streamyard.com",
        "product_url": "https://streamyard.com",
        "required_people_amount": 4,
        "required_skills": {"android": 0, "ios": 1, "web": 3, "backend": 3, "infrastructure": 3, "ai": 2},
        "github_repositories": ["https://github.com/bendingspoons/streamyard-studio", "https://github.com/bendingspoons/streamyard-recording"],
    },
    {
        "project_name": "Brightcove",
        "project_description": "Enterprise video platform for live streaming, video hosting, monetization, DRM, vertical video, and AI-assisted publishing workflows.",
        "project_phase": "new acquisition",
        "domain": "brightcove.com",
        "product_url": "https://www.brightcove.com",
        "required_people_amount": 5,
        "required_skills": {"android": 1, "ios": 1, "web": 3, "backend": 3, "infrastructure": 3, "ai": 2},
        "github_repositories": ["https://github.com/bendingspoons/brightcove-video", "https://github.com/bendingspoons/brightcove-ai"],
    },
    {
        "project_name": "Eventbrite",
        "project_description": "Event discovery and ticketing marketplace undergoing initial integration work around organizer tooling, search, payments, and attendee mobile flows.",
        "project_phase": "new acquisition",
        "domain": "eventbrite.com",
        "product_url": "https://www.eventbrite.com",
        "required_people_amount": 6,
        "required_skills": {"android": 2, "ios": 2, "web": 3, "backend": 3, "infrastructure": 2, "ai": 1},
        "github_repositories": ["https://github.com/bendingspoons/eventbrite-marketplace", "https://github.com/bendingspoons/eventbrite-payments"],
    },
    {
        "project_name": "Vimeo",
        "project_description": "Video creation, hosting, and collaboration product focused on AI captions, language expansion, team workflows, and high-quality playback.",
        "project_phase": "new acquisition",
        "domain": "vimeo.com",
        "product_url": "https://vimeo.com",
        "required_people_amount": 6,
        "required_skills": {"android": 1, "ios": 2, "web": 3, "backend": 3, "infrastructure": 3, "ai": 2},
        "github_repositories": ["https://github.com/bendingspoons/vimeo-video", "https://github.com/bendingspoons/vimeo-ai"],
    },
    {
        "project_name": "AOL",
        "project_description": "Consumer internet and mail product portfolio in early improvement work across account reliability, web surfaces, mobile clients, and legacy modernization.",
        "project_phase": "new acquisition",
        "domain": "aol.com",
        "product_url": "https://www.aol.com",
        "required_people_amount": 5,
        "required_skills": {"android": 1, "ios": 1, "web": 3, "backend": 3, "infrastructure": 3, "ai": 1},
        "github_repositories": ["https://github.com/bendingspoons/aol-mail", "https://github.com/bendingspoons/aol-platform"],
    },
    {
        "project_name": "Splice",
        "project_description": "Mobile video editor for quick, polished content creation with creator-friendly templates, media editing tools, and subscription growth experiments.",
        "project_phase": "maintenance",
        "domain": "spliceapp.com",
        "product_url": "https://spliceapp.com",
        "required_people_amount": 3,
        "required_skills": {"android": 2, "ios": 3, "web": 1, "backend": 2, "infrastructure": 1, "ai": 1},
        "github_repositories": ["https://github.com/bendingspoons/splice-editor", "https://github.com/bendingspoons/splice-media"],
    },
    {
        "project_name": "Issuu",
        "project_description": "Digital publishing platform for transforming documents into shareable web publications, marketing assets, and reader analytics.",
        "project_phase": "maintenance",
        "domain": "issuu.com",
        "product_url": "https://issuu.com",
        "required_people_amount": 3,
        "required_skills": {"android": 1, "ios": 1, "web": 3, "backend": 2, "infrastructure": 2, "ai": 1},
        "github_repositories": ["https://github.com/bendingspoons/issuu-reader", "https://github.com/bendingspoons/issuu-publishing"],
    },
]


def project_skill_requirements(levels: dict[str, int]) -> dict[str, dict[str, int]]:
    return {
        skill: {
            "level_1": 1 if level == 1 else 0,
            "level_2": 1 if level == 2 else 0,
            "level_3": 1 if level == 3 else 0,
        }
        for skill, level in levels.items()
    }


def build_curated_projects(project_count: int) -> list[Project]:
    selected_products = PRODUCT_CATALOG[:project_count]
    return [
        Project(
            project_name=product["project_name"],
            project_description=product["project_description"],
            project_phase=product["project_phase"],
            icon_url=favicon_url(product["domain"]),
            poster_url=poster_url(product["product_url"]),
            required_people_amount=product["required_people_amount"],
            required_skills=ProjectSkillRequirements(
                **project_skill_requirements(product["required_skills"])
            ),
            github_repositories=product["github_repositories"],
        )
        for product in selected_products
    ]


def positive_int(value: str) -> int:
    parsed = int(value)
    if parsed < 1:
        raise argparse.ArgumentTypeError("must be a positive integer")
    return parsed


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
- Use only these project names for current_projects and preferences: {project_names}.
- Assign at least one employee to every project.
- Assign most employees to 1-2 current_projects, but leave a few employees unassigned by setting current_projects to an empty array.
- Do not reuse any existing employee name.
- Generate a unique mock GitHub username for every employee.
- Use varied roles across iOS, Android, web, backend, infrastructure, AI/ML, product engineering, tech lead, and engineering manager profiles.
- Use realistic European/international names.
- Set github_username for every employee to a plausible bare GitHub handle derived from the name. Do not include @.
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
            "current_projects": employee.current_projects,
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
- Cover all six status values: "pending", "accepted", "rejected", "clarification_requested", "transition_started", "completed".
- Include cto_approval_status and employee_approval_status for every move request.
- For each non-completed request, from_project_name must be one of the employee's current_projects. If current_projects is empty, from_project_name must be null. For completed requests, the employee's current_projects should include to_project_name because the migration has already happened.
- to_project_name must be different from from_project_name.
- Make reasons specific and grounded in the employee's skills, preferences, and the target project's needs.
- Make some requests low impact because the source project is stable, and some medium/high impact because a key skill would leave."""


def duplicates(values: list[str]) -> list[str]:
    return sorted(value for value, count in Counter(values).items() if count > 1)


def default_github_username(name: str) -> str:
    parts = []
    for raw_part in name.lower().split():
        part = "".join(char for char in raw_part if char.isalnum())
        if part:
            parts.append(part)
    return "-".join(parts) or "github-user"


def normalize_seed_data(data: SeedData) -> None:
    """Normalize null-like values and keep move requests aligned with assignments."""
    for employee in data.employees:
        employee.github_username = (
            employee.github_username.strip().lstrip("@").strip()
            if employee.github_username
            else default_github_username(employee.name)
        )
        employee.current_projects = [
            project_name
            for project_name in employee.current_projects
            if project_name and project_name != "null"
        ]
    for request in data.move_requests:
        if request.from_project_name == "null":
            request.from_project_name = None

    employee_projects = {
        employee.name: set(employee.current_projects) for employee in data.employees
    }

    for request in data.move_requests:
        assigned_projects = employee_projects.get(request.employee_name, set())
        if not assigned_projects:
            request.from_project_name = None
        elif request.status != "completed" and request.from_project_name not in assigned_projects:
            request.from_project_name = sorted(assigned_projects)[0]


def ensure_project_staffing(employees: list[Employee], projects: list[Project]) -> None:
    project_names = [project.project_name for project in projects]
    if not project_names or not employees:
        return

    for index, project_name in enumerate(project_names):
        has_member = any(
            project_name in employee.current_projects for employee in employees
        )
        if has_member:
            continue

        employee = min(
            employees,
            key=lambda candidate: (len(candidate.current_projects), index % len(employees)),
        )
        employee.current_projects.append(project_name)


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
    github_usernames = [employee.github_username.lower() for employee in data.employees]
    project_names = [project.project_name for project in data.projects]
    employee_name_set = set(employee_names)
    project_name_set = set(project_names)
    employee_projects = {
        employee.name: set(employee.current_projects) for employee in data.employees
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
    for username in duplicates(github_usernames):
        errors.append(f"Duplicate employee GitHub username: {username!r}")
    for name in duplicates(project_names):
        errors.append(f"Duplicate project name: {name!r}")

    phases_seen = {project.project_phase for project in data.projects}
    missing_phases = set(PROJECT_PHASES) - phases_seen
    if missing_phases:
        errors.append(f"Missing project phases: {sorted(missing_phases)}")

    for employee in data.employees:
        for current_project in employee.current_projects:
            if current_project not in project_name_set:
                errors.append(
                    f"Employee {employee.name!r} references unknown project "
                    f"{current_project!r}"
                )
        for preference in employee.preferences:
            if preference not in project_name_set:
                errors.append(
                    f"Employee {employee.name!r} has unknown preference {preference!r}"
                )

    for project in data.projects:
        assigned_employees = [
            employee.name
            for employee in data.employees
            if project.project_name in employee.current_projects
        ]
        if not assigned_employees:
            errors.append(f"Project {project.project_name!r} has no current team members")
        if not project.icon_url.startswith("https://"):
            errors.append(f"Project {project.project_name!r} has invalid icon_url")
        if not project.poster_url.startswith("https://"):
            errors.append(f"Project {project.project_name!r} has invalid poster_url")
        for repo in project.github_repositories:
            if not repo.startswith("https://github.com/bendingspoons/"):
                errors.append(
                    f"Project {project.project_name!r} has invalid GitHub repo URL {repo!r}"
                )

    statuses_seen = set()
    for request in data.move_requests:
        statuses_seen.add(request.status)
        assigned_projects = employee_projects.get(request.employee_name, set())
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
        if (
            request.employee_name in employee_name_set
            and request.from_project_name is not None
            and request.from_project_name not in assigned_projects
            and request.status != "completed"
        ):
            errors.append(
                f"Move request for {request.employee_name!r} has from_project_name "
                f"{request.from_project_name!r}, but employee.current_projects are "
                f"{sorted(assigned_projects)!r}"
            )
        if request.employee_name in employee_name_set and not assigned_projects and request.from_project_name is not None:
            errors.append(
                f"Move request for unassigned employee {request.employee_name!r} "
                f"has from_project_name {request.from_project_name!r}"
            )
        if request.from_project_name == request.to_project_name:
            errors.append(
                f"Move request for {request.employee_name!r} targets the same project "
                f"{request.to_project_name!r}"
            )
        if (
            request.status == "completed"
            and request.employee_name in employee_name_set
            and request.to_project_name not in assigned_projects
        ):
            errors.append(
                f"Completed move request for {request.employee_name!r} targets "
                f"{request.to_project_name!r}, but employee is not assigned there"
            )
        approvals = {
            request.cto_approval_status,
            request.employee_approval_status,
        }
        if request.status in {"pending", "clarification_requested"} and approvals != {"pending"}:
            errors.append(
                f"Move request for {request.employee_name!r} has status "
                f"{request.status!r} but non-pending approvals"
            )
        if request.status == "accepted":
            approved_count = [
                request.cto_approval_status,
                request.employee_approval_status,
            ].count("approved")
            if approved_count != 1 or "rejected" in approvals:
                errors.append(
                    f"Accepted move request for {request.employee_name!r} must have exactly one approval"
                )
        if request.status == "rejected" and "rejected" not in approvals:
            errors.append(
                f"Rejected move request for {request.employee_name!r} must include a rejected approval"
            )
        if (
            request.status in {"transition_started", "completed"}
            and approvals != {"approved"}
        ):
            errors.append(
                f"{request.status!r} move request for {request.employee_name!r} must have both approvals"
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
    projects = build_curated_projects(project_count)
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
        sys.exit("Curated project fixtures failed validation.")

    for attempt in range(1, attempts + 1):
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
    if args.projects > len(PRODUCT_CATALOG):
        parser.error(f"--projects must be at most {len(PRODUCT_CATALOG)}")
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
