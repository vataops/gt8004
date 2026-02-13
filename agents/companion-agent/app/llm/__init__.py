from app.llm.base import LLMBackend
from app.llm.google_backend import GoogleBackend


def create_backend(api_key: str, model: str) -> LLMBackend:
    return GoogleBackend(api_key=api_key, model=model)
