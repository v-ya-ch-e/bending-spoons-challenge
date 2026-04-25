from schemas import SkillProfile, SkillProfileSuggestRequest


def suggest_skill_profile(
    project_id: int, payload: SkillProfileSuggestRequest
) -> SkillProfile:
    raise NotImplementedError("Skill profile suggestion is not implemented yet")


def save_skill_profile(project_id: int, skill_profile: SkillProfile) -> SkillProfile:
    raise NotImplementedError("Skill profile persistence is not implemented yet")
