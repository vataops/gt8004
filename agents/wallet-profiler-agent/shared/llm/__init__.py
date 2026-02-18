from shared.llm.google_backend import GoogleBackend
from shared.llm.base import LLMBackend


def create_backend(api_key: str, model: str) -> LLMBackend:
    return GoogleBackend(api_key=api_key, model=model)
