"""
Calc Agent — Starlette hybrid (Flask A2A + FastMCP MCP)
=======================================================
Flask handles A2A routes (/.well-known/agent.json, /a2a/tasks/send, /health).
FastMCP handles MCP at /mcp.
Both are mounted in a Starlette app using a2wsgi.WSGIMiddleware for Flask.
GT8004FlaskMiddleware wraps the Flask WSGI app.
GT8004MCPMiddleware wraps the FastMCP server.
"""

import logging

from starlette.applications import Starlette
from starlette.routing import Mount
from a2wsgi import WSGIMiddleware

from app.config import settings
from app.a2a.routes import create_flask_app

logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)

# --- Flask A2A app ---
flask_app = create_flask_app()
_a2a_logger = None

if settings.gt8004_agent_id and settings.gt8004_api_key:
    from gt8004 import GT8004Logger
    from gt8004.middleware.flask import GT8004FlaskMiddleware

    _a2a_logger = GT8004Logger(
        agent_id=settings.gt8004_agent_id,
        api_key=settings.gt8004_api_key,
        ingest_url=settings.gt8004_ingest_url,
        protocol="a2a",
    )
    _a2a_logger.transport.start_auto_flush()
    flask_app.wsgi_app = GT8004FlaskMiddleware(flask_app.wsgi_app, _a2a_logger)
    logging.info("GT8004 Flask A2A SDK: enabled")

# --- FastMCP ---
from fastmcp import FastMCP
from app.tools.math_tools import calculate, unit_convert, random_number, statistics_calc

mcp = FastMCP("calc-agent-mcp")
_mcp_logger = None

if settings.gt8004_agent_id and settings.gt8004_api_key:
    from gt8004 import GT8004Logger as GT8004Logger2
    from gt8004.middleware.mcp import GT8004MCPMiddleware

    _mcp_logger = GT8004Logger2(
        agent_id=settings.gt8004_agent_id,
        api_key=settings.gt8004_api_key,
        ingest_url=settings.gt8004_ingest_url,
        protocol="mcp",
    )
    _mcp_logger.transport.start_auto_flush()
    mcp.add_middleware(GT8004MCPMiddleware(_mcp_logger))
    logging.info("GT8004 MCP SDK: enabled")


@mcp.tool()
def calc(expression: str) -> str:
    """Evaluate a mathematical expression safely."""
    return calculate(expression)


@mcp.tool()
def convert_unit(value: float, from_unit: str, to_unit: str) -> str:
    """Convert between units (temperature, length, weight)."""
    return unit_convert(value, from_unit, to_unit)


@mcp.tool()
def random_gen(type: str = "int", min_val: float = 0, max_val: float = 100) -> str:
    """Generate random numbers."""
    return random_number(type, min_val, max_val)


@mcp.tool()
def stats(numbers: list[float]) -> str:
    """Compute statistics (mean, median, mode, stddev, etc.)."""
    return statistics_calc(numbers)


# --- Combine into Starlette app ---
mcp_app = mcp.http_app(path="/")

app = Starlette(
    routes=[
        Mount("/mcp", app=mcp_app),
        Mount("/", app=WSGIMiddleware(flask_app)),
    ],
    lifespan=mcp_app.router.lifespan_context,
)
