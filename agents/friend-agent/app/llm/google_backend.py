from typing import Optional

import google.generativeai as genai
from app.llm.base import LLMBackend


class GoogleBackend(LLMBackend):
    def __init__(self, api_key: str, model: str = "gemini-2.0-flash"):
        genai.configure(api_key=api_key)
        self.model_name = model

    async def generate(self, message: str, system_prompt: Optional[str] = None) -> str:
        model = genai.GenerativeModel(
            self.model_name,
            system_instruction=system_prompt,
        )
        response = await model.generate_content_async(message)
        return response.text or ""
