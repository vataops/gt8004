from abc import ABC, abstractmethod
from typing import Optional


class LLMBackend(ABC):
    @abstractmethod
    async def generate(self, message: str, system_prompt: Optional[str] = None) -> str: ...
