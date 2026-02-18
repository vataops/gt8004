from typing import Optional, Dict

from app.models import TaskRequest, TaskResponse, TaskStatus, Artifact, Part
from shared.llm.base import LLMBackend
from shared.knowledge import (
    SYSTEM_PROMPT,
    PROFILE_PROMPT,
    PORTFOLIO_PROMPT,
    RISK_PROMPT,
    ACTIVITY_PROMPT,
)

SKILL_PROMPTS = {
    "profile": PROFILE_PROMPT,
    "portfolio": PORTFOLIO_PROMPT,
    "risk": RISK_PROMPT,
    "activity": ACTIVITY_PROMPT,
}

SKILL_KEYWORDS = {
    "profile": ["wallet", "address", "profile", "who", "지갑", "주소", "프로필"],
    "portfolio": ["portfolio", "holdings", "tokens", "assets", "balance", "포트폴리오", "자산", "보유"],
    "risk": ["risk", "danger", "safe", "security", "위험", "리스크", "안전"],
    "activity": ["activity", "transactions", "history", "transfers", "활동", "거래", "트랜잭션"],
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
        return "profile"

    def _fail(self, task_id: str, error: str) -> TaskResponse:
        response = TaskResponse(
            id=task_id,
            status=TaskStatus(state="failed"),
            artifacts=[Artifact(parts=[Part(text=f"Error: {error}")])],
        )
        self._tasks[task_id] = response
        return response
