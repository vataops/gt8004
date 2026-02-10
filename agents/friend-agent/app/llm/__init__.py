from app.llm.base import LLMBackend
from app.llm.openai_backend import OpenAIBackend


def create_backend(api_key: str, model: str) -> LLMBackend:
    return OpenAIBackend(api_key=api_key, model=model)
