import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastmcp import FastMCP

from app.config import settings
from app.a2a.routes import router as a2a_router
from app.tools.dev_tools import json_format, timestamp_convert, regex_test, diff_text

_gt8004_a2a_logger = None
_gt8004_mcp_logger = None

# FastMCP sub-application (define before lifespan so we can use its lifespan)
mcp = FastMCP("Toolbox Agent")

if settings.gt8004_agent_id and settings.gt8004_api_key:
    from gt8004 import GT8004Logger
    from gt8004.middleware.mcp import GT8004MCPMiddleware

    _gt8004_mcp_logger = GT8004Logger(
        agent_id=settings.gt8004_agent_id,
        api_key=settings.gt8004_api_key,
        ingest_url=settings.gt8004_ingest_url,
        protocol="mcp",
    )
    mcp.add_middleware(GT8004MCPMiddleware(_gt8004_mcp_logger))


@mcp.tool()
def mcp_json_format(json_str: str, minify: bool = False) -> str:
    """Parse and prettify or minify JSON."""
    return json_format(json_str, minify=minify)


@mcp.tool()
def mcp_timestamp_convert(value: str, to_format: str = "iso") -> str:
    """Convert between Unix epoch and ISO 8601 timestamps. If input is numeric, treat as epoch. If input is a date string, convert to epoch."""
    return timestamp_convert(value, to_format=to_format)


@mcp.tool()
def mcp_regex_test(pattern: str, text: str) -> str:
    """Test a regex pattern against text and return JSON with matches, groups, and spans."""
    return regex_test(pattern, text)


@mcp.tool()
def mcp_diff_text(text_a: str, text_b: str) -> str:
    """Compute unified diff between two texts."""
    return diff_text(text_a, text_b)


mcp_app = mcp.http_app(path="/")


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _gt8004_a2a_logger, _gt8004_mcp_logger

    # Initialize MCP session manager via its lifespan
    async with mcp_app.router.lifespan_context(app):
        # Start GT8004 SDK auto-flush for both loggers
        for name, logger in [("A2A", _gt8004_a2a_logger), ("MCP", _gt8004_mcp_logger)]:
            if logger:
                logger.transport.start_auto_flush()
                logging.info(f"GT8004 SDK ({name}): auto-flush started")
                ok = await logger.verify_connection()
                if ok:
                    logging.info(f"GT8004 SDK ({name}): connection verified")
                else:
                    logging.warning(f"GT8004 SDK ({name}): connection verification failed")

        yield

        # Graceful shutdown: flush pending logs
        for name, logger in [("A2A", _gt8004_a2a_logger), ("MCP", _gt8004_mcp_logger)]:
            if logger:
                await logger.close()
                logging.info(f"GT8004 SDK ({name}): closed")


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

    _gt8004_a2a_logger = GT8004LoggerA2A(
        agent_id=settings.gt8004_agent_id,
        api_key=settings.gt8004_api_key,
        ingest_url=settings.gt8004_ingest_url,
        protocol="a2a",
    )
    app.add_middleware(GT8004Middleware, logger=_gt8004_a2a_logger)
    logging.info(f"GT8004 SDK: enabled for agent {settings.gt8004_agent_id}")

# A2A routes
app.include_router(a2a_router)
app.mount("/mcp", mcp_app)


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "agent": settings.agent_name,
        "protocols": ["a2a", "mcp"],
    }


if __name__ == "__main__":
    import uvicorn

    logging.basicConfig(
        level=getattr(logging, settings.log_level.upper(), logging.INFO)
    )
    uvicorn.run(app, host="0.0.0.0", port=settings.port)
