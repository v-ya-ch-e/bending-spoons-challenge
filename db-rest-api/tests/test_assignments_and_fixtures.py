from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path
from types import ModuleType

import pytest


ROOT = Path(__file__).resolve().parents[2]
DB_API_DIR = ROOT / "db-rest-api"


def load_module(module_name: str, path: Path) -> ModuleType:
    spec = importlib.util.spec_from_file_location(module_name, path)
    assert spec is not None
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


class RecordingCursor:
    def __init__(self) -> None:
        self.calls: list[tuple[str, tuple[object, ...]]] = []

    def execute(self, sql: str, params: tuple[object, ...] = ()) -> None:
        normalized_sql = " ".join(sql.split())
        self.calls.append((normalized_sql, params))


def test_project_assignment_sync_uses_join_table() -> None:
    pytest.importorskip("fastapi")
    pytest.importorskip("pymysql")
    api = load_module("db_rest_api_main", DB_API_DIR / "main.py")

    cursor = RecordingCursor()
    api.sync_project_members(cursor, project_id=7, employee_ids=[2, 4])

    assert cursor.calls == [
        ("DELETE FROM project_assignments WHERE project_id = %s", (7,)),
        (
            "INSERT INTO project_assignments (employee_id, project_id) VALUES (%s, %s)",
            (2, 7),
        ),
        (
            "INSERT INTO project_assignments (employee_id, project_id) VALUES (%s, %s)",
            (4, 7),
        ),
    ]


def test_serializers_expose_canonical_ids_and_legacy_names() -> None:
    pytest.importorskip("fastapi")
    pytest.importorskip("pymysql")
    api = load_module("db_rest_api_main", DB_API_DIR / "main.py")

    project = api.serialize_project(
        {
            "id": 1,
            "project_name": "Evernote",
            "project_description": "Notes and productivity.",
            "project_phase": "growth",
            "icon_url": "https://www.google.com/s2/favicons?domain=evernote.com&sz=128",
            "poster_url": "https://image.thum.io/get/width/1200/crop/630/https://evernote.com",
            "required_people_amount": 2,
            "required_skills": json.dumps(
                {
                    "android": 1,
                    "ios": 1,
                    "web": 3,
                    "backend": 3,
                    "infrastructure": 2,
                    "ai": 2,
                }
            ),
            "github_repositories": json.dumps(
                ["https://github.com/bendingspoons/evernote-core"]
            ),
        },
        current_team_member_ids=[10, 11],
        current_team_members=["Giulia Rossi", "Marco Bianchi"],
    )
    employee = api.serialize_employee(
        {
            "id": 10,
            "name": "Giulia Rossi",
            "role": "Backend Engineer",
            "skills": json.dumps(
                {
                    "android": 0,
                    "ios": 0,
                    "web": 2,
                    "backend": 3,
                    "infrastructure": 2,
                    "ai": 1,
                }
            ),
            "preferences": json.dumps(["Evernote"]),
            "interests": json.dumps(["sync reliability", "API design"]),
        },
        current_project_ids=[1, 2],
        current_project_names=["Evernote", "Remini"],
    )

    assert project["current_team_member_ids"] == [10, 11]
    assert project["current_team_members"] == ["Giulia Rossi", "Marco Bianchi"]
    assert project["required_skills"]["backend"] == {
        "level_1": 0,
        "level_2": 0,
        "level_3": 1,
    }
    assert project["required_skills"]["android"] == {
        "level_1": 1,
        "level_2": 0,
        "level_3": 0,
    }
    assert employee["current_project_ids"] == [1, 2]
    assert employee["current_project_names"] == ["Evernote", "Remini"]
    assert employee["current_project"] == "Evernote"


def test_checked_in_seed_data_matches_fixture_contract() -> None:
    pytest.importorskip("openai")
    generator = load_module(
        "generate_fixtures",
        DB_API_DIR / "scripts" / "generate_fixtures.py",
    )

    fixture_path = DB_API_DIR / "fixtures" / "seed_data.json"
    data = generator.SeedData.model_validate_json(fixture_path.read_text())
    generator.normalize_seed_data(data)

    errors = generator.validate_seed_data(
        data,
        expected_employee_count=20,
        expected_project_count=8,
        expected_move_request_count=12,
    )
    assert errors == []


def test_fixture_loader_rejects_noncanonical_skill_maps() -> None:
    loader = load_module(
        "load_fixtures_for_validation",
        DB_API_DIR / "scripts" / "load_fixtures.py",
    )

    data = {
        "projects": [
            {
                "project_name": "Broken",
                "required_skills": {
                    "android": {"level_1": 1},
                    "ios": 0,
                    "web": 0,
                    "backend": 0,
                    "infrastructure": 0,
                    "ai": 0,
                },
            }
        ],
        "employees": [
            {
                "name": "Valid Employee",
                "skills": {
                    "android": 0,
                    "ios": 0,
                    "web": 0,
                    "backend": 1,
                    "infrastructure": 0,
                    "ai": 0,
                },
            }
        ],
        "move_requests": [],
    }

    with pytest.raises(SystemExit):
        loader.validate_fixture_contract(data)
