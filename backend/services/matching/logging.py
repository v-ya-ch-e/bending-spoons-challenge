from __future__ import annotations

from typing import Any, Literal


EventLevel = Literal["info", "warning", "error"]


def event_payload(
    *,
    event_type: str,
    message: str,
    level: EventLevel = "info",
    stage: str = "strict_rules",
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "level": level,
        "stage": stage,
        "event_type": event_type,
        "message": message,
        "metadata": metadata or {},
    }
