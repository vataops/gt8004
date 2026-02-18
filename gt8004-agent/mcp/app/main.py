import logging
import uuid
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastmcp import FastMCP

from shared.config import settings
from shared.api_client import GT8004Client

_mcp_logger = None
_api_client: GT8004Client | None = None
_http_client: httpx.AsyncClient | None = None

# ── MCP Server ──

mcp = FastMCP("mcp")


def _get_client() -> GT8004Client:
    assert _api_client is not None, "API client not initialised"
    return _api_client


# Register tools from submodules
from .tools import registration, auth, analytics  # noqa: E402

registration.register_tools(mcp, _get_client)
auth.register_tools(mcp, _get_client)
analytics.register_tools(mcp, _get_client)


@mcp.tool()
async def about() -> str:
    """Learn what the GT8004 Platform Agent does and what tools are available.
    No authentication required."""
    return (
        f"{settings.agent_name}\n\n"
        f"{settings.agent_description}\n\n"
        "Available tools:\n\n"
        "Registration:\n"
        "  - register_agent(wallet_address, token_id, chain_id, tier?)\n"
        "      Register an ERC-8004 agent on GT8004. Returns agent_id + API key.\n"
        "  - deregister_agent(api_key, agent_id)\n"
        "      Remove an agent from GT8004.\n\n"
        "Authentication:\n"
        "  - authenticate(api_key)\n"
        "      Verify an existing API key and get your agent profile.\n"
        "  - get_api_key(api_key, agent_id)\n"
        "      Retrieve your current API key.\n"
        "  - regenerate_api_key(api_key, agent_id)\n"
        "      Issue a new API key (revokes old one).\n\n"
        "Analytics:\n"
        "  - get_agent_profile(api_key)\n"
        "      Your agent's full profile.\n"
        "  - get_stats(api_key, agent_id)\n"
        "      Snapshot stats (requests, revenue, error rate).\n"
        "  - get_daily_stats(api_key, agent_id, days?)\n"
        "      Daily time-series.\n"
        "  - get_customers(api_key, agent_id, limit?)\n"
        "      Customer list with usage data.\n"
        "  - get_revenue(api_key, agent_id, period?)\n"
        "      Revenue report (monthly/weekly).\n"
        "  - get_performance(api_key, agent_id, window?)\n"
        "      Latency p50/p95/p99, error rate, throughput.\n"
        "  - get_logs(api_key, agent_id, limit?)\n"
        "      Recent request logs.\n"
        "  - get_conversion_funnel(api_key, agent_id, days?)\n"
        "      x402 payment conversion funnel.\n"
        "  - get_analytics_report(api_key, agent_id, days?)\n"
        "      Comprehensive report (protocol, tools, health, customers, revenue).\n\n"
        "Supported chains: Base (8453), Ethereum (1), "
        "Base Sepolia (84532), Ethereum Sepolia (11155111)\n\n"
        "Getting started:\n"
        "1. Mint an ERC-8004 token with your agent metadata\n"
        "2. Call register_agent() with your wallet address and token ID\n"
        "3. Use the returned API key for all subsequent calls"
    )


# ── A2A Internal Proxy ──


async def _call_a2a(text: str, skill_id: str | None = None) -> str:
    """Send a task to the A2A server via internal bypass (no x402)."""
    if not settings.a2a_base_url:
        return "Error: A2A_BASE_URL is not configured."

    payload = {
        "id": f"mcp-{uuid.uuid4().hex[:12]}",
        "message": {
            "role": "user",
            "parts": [{"type": "text", "text": text}],
        },
    }
    if skill_id:
        payload["skill_id"] = skill_id

    assert _http_client is not None
    resp = await _http_client.post(
        f"{settings.a2a_base_url}/internal/tasks/send",
        headers={"X-Internal-Key": settings.internal_api_key},
        json=payload,
        timeout=60.0,
    )
    resp.raise_for_status()
    data = resp.json()

    artifacts = data.get("artifacts", [])
    if artifacts:
        parts = artifacts[0].get("parts", [])
        if parts:
            return parts[0].get("text", "No response text.")
    return f"Task {data.get('status', {}).get('state', 'unknown')}: no artifacts returned."


@mcp.tool()
async def ask(question: str) -> str:
    """Ask the GT8004 Platform Agent a natural-language question about the
    platform, ERC-8004, analytics interpretation, or any topic. The A2A
    backend uses an LLM to generate a helpful answer.

    Include your API key (gt8004_sk_...) and agent_id in the question text
    if you want the agent to fetch and analyze your real data.

    Args:
        question: Your question in natural language (English or Korean)
    """
    return await _call_a2a(question)


mcp_app = mcp.http_app(path="/sse", transport="sse")

# ── FastAPI wrapper ──


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _api_client, _http_client
    _api_client = GT8004Client(settings.gt8004_api_url)
    await _api_client.start()
    _http_client = httpx.AsyncClient()

    async with mcp_app.router.lifespan_context(app):
        if _mcp_logger:
            _mcp_logger.transport.start_auto_flush()
            ok = await _mcp_logger.verify_connection()
            logging.info(f"GT8004 SDK: {'verified' if ok else 'failed'}")
        logging.info(f"GT8004 API: {settings.gt8004_api_url}")
        if settings.a2a_base_url:
            logging.info(f"A2A bridge: {settings.a2a_base_url}")
        yield
        if _mcp_logger:
            await _mcp_logger.close()

    await _api_client.close()
    _api_client = None
    if _http_client:
        await _http_client.aclose()
        _http_client = None


app = FastAPI(
    title=f"{settings.agent_name} (MCP)",
    description=settings.agent_description,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "agent": settings.agent_name,
        "protocol": "mcp",
        "gt8004_api": settings.gt8004_api_url,
    }


app.mount("/mcp", mcp_app)

# GT8004 SDK logging (Platform Agent's own telemetry)
if settings.gt8004_agent_id and settings.gt8004_api_key:
    from gt8004 import GT8004Logger
    _mcp_logger = GT8004Logger(
        agent_id=settings.gt8004_agent_id,
        api_key=settings.gt8004_api_key,
        ingest_url=settings.gt8004_ingest_url,
        protocol="mcp",
    )
    from gt8004.middleware.asgi import GT8004ASGIMiddleware
    app = GT8004ASGIMiddleware(app, _mcp_logger, exclude_paths={
        "/health", "/healthz", "/readyz", "/_health", "/mcp/sse",
    })


if __name__ == "__main__":
    import uvicorn
    logging.basicConfig(level=getattr(logging, settings.log_level.upper(), logging.INFO))
    uvicorn.run(app, host="0.0.0.0", port=settings.port)
