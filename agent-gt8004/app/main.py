import logging
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.llm import create_backend
from app.llm.base import LLMBackend
from app.a2a.routes import router as a2a_router
from app.knowledge import SYSTEM_PROMPT

_llm: Optional[LLMBackend] = None
_a2a_logger = None
_mcp_logger = None


def get_llm() -> LLMBackend:
    assert _llm is not None, "LLM backend not initialized"
    return _llm


# FastMCP (MCP protocol) — mounted at /mcp
from fastmcp import FastMCP

mcp = FastMCP("gt8004-support-mcp")

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
async def ask(question: str) -> str:
    """Ask any question about the GT8004 platform — features, SDK integration, registration, troubleshooting, and more."""
    llm = get_llm()
    return await llm.generate(question, system_prompt=SYSTEM_PROMPT)


@mcp.tool()
async def sdk_guide(framework: str = "fastapi") -> str:
    """Get SDK integration code examples for a specific framework. Supported: fastapi, mcp, dual (both A2A and MCP)."""
    llm = get_llm()
    prompt = f"Provide a complete GT8004 SDK integration guide with working code examples for the '{framework}' framework. Include installation, setup, and environment variables."
    return await llm.generate(prompt, system_prompt=SYSTEM_PROMPT)


@mcp.tool()
async def check_status() -> str:
    """Check GT8004 platform status, supported networks, and contract addresses."""
    return (
        "GT8004 Platform Status: Operational\n\n"
        "Supported Networks:\n"
        "- Ethereum Mainnet: Registry 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432\n"
        "- Base Sepolia Testnet: Registry 0x8004A818BFB912233c491871b3d84c89A494BD9e\n\n"
        "Endpoints:\n"
        "- Dashboard: https://gt8004.xyz\n"
        "- Explorer: https://gt8004.xyz/explorer\n"
        "- Mainnet Ingest: https://ingest.gt8004.xyz/v1/ingest\n"
        "- Testnet Ingest: https://testnet.ingest.gt8004.xyz/v1/ingest\n\n"
        "SDK: pip install git+https://github.com/vataops/gt8004-sdk.git"
    )


mcp_app = mcp.http_app(path="/")


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _llm, _a2a_logger, _mcp_logger
    _llm = create_backend(settings.google_api_key, settings.llm_model)
    logging.info(f"LLM backend: Google AI Studio ({settings.llm_model})")

    async with mcp_app.router.lifespan_context(app):
        if _a2a_logger:
            _a2a_logger.transport.start_auto_flush()
            ok = await _a2a_logger.verify_connection()
            logging.info(f"GT8004 A2A SDK: {'verified' if ok else 'failed'}")
        if _mcp_logger:
            _mcp_logger.transport.start_auto_flush()
            ok = await _mcp_logger.verify_connection()
            logging.info(f"GT8004 MCP SDK: {'verified' if ok else 'failed'}")
        yield
        if _a2a_logger:
            await _a2a_logger.close()
        if _mcp_logger:
            await _mcp_logger.close()
    _llm = None


app = FastAPI(
    title=settings.agent_name,
    description=settings.agent_description,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# GT8004 A2A middleware
if settings.gt8004_agent_id and settings.gt8004_api_key:
    from gt8004 import GT8004Logger as GT8004LoggerA2A
    from gt8004.middleware.fastapi import GT8004Middleware
    _a2a_logger = GT8004LoggerA2A(
        agent_id=settings.gt8004_agent_id,
        api_key=settings.gt8004_api_key,
        ingest_url=settings.gt8004_ingest_url,
        protocol="a2a",
    )
    app.add_middleware(GT8004Middleware, logger=_a2a_logger)

app.include_router(a2a_router)
app.mount("/mcp", mcp_app)


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "agent": settings.agent_name,
        "llm_model": settings.llm_model,
        "protocols": ["a2a", "mcp"],
    }


if __name__ == "__main__":
    import uvicorn

    logging.basicConfig(level=getattr(logging, settings.log_level.upper(), logging.INFO))
    uvicorn.run(app, host="0.0.0.0", port=settings.port)
