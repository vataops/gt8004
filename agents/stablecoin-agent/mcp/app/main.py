import logging
import uuid
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastmcp import FastMCP

from shared.config import settings

_mcp_logger = None
_http_client: httpx.AsyncClient | None = None


async def _call_a2a(text: str, skill_id: str | None = None) -> str:
    """Send a task to the A2A server and return the result text."""
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
        f"{settings.a2a_base_url}/a2a/tasks/send",
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


# ── MCP Server ──

mcp = FastMCP("stablecoin-mcp")

if settings.gt8004_agent_id and settings.gt8004_api_key:
    from gt8004 import GT8004Logger
    from gt8004.middleware.mcp import GT8004MCPMiddleware
    _mcp_logger = GT8004Logger(
        agent_id=settings.gt8004_agent_id,
        api_key=settings.gt8004_api_key,
        ingest_url=settings.gt8004_ingest_url,
        protocol="mcp",
    )
    mcp.add_middleware(GT8004MCPMiddleware(_mcp_logger))


@mcp.tool()
async def about() -> str:
    """Learn what the Stablecoin Search Agent does — supported protocols, analysis capabilities, and covered stablecoins."""
    return (
        f"{settings.agent_name}\n\n"
        f"{settings.agent_description}\n\n"
        "Covered stablecoins: DAI/USDS, LUSD, crvUSD, GHO, FRAX, USDe\n\n"
        "Available tools:\n"
        "- overview(): Comprehensive overview of collateralized stablecoins\n"
        "- analyze(stablecoin): In-depth analysis of a specific stablecoin\n"
        "- compare(coins): Side-by-side comparison of multiple stablecoins\n"
        "- risk(stablecoin): Risk assessment\n\n"
        "Payment: x402 protocol, 0.00001 ETH per request"
    )


@mcp.tool()
async def overview() -> str:
    """Get a comprehensive overview of collateralized stablecoins in the Ethereum ecosystem — market landscape, major protocols, and trends."""
    return await _call_a2a(
        "Provide a comprehensive overview of collateralized stablecoins in the Ethereum ecosystem.",
        skill_id="overview",
    )


@mcp.tool()
async def analyze(stablecoin: str) -> str:
    """Analyze a specific collateralized stablecoin — mechanics, collateral structure, yield, risks, and recent developments. Example: analyze('DAI')"""
    return await _call_a2a(
        f"Provide a comprehensive analysis of the {stablecoin} stablecoin.",
        skill_id="analyze",
    )


@mcp.tool()
async def compare(coins: str) -> str:
    """Compare multiple stablecoins side by side across risk, yield, and decentralization. Pass comma-separated names. Example: compare('DAI, LUSD, GHO')"""
    return await _call_a2a(
        f"Compare these stablecoins: {coins}",
        skill_id="compare",
    )


@mcp.tool()
async def risk(stablecoin: str) -> str:
    """Risk assessment of a specific stablecoin — smart contract, collateral, centralization, and peg stability risks. Example: risk('GHO')"""
    return await _call_a2a(
        f"Provide a risk assessment of the {stablecoin} stablecoin.",
        skill_id="risk",
    )


mcp_app = mcp.http_app(path="/")


# ── FastAPI wrapper ──

@asynccontextmanager
async def lifespan(app: FastAPI):
    global _http_client
    _http_client = httpx.AsyncClient()

    async with mcp_app.router.lifespan_context(app):
        if _mcp_logger:
            _mcp_logger.transport.start_auto_flush()
            ok = await _mcp_logger.verify_connection()
            logging.info(f"GT8004 MCP SDK: {'verified' if ok else 'failed'}")
        logging.info(f"A2A backend: {settings.a2a_base_url or '(not configured)'}")
        yield
        if _mcp_logger:
            await _mcp_logger.close()
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

app.mount("/mcp", mcp_app)


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "agent": settings.agent_name,
        "protocol": "mcp",
        "a2a_backend": settings.a2a_base_url or None,
    }


if __name__ == "__main__":
    import uvicorn
    logging.basicConfig(level=getattr(logging, settings.log_level.upper(), logging.INFO))
    uvicorn.run(app, host="0.0.0.0", port=settings.port)
