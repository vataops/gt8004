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


def get_llm() -> LLMBackend:
    assert _llm is not None, "LLM backend not initialized"
    return _llm


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _llm
    _llm = create_backend(settings.openai_api_key, settings.llm_model)
    logging.info(f"LLM backend: OpenAI ({settings.llm_model})")
    yield
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
