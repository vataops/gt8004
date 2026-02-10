from fastapi import APIRouter, Request
from app.a2a.models import AgentCard, Skill, TaskRequest
from app.a2a.task_manager import TaskManager, SKILL_PROMPTS
from app.config import settings

router = APIRouter()
task_manager = TaskManager()

SKILLS = [
    Skill(id="chat", name="chat", description="General-purpose conversation and Q&A"),
    Skill(id="summarize", name="summarize", description="Summarize text or documents"),
    Skill(id="translate", name="translate", description="Translate text between languages"),
    Skill(id="code-assist", name="code-assist", description="Code help, debugging, and implementation"),
]


def _build_agent_card() -> dict:
    card = AgentCard(
        name=settings.agent_name,
        description=settings.agent_description,
        url=settings.agent_url or "",
        version=settings.agent_version,
        skills=SKILLS,
    )
    return card.model_dump()


@router.get("/.well-known/agent.json")
async def agent_card():
    return _build_agent_card()


@router.post("/a2a/tasks/send")
async def send_task(request: Request):
    body = await request.json()
    task_req = TaskRequest(**body)

    if not task_req.skill_id:
        for part in task_req.message.parts:
            text_lower = part.text.lower()
            for sid in SKILL_PROMPTS:
                if sid in text_lower:
                    task_req.skill_id = sid
                    break
            if task_req.skill_id:
                break

    from app.main import get_llm
    llm = get_llm()
    response = await task_manager.submit(task_req, llm)
    return response.model_dump()


@router.get("/a2a/tasks/{task_id}")
async def get_task(task_id: str):
    task = task_manager.get(task_id)
    if task is None:
        return {"id": task_id, "status": {"state": "not_found"}, "artifacts": []}
    return task.model_dump()


@router.post("/a2a/{skill_id}")
async def direct_skill(skill_id: str, request: Request):
    body = await request.json()
    body["skill_id"] = skill_id
    task_req = TaskRequest(**body)

    from app.main import get_llm
    llm = get_llm()
    response = await task_manager.submit(task_req, llm)
    return response.model_dump()
