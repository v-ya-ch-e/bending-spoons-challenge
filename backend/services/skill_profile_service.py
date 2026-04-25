import json
from collections.abc import Iterable

import httpx
from clients import GitHubClient, get_openai_client
from schemas import (
    ProjectPhase,
    RoleRequirement,
    Skills,
    SkillProfile,
    SkillProfileSuggestRequest,
    StaffingSuggestion,
)


ALLOWED_SKILL_KEYS = set(Skills.model_fields.keys())


async def suggest_skill_profile(
    project_id: int, payload: SkillProfileSuggestRequest
) -> StaffingSuggestion:
    github_client = GitHubClient()
    repository_urls = normalize_repository_urls(
        [*payload.github_repo_urls, payload.github_repo_url]
    )

    repo_infos = []
    for repository_url in repository_urls:
        owner, repo = github_client.parse_github_url(repository_url)
        try:
            repo_infos.append(await github_client.get_repository_info(owner, repo))
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 404:
                raise ValueError(
                    f"GitHub repository was not found or is not accessible: {repository_url}"
                ) from exc

            raise

    system_prompt = f"""You are an expert CTO and staffing consultant.
Your task is to recommend a minimal, high-performing team composition for a software project.

HEURISTICS:
1. MINIMIZE HEADCOUNT: Suggest the fewest people possible to achieve the goals. Prefer full-stack roles over separate frontend/backend where appropriate.
2. MATCH PHASE TO SENIORITY:
   - new acquisition: Focus on "Leads" and senior architects to establish the foundation.
   - growth: Balanced mix of Seniors and Mids to accelerate delivery.
   - maintenance: Minimal crew, mostly Mids/Juniors for stability and small updates.
3. SKILL LEVEL SCALE: 0-3:
   - 0: No experience / not currently relevant
   - 1: Basic familiarity / can contribute with support
   - 2: Strong working capability / can work independently
   - 3: Expert / can lead, review, and onboard others
4. JUSTIFY: Provide a clear reasoning for each role based on the repository content and project phase.
5. MULTI-REPO CONTEXT: When multiple repositories are provided, recommend one combined minimum team for the whole project. Avoid duplicate roles unless each role adds distinct coverage.

ALLOWED SKILL KEYS (use ALL six in every required_skills object, default unused ones to 0):
- android
- ios
- web
- backend
- infrastructure
- ai

OUTPUT FORMAT:
Return a JSON object with the following structure:
{{
  "roles": [
    {{
      "role_name": "string",
      "count": 1,
      "required_skills": {{
        "android": 0,
        "ios": 0,
        "web": 0,
        "backend": 3,
        "infrastructure": 0,
        "ai": 2
      }},
      "reasoning": "Reasoning must reference specific repo files or project phase."
    }}
  ],
  "summary": "Overall staffing strategy summary.",
  "total_headcount": 1
}}

CRITICAL: In "required_skills", use ONLY the exact six keys listed above (lowercase). Do not invent keys like "security", "design", or "product".
"""

    repository_context = "\n\n".join(
        format_repository_context(repo_info, index + 1)
        for index, repo_info in enumerate(repo_infos)
    )

    user_content = f"""Project Phase: {payload.project_phase.value}
Task Description: {payload.task_description or "Not provided"}

Repositories to analyze:
{repository_context}
"""

    client = get_openai_client()
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
        response_format={"type": "json_object"},
    )

    suggestion_data = json.loads(response.choices[0].message.content)

    roles: list[RoleRequirement] = []
    for role_data in suggestion_data.get("roles", []):
        raw_skills = role_data.get("required_skills", {})
        normalized_skills = {key: 0 for key in ALLOWED_SKILL_KEYS}
        for key, level in raw_skills.items():
            if key in ALLOWED_SKILL_KEYS:
                normalized_skills[key] = level
        role_data["required_skills"] = Skills(**normalized_skills)
        roles.append(RoleRequirement(**role_data))

    return StaffingSuggestion(
        roles=roles,
        summary=suggestion_data.get("summary", ""),
        total_headcount=suggestion_data.get(
            "total_headcount", sum(r.count for r in roles)
        ),
    )


def normalize_repository_urls(values: Iterable[str | None]) -> list[str]:
    repository_urls: list[str] = []
    seen: set[str] = set()

    for value in values:
        if not value:
            continue

        trimmed_value = value.strip()
        if not trimmed_value or trimmed_value in seen:
            continue

        repository_urls.append(trimmed_value)
        seen.add(trimmed_value)

    if not repository_urls:
        raise ValueError("At least one GitHub repository URL is required")

    return repository_urls


def format_repository_context(repo_info: dict, index: int) -> str:
    return f"""Repository {index}
Name: {repo_info['name']}
Description: {repo_info['description']}
Primary Language: {repo_info['language']}
Topics: {', '.join(repo_info['topics'])}

File Tree (partial):
{chr(10).join(repo_info['file_tree'])}

README Content (partial):
{repo_info['readme'][:2000]}"""


def save_skill_profile(project_id: int, skill_profile: SkillProfile) -> SkillProfile:
    raise NotImplementedError("Skill profile persistence is not implemented yet")


__all__ = ["ProjectPhase", "save_skill_profile", "suggest_skill_profile"]
