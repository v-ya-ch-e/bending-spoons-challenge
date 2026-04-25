from enum import Enum
from typing import Literal


class ProjectStatus(str, Enum):
    NEW = "NEW"
    GROWTH = "GROWTH"
    MAINTENANCE = "MAINTENANCE"


SkillCategory = Literal["android", "ios", "web", "backend", "infrastructure", "ai"]
SkillLevel = Literal[0, 1, 2, 3]
