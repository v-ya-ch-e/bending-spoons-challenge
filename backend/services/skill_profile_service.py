import json
from typing import Dict, Any

from clients import GitHubClient, get_openai_client
from schemas import (
    SkillProfile,
    SkillProfileSuggestRequest,
    StaffingSuggestion,
    RoleRequirement,
    ProjectStatus,
)


async def suggest_skill_profile(
    project_id: int, payload: SkillProfileSuggestRequest
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
3. SKILL LEVEL SCALE: 0-3:
   - 0: No experience / not currently relevant
   - 1: Basic familiarity / can contribute with support
   - 2: Strong working capability / can work independently
   - 3: Expert / can lead, review, and onboard others
4. JUSTIFY: Provide a clear reasoning for each role based on the repository content and project status.

ALLOWED SKILL CATEGORIES: 
- Android
- iOS
- Backend
- Web
- Infrastructure
- AI/ML

OUTPUT FORMAT:
Return a JSON object with the following structure:
{{
  "roles": [
    {{
      "role_name": "string",
      "count": 1,
      "required_skills": {{
        "Backend": 3,
        "AI/ML": 2
      }},
      "reasoning": "Reasoning must reference specific repo files or project status."
    }}
  ],
  "summary": "Overall staffing strategy summary.",
  "total_headcount": 1
}}

CRITICAL: In "required_skills", use ONLY the exact keys from the ALLOWED SKILL CATEGORIES list. Do not invent categories like "Security", "Design", or "Product".
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
    
    # Filter and validate roles to ensure strict adherence to allowed skill categories
    allowed_categories = {"Android", "iOS", "Backend", "Web", "Infrastructure", "AI/ML"}
    roles = []
    for role_data in suggestion_data.get("roles", []):
        if "required_skills" in role_data:
            # Only keep allowed categories, ignore others like 'Security' to avoid validation errors
            role_data["required_skills"] = {
                k: v for k, v in role_data["required_skills"].items()
                if k in allowed_categories
            }
        roles.append(RoleRequirement(**role_data))
    
    return StaffingSuggestion(
        roles=roles,
        summary=suggestion_data.get("summary", ""),
        total_headcount=suggestion_data.get("total_headcount", sum(r.count for r in roles))
    )


def save_skill_profile(project_id: int, skill_profile: SkillProfile) -> SkillProfile:
    raise NotImplementedError("Skill profile persistence is not implemented yet")
