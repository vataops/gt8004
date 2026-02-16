import json
import re

from fastapi import APIRouter, Request
from app.a2a.models import (
    AgentCard,
    AgentProvider,
    Authentication,
    Artifact,
    Part,
    Skill,
    TaskRequest,
    TaskResponse,
    TaskStatus,
)
from app.config import settings
from app.tools.dev_tools import json_format, timestamp_convert, regex_test, diff_text

router = APIRouter()

SKILLS = [
    Skill(
        id="json-format",
        name="json-format",
        description="Parse and prettify or minify JSON",
        tags=["json", "formatting", "developer"],
    ),
    Skill(
        id="timestamp",
        name="timestamp",
        description="Convert between Unix epoch and ISO 8601 timestamps",
        tags=["timestamp", "datetime", "conversion"],
    ),
    Skill(
        id="regex-test",
        name="regex-test",
        description="Test a regex pattern against text and return matches",
        tags=["regex", "testing", "developer"],
    ),
    Skill(
        id="diff-text",
        name="diff-text",
        description="Compute unified diff between two texts",
        tags=["diff", "text", "comparison"],
    ),
]

# Map skill IDs for auto-detection from input text
_SKILL_KEYWORDS = {
    "json-format": ["json", "format", "prettify", "minify"],
    "timestamp": ["timestamp", "epoch", "iso8601", "datetime"],
    "regex-test": ["regex", "regexp", "pattern", "match"],
    "diff-text": ["diff", "compare", "difference"],
}


def _build_agent_card() -> dict:
    provider = None
    if settings.provider_org:
        provider = AgentProvider(
            organization=settings.provider_org, url=settings.provider_url
        )

    card = AgentCard(
        name=settings.agent_name,
        description=settings.agent_description,
        url=settings.agent_url or "",
        version=settings.agent_version,
        skills=SKILLS,
        provider=provider,
        authentication=Authentication(
            schemes=[], description="No authentication required"
        ),
    )
    return card.model_dump(exclude_none=True)


def _detect_skill(text: str) -> str | None:
    """Auto-detect skill from input text keywords."""
    text_lower = text.lower()
    for skill_id, keywords in _SKILL_KEYWORDS.items():
        if skill_id in text_lower:
            return skill_id
        for kw in keywords:
            if kw in text_lower:
                return skill_id
    return None


def _parse_regex_input(text: str) -> tuple[str, str]:
    """
    Parse regex-test input.
    Accepts formats:
      - pattern: /regex/ text: some text
      - JSON body: {"pattern": "...", "text": "..."}
    """
    # Try JSON parse first
    try:
        obj = json.loads(text)
        if isinstance(obj, dict) and "pattern" in obj and "text" in obj:
            return obj["pattern"], obj["text"]
    except (json.JSONDecodeError, TypeError):
        pass

    # Try pattern: /.../ text: ... format
    m = re.match(r'pattern:\s*/(.+?)/\s+text:\s*(.*)', text, re.DOTALL)
    if m:
        return m.group(1), m.group(2)

    # Try pattern: ... text: ... format (without slashes)
    m = re.match(r'pattern:\s*(.+?)\s+text:\s*(.*)', text, re.DOTALL)
    if m:
        return m.group(1), m.group(2)

    return text, ""


def _parse_diff_input(text: str) -> tuple[str, str]:
    """
    Parse diff-text input.
    Accepts formats:
      - ---a---\\ntext1\\n---b---\\ntext2
      - JSON body: {"text_a": "...", "text_b": "..."}
    """
    # Try JSON parse first
    try:
        obj = json.loads(text)
        if isinstance(obj, dict) and "text_a" in obj and "text_b" in obj:
            return obj["text_a"], obj["text_b"]
    except (json.JSONDecodeError, TypeError):
        pass

    # Try separator format
    if "---a---" in text and "---b---" in text:
        parts = text.split("---b---", 1)
        text_a = parts[0].replace("---a---", "", 1).strip()
        text_b = parts[1].strip() if len(parts) > 1 else ""
        return text_a, text_b

    return text, ""


def _dispatch(skill_id: str, text: str) -> str:
    """Dispatch to the appropriate tool function based on skill_id."""
    if skill_id == "json-format":
        # Check if minify is requested
        minify = False
        if text.lower().startswith("minify:"):
            minify = True
            text = text[len("minify:"):].strip()
        return json_format(text, minify=minify)

    elif skill_id == "timestamp":
        return timestamp_convert(text)

    elif skill_id == "regex-test":
        pattern, target = _parse_regex_input(text)
        return regex_test(pattern, target)

    elif skill_id == "diff-text":
        text_a, text_b = _parse_diff_input(text)
        return diff_text(text_a, text_b)

    return json.dumps({"error": f"Unknown skill: {skill_id}"})


@router.get("/.well-known/agent.json")
async def agent_card():
    return _build_agent_card()


@router.post("/a2a/tasks/send")
async def send_task(request: Request):
    body = await request.json()
    task_req = TaskRequest(**body)

    # Extract input text
    input_text = ""
    for part in task_req.message.parts:
        input_text += part.text

    # Resolve skill
    skill_id = task_req.skill_id
    if not skill_id:
        skill_id = _detect_skill(input_text)
    if not skill_id:
        response = TaskResponse(
            id=task_req.id,
            status=TaskStatus(state="failed"),
            artifacts=[
                Artifact(
                    parts=[
                        Part(
                            text=json.dumps(
                                {
                                    "error": "No skill specified or detected. Available skills: json-format, timestamp, regex-test, diff-text"
                                }
                            )
                        )
                    ]
                )
            ],
        )
        return response.model_dump()

    # Dispatch to tool
    result = _dispatch(skill_id, input_text)

    response = TaskResponse(
        id=task_req.id,
        status=TaskStatus(state="completed"),
        artifacts=[Artifact(parts=[Part(text=result)])],
    )
    return response.model_dump()


@router.get("/a2a/tasks/{task_id}")
async def get_task(task_id: str):
    return {"id": task_id, "status": {"state": "not_found"}, "artifacts": []}


@router.post("/a2a/{skill_id}")
async def direct_skill(skill_id: str, request: Request):
    body = await request.json()
    body["skill_id"] = skill_id
    task_req = TaskRequest(**body)

    input_text = ""
    for part in task_req.message.parts:
        input_text += part.text

    result = _dispatch(skill_id, input_text)

    response = TaskResponse(
        id=task_req.id,
        status=TaskStatus(state="completed"),
        artifacts=[Artifact(parts=[Part(text=result)])],
    )
    return response.model_dump()
