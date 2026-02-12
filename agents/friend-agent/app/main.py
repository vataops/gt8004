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
_gt8004_logger = None


def get_llm() -> LLMBackend:
    assert _llm is not None, "LLM backend not initialized"
    return _llm


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _llm, _gt8004_logger
    _llm = create_backend(settings.openai_api_key, settings.llm_model)
    logging.info(f"LLM backend: OpenAI ({settings.llm_model})")

    # Start GT8004 SDK auto-flush and verify connection
    if _gt8004_logger:
        _gt8004_logger.transport.start_auto_flush()
        logging.info("GT8004 SDK: auto-flush started")
        ok = await _gt8004_logger.verify_connection()
        if ok:
            logging.info("GT8004 SDK: connection verified")
        else:
            logging.warning("GT8004 SDK: connection verification failed")

    yield

    # Graceful shutdown: flush pending logs
    if _gt8004_logger:
        await _gt8004_logger.close()
        logging.info("GT8004 SDK: closed")
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

# GT8004 SDK middleware — capture all requests for analytics
if settings.gt8004_agent_id and settings.gt8004_api_key:
    from gt8004 import GT8004Logger
    from gt8004.middleware.fastapi import GT8004Middleware

    _gt8004_logger = GT8004Logger(
        agent_id=settings.gt8004_agent_id,
        api_key=settings.gt8004_api_key,
        ingest_url=settings.gt8004_ingest_url,
    )
    app.add_middleware(GT8004Middleware, logger=_gt8004_logger)
    logging.info(f"GT8004 SDK: enabled for agent {settings.gt8004_agent_id}")

app.include_router(a2a_router)


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "agent": settings.agent_name,
        "llm_model": settings.llm_model,
    }


if __name__ == "__main__":
    import uvicorn

    logging.basicConfig(level=getattr(logging, settings.log_level.upper(), logging.INFO))
    uvicorn.run(app, host="0.0.0.0", port=settings.port)
