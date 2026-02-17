from fastapi import APIRouter, HTTPException, Request
from fastapi_x402 import pay
from app.models import AgentCard, AgentProvider, Authentication, Skill, TaskRequest
from app.task_manager import TaskManager
from shared.config import settings

router = APIRouter()
task_manager = TaskManager()

SKILLS = [
    Skill(id="overview", name="Stablecoin Overview", description="Comprehensive overview of collateralized stablecoins in the Ethereum ecosystem", tags=["overview", "market", "landscape"]),
    Skill(id="analyze", name="Deep Analysis", description="In-depth analysis of a specific collateralized stablecoin — mechanics, collateral, yield, risks", tags=["analyze", "research", "deep-dive"]),
    Skill(id="compare", name="Comparison", description="Side-by-side comparison of multiple stablecoins across risk, yield, and decentralization", tags=["compare", "versus", "trade-offs"]),
    Skill(id="risk", name="Risk Assessment", description="Risk evaluation covering smart contract, collateral, centralization, and peg stability risks", tags=["risk", "security", "audit"]),
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
        authentication=Authentication(
            schemes=["x402"],
            description=f"x402 payment required: ${settings.x402_price} USDC on Base" if settings.x402_pay_to else "No authentication required",
        ),
    )
    return card.model_dump(exclude_none=True)


@router.get("/.well-known/agent.json")
async def agent_card():
    return _build_agent_card()


async def _process_task(body: dict) -> dict:
    """Shared task processing logic for public and internal endpoints."""
    task_req = TaskRequest(**body)
    from app.main import get_llm
    response = await task_manager.submit(task_req, get_llm())
    return response.model_dump()


@router.post("/a2a/tasks/send")
@pay(f"${settings.x402_price}")
async def send_task(request: Request):
    return await _process_task(await request.json())


@router.get("/a2a/tasks/{task_id}")
async def get_task(task_id: str):
    task = task_manager.get(task_id)
    if task is None:
        return {"id": task_id, "status": {"state": "not_found"}, "artifacts": []}
    return task.model_dump()


@router.post("/a2a/{skill_id}")
@pay(f"${settings.x402_price}")
async def direct_skill(skill_id: str, request: Request):
    body = await request.json()
    body["skill_id"] = skill_id
    return await _process_task(body)


def _check_internal_key(request: Request):
    key = request.headers.get("X-Internal-Key")
    if not key or key != settings.internal_api_key:
        raise HTTPException(status_code=401, detail="Invalid internal key")


@router.post("/internal/tasks/send")
async def send_task_internal(request: Request):
    _check_internal_key(request)
    return await _process_task(await request.json())
