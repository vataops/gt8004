import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.a2a.routes import router as a2a_router

_a2a_logger = None
_mcp_logger = None

# FastMCP (MCP protocol) — mounted at /mcp
from fastmcp import FastMCP
from app.tools.crypto import hash_text, encode_text, checksum_address, generate_uuid

mcp = FastMCP("hash-agent-mcp")

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
def hash(text: str, algorithm: str = "sha256") -> str:
    """Compute hash of text. Supports sha256, md5, keccak256."""
    return hash_text(text, algorithm)


@mcp.tool()
def encode(text: str, mode: str = "base64_encode") -> str:
    """Encode/decode text. Modes: base64_encode, base64_decode, hex_encode, hex_decode."""
    return encode_text(text, mode)


@mcp.tool()
def checksum(address: str) -> str:
    """Validate and EIP-55 checksum an Ethereum address."""
    return checksum_address(address)


@mcp.tool()
def uuid_gen(namespace: str = "", name: str = "") -> str:
    """Generate UUID v4 (random) or v5 (namespace+name)."""
    return generate_uuid(namespace, name)


mcp_app = mcp.http_app(path="/")


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _a2a_logger, _mcp_logger
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


app = FastAPI(title=settings.agent_name, lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

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
    return {"status": "healthy", "agent": settings.agent_name, "protocols": ["a2a", "mcp"]}
