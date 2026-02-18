from typing import Optional, Dict

from app.models import TaskRequest, TaskResponse, TaskStatus, Artifact, Part
from shared.llm.base import LLMBackend
from shared.knowledge import (
    SYSTEM_PROMPT,
    CURRENT_PROMPT,
    OPTIMIZE_PROMPT,
    COMPARE_PROMPT,
    MECHANICS_PROMPT,
)

SKILL_PROMPTS = {
    "current": CURRENT_PROMPT,
    "optimize": OPTIMIZE_PROMPT,
    "compare": COMPARE_PROMPT,
    "mechanics": MECHANICS_PROMPT,
}

SKILL_KEYWORDS = {
    "current": ["current", "now", "price", "fee", "cost", "현재", "가격", "수수료"],
    "optimize": ["optimize", "save", "reduce", "cheap", "efficient", "최적화", "절약", "절감"],
    "compare": ["compare", "versus", "vs", "difference", "비교", "차이"],
    "mechanics": ["mechanic", "eip", "1559", "blob", "4844", "how", "work", "메커니즘", "원리"],
}


class TaskManager:
    def __init__(self):
        self._tasks: Dict[str, TaskResponse] = {}

    async def submit(self, request: TaskRequest, llm: LLMBackend) -> TaskResponse:
        task_id = request.id
        self._tasks[task_id] = TaskResponse(
            id=task_id, status=TaskStatus(state="working")
        )

        user_text = ""
        for part in request.message.parts:
            if part.text:
                user_text += part.text

        if not user_text:
            return self._fail(task_id, "Empty message")

        skill_id = request.skill_id or self._detect_skill(user_text)
        system_prompt = SKILL_PROMPTS.get(skill_id, SYSTEM_PROMPT)

        try:
            result = await llm.generate(user_text, system_prompt=system_prompt)
        except Exception as e:
            return self._fail(task_id, str(e))

        response = TaskResponse(
            id=task_id,
            status=TaskStatus(state="completed"),
            artifacts=[Artifact(parts=[Part(text=result)])],
        )
        self._tasks[task_id] = response
        return response

    def get(self, task_id: str) -> Optional[TaskResponse]:
        return self._tasks.get(task_id)

    def _detect_skill(self, text: str) -> str:
        text_lower = text.lower()
        for skill_id, keywords in SKILL_KEYWORDS.items():
            if any(kw in text_lower for kw in keywords):
                return skill_id
        return "current"

    def _fail(self, task_id: str, error: str) -> TaskResponse:
        response = TaskResponse(
            id=task_id,
            status=TaskStatus(state="failed"),
            artifacts=[Artifact(parts=[Part(text=f"Error: {error}")])],
        )
        self._tasks[task_id] = response
        return response
