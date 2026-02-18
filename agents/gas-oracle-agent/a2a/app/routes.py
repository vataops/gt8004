from fastapi import APIRouter, HTTPException, Request
from fastapi_x402 import pay
from app.models import AgentCard, AgentProvider, Authentication, Skill, TaskRequest
from app.task_manager import TaskManager
from shared.config import settings

router = APIRouter()
task_manager = TaskManager()

SKILLS = [
    Skill(id="current", name="Gas Landscape", description="Current gas landscape across major EVM chains — prices, congestion, and cost estimates for common operations", tags=["current", "price", "fee"]),
    Skill(id="optimize", name="Gas Optimization", description="Gas optimization strategies for specific use cases — timing, chain selection, calldata optimization, and batching", tags=["optimize", "save", "efficient"]),
    Skill(id="compare", name="Chain Comparison", description="Side-by-side gas fee comparison across L1 and L2 chains — cost per operation, fee models, and trade-offs", tags=["compare", "versus", "chains"]),
    Skill(id="mechanics", name="Gas Mechanics", description="Deep dive into gas pricing mechanisms — EIP-1559, blob gas, L2 fee models, priority fees, and future changes", tags=["mechanics", "eip", "technical"]),
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
