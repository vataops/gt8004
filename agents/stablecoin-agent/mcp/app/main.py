import json
import logging
import time as _time
import uuid
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastmcp import FastMCP
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

from shared.config import settings

_mcp_logger = None
_http_client: httpx.AsyncClient | None = None


# ── x402 Payment Middleware for MCP (JSON-RPC) ──


class MCPPaymentMiddleware:
    """ASGI middleware that enforces x402 payment on MCP tools/call requests.

    MCP uses JSON-RPC over HTTP, so fastapi-x402's @pay() decorator can't be
    used directly. This middleware intercepts POST /mcp requests, parses the
    JSON-RPC body, and only requires payment for tools/call method.
    """

    def __init__(self, app: ASGIApp, pay_to: str, network: str, price: str):
        self.app = app
        self.pay_to = pay_to
        self.network = network
        self.atomic_amount = str(int(float(price) * 1_000_000))  # USDC 6 decimals

        from fastapi_x402 import get_default_asset_config
        asset = get_default_asset_config(network)
        self.asset_address = asset.address
        self.asset_extra = {"name": asset.eip712_name, "version": asset.eip712_version}

        from fastapi_x402.facilitator import UnifiedFacilitatorClient
        self.facilitator = UnifiedFacilitatorClient("https://x402.org/facilitator")

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        if scope["type"] != "http" or scope.get("method") != "POST":
            return await self.app(scope, receive, send)

        path = scope.get("path", "")
        if not path.startswith("/mcp"):
            return await self.app(scope, receive, send)

        # Read full request body
        body = b""
        while True:
            msg = await receive()
            body += msg.get("body", b"")
            if not msg.get("more_body", False):
                break

        # Parse JSON-RPC
        try:
            data = json.loads(body)
        except (json.JSONDecodeError, UnicodeDecodeError):
            return await self._pass_through(scope, body, send)

        # Only require payment for tools/call
        if data.get("method") != "tools/call":
            return await self._pass_through(scope, body, send)

        # Check X-PAYMENT header
        payment_header = None
        for key, value in scope.get("headers", []):
            if key == b"x-payment":
                payment_header = value.decode()
                break

        if not payment_header:
            return await self._return_402(scope, send)

        # Build payment requirements
        from fastapi_x402.models import PaymentRequirements
        host = self._get_host(scope)
        requirements = PaymentRequirements(
            scheme="exact",
            network=self.network,
            maxAmountRequired=self.atomic_amount,
            resource=f"https://{host}{path}",
            payTo=self.pay_to,
            maxTimeoutSeconds=300,
            asset=self.asset_address,
            extra=self.asset_extra,
        )

        # Verify payment with facilitator
        verify_result = await self.facilitator.verify_payment(payment_header, requirements)
        if not verify_result.isValid:
            return await self._return_402(scope, send, error=verify_result.error)

        # Buffer downstream response to check status before settling
        response_parts: list[dict] = []

        async def buffer_send(message: dict):
            response_parts.append(message)

        await self._pass_through(scope, body, buffer_send)

        # Settle payment if response was successful
        status = 200
        for part in response_parts:
            if part["type"] == "http.response.start":
                status = part.get("status", 200)

        if status < 400:
            try:
                await self.facilitator.settle_payment(payment_header, requirements)
            except Exception as e:
                logging.warning(f"x402 settlement failed: {e}")

        # Send buffered response to client
        for part in response_parts:
            await send(part)

    async def _pass_through(self, scope: Scope, body: bytes, send: Send):
        """Forward request to downstream app with replayed body."""
        body_sent = False

        async def replay_receive():
            nonlocal body_sent
            if not body_sent:
                body_sent = True
                return {"type": "http.request", "body": body}
            return {"type": "http.request", "body": b""}

        await self.app(scope, replay_receive, send)

    async def _return_402(self, scope: Scope, send: Send, error: str | None = None):
        """Return HTTP 402 Payment Required with x402 payment requirements."""
        host = self._get_host(scope)
        path = scope.get("path", "")
        content = {
            "x402Version": 1,
            "error": error or "X-PAYMENT header is required",
            "accepts": [{
                "scheme": "exact",
                "network": self.network,
                "maxAmountRequired": self.atomic_amount,
                "resource": f"https://{host}{path}",
                "description": "",
                "mimeType": "",
                "payTo": self.pay_to,
                "maxTimeoutSeconds": 300,
                "asset": self.asset_address,
                "extra": self.asset_extra,
            }],
        }
        response = JSONResponse(status_code=402, content=content)
        await response(scope, lambda: {"type": "http.request", "body": b""}, send)

    @staticmethod
    def _get_host(scope: Scope) -> str:
        for key, value in scope.get("headers", []):
            if key == b"host":
                return value.decode()
        return "localhost"


