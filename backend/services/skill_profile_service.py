import json
import asyncio
from typing import Dict, Any

from clients import GitHubClient, get_openai_client
from schemas import (
    SkillProfile,
    SkillProfileSuggestRequest,
    StaffingSuggestion,
    RoleRequirement,
    ProjectStatus,
)


def suggest_skill_profile(
    project_id: int, payload: SkillProfileSuggestRequest
) -> StaffingSuggestion:
    # Use asyncio.run if this is called from a sync context
    return asyncio.run(_suggest_skill_profile_async(payload))


async def _suggest_skill_profile_async(
    payload: SkillProfileSuggestRequest,
) -> StaffingSuggestion:
    github_client = GitHubClient()
    owner, repo = github_client.parse_github_url(payload.github_repo_url)
    
    repo_info = await github_client.get_repository_info(owner, repo)
    
    system_prompt = f"""You are an expert CTO and staffing consultant.
Your task is to recommend a minimal, high-performing team composition for a software project.

HEURISTICS:
1. MINIMIZE HEADCOUNT: Suggest the fewest people possible to achieve the goals. Prefer full-stack roles over separate frontend/backend where appropriate.
2. MATCH STATUS TO SENIORITY:
   - NEW: Focus on "Leads" and senior architects to establish the foundation.
   - GROWTH: Balanced mix of Seniors and Mids to accelerate delivery.
   - MAINTENANCE: Minimal crew, mostly Mids/Juniors for stability and small updates.
3. SKILL LEVEL SCALE: 0-3 (0: None, 1: Basic, 2: Strong, 3: Expert).
4. JUSTIFY: Provide a clear reasoning for each role based on the repository content and project status.

OUTPUT FORMAT:
Return a JSON object with the following structure:
{{
  "roles": [
    {{
      "role_name": "string",
      "count": integer,
      "required_skills": {{ "skill_category": level_int }},
      "reasoning": "string"
    }}
  ],
  "summary": "string",
  "total_headcount": integer
}}

Skill categories available: android, ios, web, backend, infrastructure, ai.
"""

    user_content = f"""Project Status: {payload.project_status.value}
Task Description: {payload.task_description or "Not provided"}

Repository Metadata:
Name: {repo_info['name']}
Description: {repo_info['description']}
Primary Language: {repo_info['language']}
Topics: {', '.join(repo_info['topics'])}

File Tree (partial):
{chr(10).join(repo_info['file_tree'])}

README Content (partial):
{repo_info['readme'][:2000]}
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
    
    roles = [
        RoleRequirement(**role)
        for role in suggestion_data.get("roles", [])
    ]
    
    return StaffingSuggestion(
        roles=roles,
        summary=suggestion_data.get("summary", ""),
        total_headcount=suggestion_data.get("total_headcount", sum(r.count for r in roles))
    )


def save_skill_profile(project_id: int, skill_profile: SkillProfile) -> SkillProfile:
    raise NotImplementedError("Skill profile persistence is not implemented yet")
