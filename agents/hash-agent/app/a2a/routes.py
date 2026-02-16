from typing import Dict, Optional

from fastapi import APIRouter, Request

from app.a2a.models import (
    AgentCard,
    Authentication,
    Skill,
    TaskRequest,
    TaskResponse,
    TaskStatus,
    Artifact,
    Part,
)
from app.config import settings
from app.tools.crypto import hash_text, encode_text, checksum_address, generate_uuid

router = APIRouter()

# In-memory task store
_tasks: Dict[str, TaskResponse] = {}

SKILLS = [
    Skill(
        id="hash",
        name="hash",
        description="Compute cryptographic hash of text (sha256, md5, keccak256)",
        tags=["hash", "sha256", "md5", "keccak256", "crypto"],
    ),
    Skill(
        id="encode",
        name="encode",
        description="Encode or decode text (base64, hex)",
        tags=["encode", "decode", "base64", "hex"],
    ),
    Skill(
        id="checksum",
        name="checksum",
        description="Validate and EIP-55 checksum an Ethereum address",
        tags=["eip55", "ethereum", "checksum", "address"],
    ),
    Skill(
        id="uuid",
        name="uuid",
        description="Generate UUID v4 (random) or UUID v5 (namespace+name)",
        tags=["uuid", "uuid4", "uuid5", "identifier"],
    ),
]

SKILL_IDS = {s.id for s in SKILLS}


def _build_agent_card() -> dict:
    card = AgentCard(
        name=settings.agent_name,
        description=settings.agent_description,
        url=settings.agent_url or "",
        version=settings.agent_version,
        skills=SKILLS,
        authentication=Authentication(schemes=[], description="No authentication required"),
    )
    return card.model_dump(exclude_none=True)


def _parse_input(text: str, skill_id: str) -> dict:
    """
    Parse simple 'arg:value' input format.

    Examples:
        "sha256:hello world"   -> {"algorithm": "sha256", "text": "hello world"}
        "base64_encode:hello"  -> {"mode": "base64_encode", "text": "hello"}
        "0xAbC..."             -> {"text": "0xAbC..."}
        "hello world"          -> {"text": "hello world"}
        "dns:myapp"            -> {"namespace": "dns", "name": "myapp"}
    """
    if skill_id == "hash":
        algos = {"sha256", "md5", "keccak256"}
        for algo in algos:
            prefix = f"{algo}:"
            if text.lower().startswith(prefix):
                return {"algorithm": algo, "text": text[len(prefix):]}
        return {"text": text}

    elif skill_id == "encode":
        modes = {"base64_encode", "base64_decode", "hex_encode", "hex_decode"}
        for mode in modes:
            prefix = f"{mode}:"
            if text.lower().startswith(prefix):
                return {"mode": mode, "text": text[len(prefix):]}
        return {"text": text}

    elif skill_id == "checksum":
        return {"text": text.strip()}

    elif skill_id == "uuid":
        # Format: "namespace:name" for v5, or empty/anything else for v4
        if ":" in text:
            parts = text.split(":", 1)
            return {"namespace": parts[0].strip(), "name": parts[1].strip()}
        return {"text": text.strip()}

    return {"text": text}


def _dispatch(skill_id: str, text: str) -> str:
    """Dispatch to the correct tool function based on skill_id."""
    parsed = _parse_input(text, skill_id)

    if skill_id == "hash":
        algorithm = parsed.get("algorithm", "sha256")
        return hash_text(parsed.get("text", text), algorithm)

    elif skill_id == "encode":
        mode = parsed.get("mode", "base64_encode")
        return encode_text(parsed.get("text", text), mode)

    elif skill_id == "checksum":
        return checksum_address(parsed.get("text", text))

    elif skill_id == "uuid":
        namespace = parsed.get("namespace", "")
        name = parsed.get("name", "")
        return generate_uuid(namespace, name)

    return f"error: unknown skill '{skill_id}'"


def _complete(task_id: str, result: str) -> TaskResponse:
    response = TaskResponse(
        id=task_id,
        status=TaskStatus(state="completed"),
        artifacts=[Artifact(parts=[Part(text=result)])],
    )
    _tasks[task_id] = response
    return response


def _fail(task_id: str, error: str) -> TaskResponse:
    response = TaskResponse(
        id=task_id,
        status=TaskStatus(state="failed"),
        artifacts=[Artifact(parts=[Part(text=f"Error: {error}")])],
    )
    _tasks[task_id] = response
    return response


@router.get("/.well-known/agent.json")
async def agent_card():
    return _build_agent_card()


@router.post("/a2a/tasks/send")
async def send_task(request: Request):
    body = await request.json()
    task_req = TaskRequest(**body)

    # Extract text input
    text = ""
    for part in task_req.message.parts:
        if part.text:
            text += part.text

    if not text:
        return _fail(task_req.id, "Empty message").model_dump()

    # Determine skill_id
    skill_id = task_req.skill_id
    if not skill_id:
        # Auto-detect from text content
        text_lower = text.lower()
        for sid in SKILL_IDS:
            if sid in text_lower:
                skill_id = sid
                break
        if not skill_id:
            skill_id = "hash"  # default

    _tasks[task_req.id] = TaskResponse(
        id=task_req.id, status=TaskStatus(state="working")
    )

    try:
        result = _dispatch(skill_id, text)
    except Exception as e:
        return _fail(task_req.id, str(e)).model_dump()

    return _complete(task_req.id, result).model_dump()


@router.get("/a2a/tasks/{task_id}")
async def get_task(task_id: str):
    task = _tasks.get(task_id)
    if task is None:
        return {"id": task_id, "status": {"state": "not_found"}, "artifacts": []}
    return task.model_dump()


@router.post("/a2a/{skill_id}")
async def direct_skill(skill_id: str, request: Request):
    body = await request.json()
    body["skill_id"] = skill_id
    task_req = TaskRequest(**body)

    text = ""
    for part in task_req.message.parts:
        if part.text:
            text += part.text

    if not text:
        return _fail(task_req.id, "Empty message").model_dump()

    _tasks[task_req.id] = TaskResponse(
        id=task_req.id, status=TaskStatus(state="working")
    )

    try:
        result = _dispatch(skill_id, text)
    except Exception as e:
        return _fail(task_req.id, str(e)).model_dump()

    return _complete(task_req.id, result).model_dump()