class GT8004ASGIMiddleware:
    """ASGI middleware that logs ALL HTTP requests including x402 402 responses.

    Must be the outermost wrapper to capture requests that MCPPaymentMiddleware
    intercepts before they reach FastAPI/GT8004Middleware.
    """

    _BODY_LIMIT = 16384
    _EXCLUDE_PATHS = {"/health", "/healthz", "/readyz", "/_health", "/mcp/sse"}

    def __init__(self, app: ASGIApp, logger):
        self.app = app
        self.logger = logger

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)

        path = scope.get("path", "")
        if path in self._EXCLUDE_PATHS:
            return await self.app(scope, receive, send)

        start = _time.time()
        method = scope.get("method", "")

        # Extract headers
        raw_headers: dict[str, str] = {}
        for key, value in scope.get("headers", []):
            raw_headers[key.decode("latin-1")] = value.decode("latin-1")

        # Capture request body (passthrough — inner app also reads it)
        request_body = bytearray()

        async def receive_wrapper():
            msg = await receive()
            chunk = msg.get("body", b"")
            if len(request_body) < self._BODY_LIMIT:
                request_body.extend(chunk[: self._BODY_LIMIT - len(request_body)])
            return msg

        # Capture response status + body
        status_code = 0
        response_body = bytearray()

        async def send_wrapper(message):
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = message.get("status", 0)
            elif message["type"] == "http.response.body":
                chunk = message.get("body", b"")
                if len(response_body) < self._BODY_LIMIT:
                    response_body.extend(chunk[: self._BODY_LIMIT - len(response_body)])
            await send(message)

        try:
            await self.app(scope, receive_wrapper, send_wrapper)
        finally:
            elapsed = (_time.time() - start) * 1000

            req_str = None
            if request_body:
                try:
                    req_str = bytes(request_body).decode("utf-8", errors="ignore")
                except Exception:
                    pass

            resp_str = None
            if response_body:
                try:
                    resp_str = bytes(response_body).decode("utf-8", errors="ignore")
                except Exception:
                    pass

            from gt8004.types import RequestLogEntry
            from gt8004.middleware._extract import extract_tool_name, extract_x402_payment

            tool_name = extract_tool_name(self.logger.protocol, req_str, path)
            x402 = extract_x402_payment(raw_headers.get("x-payment"))

            client = scope.get("client")
            hdr = {
                k: v
                for k, v in {
                    "user-agent": raw_headers.get("user-agent"),
                    "content-type": raw_headers.get("content-type"),
                    "referer": raw_headers.get("referer"),
                }.items()
                if v is not None
            }

            entry = RequestLogEntry(
                request_id=str(uuid.uuid4()),
                method=method,
                path=path,
                status_code=status_code,
                response_ms=elapsed,
                tool_name=tool_name,
                protocol=self.logger.protocol,
                request_body=req_str,
                request_body_size=len(request_body) if request_body else None,
                response_body=resp_str,
                response_body_size=len(response_body) if response_body else None,
                headers=hdr or None,
                ip_address=client[0] if client else None,
                user_agent=raw_headers.get("user-agent"),
                content_type=raw_headers.get("content-type"),
                x402_amount=x402["x402_amount"],
                x402_tx_hash=x402["x402_tx_hash"],
                x402_token=x402["x402_token"],
                x402_payer=x402["x402_payer"],
            )

            try:
                await self.logger.log(entry)
            except Exception:
                logging.warning("GT8004 ASGI logging failed", exc_info=True)


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


# ── MCP Server ──

mcp = FastMCP("stablecoin-mcp")

if settings.gt8004_agent_id and settings.gt8004_api_key:
    from gt8004 import GT8004Logger
    _mcp_logger = GT8004Logger(
        agent_id=settings.gt8004_agent_id,
        api_key=settings.gt8004_api_key,
        ingest_url=settings.gt8004_ingest_url,
        protocol="mcp",
    )


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
        "Payment: x402 protocol, $0.01 USDC on Base per tool call"
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


mcp_app = mcp.http_app(path="/sse", transport="sse")


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
        if settings.x402_pay_to:
            logging.info(f"x402 payment enabled: ${settings.x402_price} USDC to {settings.x402_pay_to}")
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

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "agent": settings.agent_name,
        "protocol": "mcp",
        "a2a_backend": settings.a2a_base_url or None,
    }

app.mount("/mcp", mcp_app)

# Wrap the entire ASGI app with x402 payment middleware
if settings.x402_pay_to:
    app = MCPPaymentMiddleware(
        app,
        pay_to=settings.x402_pay_to,
        network=settings.x402_network,
        price=settings.x402_price,
    )

# GT8004 logging wraps OUTSIDE x402 — captures ALL requests including 402s
if _mcp_logger:
    app = GT8004ASGIMiddleware(app, _mcp_logger)


if __name__ == "__main__":
    import uvicorn
    logging.basicConfig(level=getattr(logging, settings.log_level.upper(), logging.INFO))
    uvicorn.run(app, host="0.0.0.0", port=settings.port)
