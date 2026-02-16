import logging
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.llm import create_backend
from app.llm.base import LLMBackend
from app.a2a.routes import router as a2a_router

_llm: Optional[LLMBackend] = None
_a2a_logger = None
_mcp_logger = None


def get_llm() -> LLMBackend:
    assert _llm is not None, "LLM backend not initialized"
    return _llm


# FastMCP (MCP protocol) — mounted at /mcp
from fastmcp import FastMCP

mcp = FastMCP("companion-agent-mcp")

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
async def chat(message: str) -> str:
    """General-purpose conversation and Q&A."""
    llm = get_llm()
    return await llm.generate("You are a helpful assistant.", message)


@mcp.tool()
async def summarize(text: str) -> str:
    """Summarize text or documents."""
    llm = get_llm()
    return await llm.generate("You are a summarization assistant. Provide a concise summary.", text)


@mcp.tool()
async def translate(text: str, target_language: str = "English") -> str:
    """Translate text to target language."""
    llm = get_llm()
    return await llm.generate(
        f"You are a translation assistant. Translate the following text to {target_language}.",
        text,
    )


@mcp.tool()
async def code_assist(question: str) -> str:
    """Code help, debugging, and implementation assistance."""
    llm = get_llm()
    return await llm.generate(
        "You are a coding assistant. Help with code questions, debugging, and implementation.",
        question,
    )


mcp_app = mcp.http_app(path="/")


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _llm, _a2a_logger, _mcp_logger
    _llm = create_backend(settings.google_api_key, settings.llm_model)
    logging.info(f"LLM backend: Google AI Studio ({settings.llm_model})")

    # Initialize MCP session manager via its lifespan
    async with mcp_app.router.lifespan_context(app):
        # Start GT8004 SDK
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
