from enum import Enum
from typing import Literal


class ProjectStatus(str, Enum):
    NEW = "NEW"
    GROWTH = "GROWTH"
    MAINTENANCE = "MAINTENANCE"


SkillCategory = Literal["Android", "iOS", "Backend", "Web", "Infrastructure", "AI/ML"]
SkillLevel = Literal[0, 1, 2, 3]
