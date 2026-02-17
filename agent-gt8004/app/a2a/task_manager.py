from typing import Optional, Dict

from app.a2a.models import TaskRequest, TaskResponse, TaskStatus, Artifact, Part
from app.llm.base import LLMBackend
from app.knowledge import (
    SYSTEM_PROMPT,
    SDK_GUIDE_PROMPT,
    TROUBLESHOOT_PROMPT,
    REGISTRATION_PROMPT,
)

SKILL_PROMPTS = {
    "help": SYSTEM_PROMPT,
    "sdk": SDK_GUIDE_PROMPT,
    "register": REGISTRATION_PROMPT,
    "troubleshoot": TROUBLESHOOT_PROMPT,
}

# Keywords for auto-detecting skill from message
SKILL_KEYWORDS = {
    "sdk": ["sdk", "integrate", "integration", "middleware", "pip install", "연동", "설치", "미들웨어"],
    "register": ["register", "mint", "erc-8004", "erc8004", "token", "등록", "민팅", "토큰"],
    "troubleshoot": ["error", "bug", "fail", "not working", "500", "에러", "오류", "안돼", "안됨", "문제"],
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
            artifacts=[
                Artifact(parts=[Part(text=result)])
            ],
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
        return "help"

    def _fail(self, task_id: str, error: str) -> TaskResponse:
        response = TaskResponse(
            id=task_id,
            status=TaskStatus(state="failed"),
            artifacts=[
                Artifact(parts=[Part(text=f"Error: {error}")])
            ],
        )
        self._tasks[task_id] = response
        return response
