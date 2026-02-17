from fastapi import APIRouter, Request
from app.a2a.models import AgentCard, AgentProvider, Authentication, Skill, TaskRequest
from app.a2a.task_manager import TaskManager, SKILL_PROMPTS
from app.config import settings

router = APIRouter()
task_manager = TaskManager()

SKILLS = [
    Skill(id="help", name="Platform Help", description="GT8004 platform introduction, features, and general usage guide", tags=["help", "platform", "guide"]),
    Skill(id="sdk", name="SDK Integration", description="Python SDK integration guide with code examples for FastAPI, MCP, and A2A", tags=["sdk", "integration", "code"]),
    Skill(id="register", name="Registration Guide", description="ERC-8004 token minting and GT8004 platform registration walkthrough", tags=["registration", "erc-8004", "onchain"]),
    Skill(id="troubleshoot", name="Troubleshooting", description="Diagnose and resolve common platform and SDK issues", tags=["troubleshooting", "debug", "support"]),
]


def _build_agent_card() -> dict:
    provider = None
    if settings.provider_org:
        provider = AgentProvider(organization=settings.provider_org, url=settings.provider_url)

    card = AgentCard(
        name=settings.agent_name,
        description=settings.agent_description,
        url=settings.agent_url or "",
        version=settings.agent_version,
        skills=SKILLS,
        provider=provider,
        authentication=Authentication(schemes=[], description="No authentication required"),
    )
    return card.model_dump(exclude_none=True)


@router.get("/.well-known/agent.json")
async def agent_card():
    return _build_agent_card()


@router.post("/a2a/tasks/send")
async def send_task(request: Request):
    body = await request.json()
    task_req = TaskRequest(**body)

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
