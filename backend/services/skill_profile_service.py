import json

from clients import GitHubClient, get_openai_client
from schemas import Skills, SkillProfileRequest, SkillProfileResponse


ALLOWED_SKILL_KEYS = set(Skills.model_fields.keys())


async def suggest_skill_profile(payload: SkillProfileRequest) -> SkillProfileResponse:
    github_client = GitHubClient()
    owner, repo = github_client.parse_github_url(payload.github_page)
    repo_info = await github_client.get_repository_info(owner, repo)

    system_prompt = """You are an expert CTO and staffing consultant.
Recommend the minimal team needed to extend the given software project.

OUTPUT one entry per person to be staffed. For each person, list the MINIMUM
required skill levels per category. A level of N means "at least N"; 0 means
the skill is not important for that person.

SKILL LEVEL SCALE (0-3):
- 0: not required
- 1: basic familiarity
- 2: strong working capability
- 3: expert

ALLOWED SKILL KEYS (use ALL six, default unused ones to 0):
android, ios, web, backend, infrastructure, ai

Return JSON of the form:
{
  "required_people_amount": <int>,
  "required_skills_per_person": [
    {"android": 0, "ios": 0, "web": 0, "backend": 3, "infrastructure": 0, "ai": 2},
    ...
  ]
}

The list length MUST equal required_people_amount. Use ONLY the six lowercase keys above.
"""

    user_content = f"""Project ID: {payload.project_id}
Planned extensions / project description:
{payload.project_description}

Current repository (stack and status):
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

    data = json.loads(response.choices[0].message.content)

    people: list[Skills] = []
    for raw in data.get("required_skills_per_person", []):
        normalized = {key: 0 for key in ALLOWED_SKILL_KEYS}
        for key, level in raw.items():
            if key in ALLOWED_SKILL_KEYS:
                normalized[key] = level
        people.append(Skills(**normalized))

    return SkillProfileResponse(
        required_people_amount=data.get("required_people_amount", len(people)),
        required_skills_per_person=people,
    )
