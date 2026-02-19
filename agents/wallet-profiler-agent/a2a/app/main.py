import logging
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from shared.config import settings
from shared.llm import create_backend
from shared.llm.base import LLMBackend
from app.routes import router as a2a_router

_llm: Optional[LLMBackend] = None
_a2a_logger = None


def get_llm() -> LLMBackend:
    assert _llm is not None, "LLM backend not initialized"
    return _llm


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _llm, _a2a_logger
    _llm = create_backend(settings.google_api_key, settings.llm_model)
    logging.info(f"LLM backend: Google AI Studio ({settings.llm_model})")

    if _a2a_logger:
        _a2a_logger.transport.start_auto_flush()
        ok = await _a2a_logger.verify_connection()
        logging.info(f"GT8004 A2A SDK: {'verified' if ok else 'failed'}")
    yield
    if _a2a_logger:
        await _a2a_logger.close()
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

if settings.gt8004_agent_id and settings.gt8004_api_key:
    from gt8004 import GT8004Logger
    from gt8004.middleware.fastapi import GT8004Middleware
    _a2a_logger = GT8004Logger(
        agent_id=settings.gt8004_agent_id,
        api_key=settings.gt8004_api_key,
        ingest_url=settings.gt8004_ingest_url,
        protocol="a2a",
    )
    app.add_middleware(GT8004Middleware, logger=_a2a_logger)

if settings.x402_pay_to:
    # Fix: Base mainnet USDC contract name() returns "USD Coin", not "USDC"
    from fastapi_x402.networks import NETWORK_CONFIGS
    if "base" in NETWORK_CONFIGS and "usdc" in NETWORK_CONFIGS["base"].assets:
        NETWORK_CONFIGS["base"].assets["usdc"].eip712_name = "USD Coin"
    from fastapi_x402 import init_x402
    init_x402(app, pay_to=settings.x402_pay_to, network=settings.x402_network)
    logging.info(f"x402 payment enabled: {settings.x402_price} USDC to {settings.x402_pay_to}")

app.include_router(a2a_router)


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "agent": settings.agent_name,
        "llm_model": settings.llm_model,
        "protocol": "a2a",
    }


if __name__ == "__main__":
    import uvicorn
    logging.basicConfig(level=getattr(logging, settings.log_level.upper(), logging.INFO))
    uvicorn.run(app, host="0.0.0.0", port=settings.port)
