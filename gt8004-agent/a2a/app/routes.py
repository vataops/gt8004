from fastapi import APIRouter, HTTPException, Request
from fastapi_x402 import pay

from app.models import AgentCard, AgentProvider, Authentication, Skill, TaskRequest
from app.task_manager import TaskManager
from shared.config import settings

router = APIRouter()
task_manager = TaskManager()

SKILLS = [
    Skill(
        id="register",
        name="Agent Registration",
        description="Guide for registering an AI agent on GT8004 via ERC-8004 on-chain identity",
        tags=["register", "onboard", "erc8004", "mint"],
    ),
    Skill(
        id="analytics",
        name="Analytics & Stats",
        description="Query and interpret agent analytics — requests, protocols, tool usage, customers",
        tags=["analytics", "stats", "requests", "customers"],
    ),
    Skill(
        id="revenue",
        name="Revenue Analysis",
        description="Analyze agent revenue — x402 payments, ARPU, conversion funnel",
        tags=["revenue", "payment", "x402", "earnings"],
    ),
    Skill(
        id="performance",
        name="Performance Diagnostics",
        description="Diagnose agent performance — latency percentiles, error rate, throughput",
        tags=["performance", "latency", "errors", "uptime"],
    ),
    Skill(
        id="guide",
        name="Platform Guide",
        description="Learn about GT8004 — getting started, SDK integration, protocols, best practices",
        tags=["guide", "help", "howto", "sdk"],
    ),
]


def _build_agent_card() -> dict:
    provider = None
    if settings.provider_org:
        provider = AgentProvider(
            organization=settings.provider_org, url=settings.provider_url,
        )

    card = AgentCard(
        name=settings.agent_name,
        description=settings.agent_description,
        url=settings.agent_url or "",
        version=settings.agent_version,
        skills=SKILLS,
        provider=provider,
        authentication=Authentication(
            schemes=["x402"],
            description=(
                f"x402 payment required: ${settings.x402_price} USDC on Base"
                if settings.x402_pay_to
                else "No authentication required"
            ),
        ),
    )
    return card.model_dump(exclude_none=True)


@router.get("/.well-known/agent.json")
async def agent_card():
    return _build_agent_card()


async def _process_task(body: dict) -> dict:
    task_req = TaskRequest(**body)
    from app.main import get_llm
    response = await task_manager.submit(task_req, get_llm())
    return response.model_dump()


@router.post("/a2a/tasks/send")
@pay(f"${settings.x402_price}")
async def send_task(request: Request):
    """Submit a task with automatic skill detection. Requires x402 payment."""
    return await _process_task(await request.json())


@router.get("/a2a/tasks/{task_id}")
async def get_task(task_id: str):
    """Retrieve task status and results by task ID."""
    task = task_manager.get(task_id)
    if task is None:
        return {"id": task_id, "status": {"state": "not_found"}, "artifacts": []}
    return task.model_dump()


@router.post("/a2a/{skill_id}")
@pay(f"${settings.x402_price}")
async def direct_skill(skill_id: str, request: Request):
    """Call a specific skill directly. Requires x402 payment."""
    body = await request.json()
    body["skill_id"] = skill_id
    return await _process_task(body)


def _check_internal_key(request: Request):
    key = request.headers.get("X-Internal-Key")
    if not key or key != settings.internal_api_key:
        raise HTTPException(status_code=401, detail="Invalid internal key")


@router.post("/internal/tasks/send")
async def send_task_internal(request: Request):
    """Internal endpoint for MCP -> A2A proxy (bypasses x402 payment)."""
    _check_internal_key(request)
    return await _process_task(await request.json())
