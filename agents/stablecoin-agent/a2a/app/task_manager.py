from typing import Optional, Dict

from app.models import TaskRequest, TaskResponse, TaskStatus, Artifact, Part
from shared.llm.base import LLMBackend
from shared.knowledge import (
    SYSTEM_PROMPT,
    OVERVIEW_PROMPT,
    ANALYZE_PROMPT,
    COMPARE_PROMPT,
    RISK_PROMPT,
)

SKILL_PROMPTS = {
    "overview": OVERVIEW_PROMPT,
    "analyze": ANALYZE_PROMPT,
    "compare": COMPARE_PROMPT,
    "risk": RISK_PROMPT,
}

SKILL_KEYWORDS = {
    "overview": ["overview", "landscape", "summary", "market", "전체", "개요", "현황", "시장"],
    "analyze": ["analyze", "analysis", "deep dive", "detail", "분석", "상세", "설명해"],
    "compare": ["compare", "comparison", "vs", "versus", "difference", "비교", "차이"],
    "risk": ["risk", "danger", "vulnerability", "audit", "리스크", "위험", "취약"],
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
        return "overview"

    def _fail(self, task_id: str, error: str) -> TaskResponse:
        response = TaskResponse(
            id=task_id,
            status=TaskStatus(state="failed"),
            artifacts=[Artifact(parts=[Part(text=f"Error: {error}")])],
        )
        self._tasks[task_id] = response
        return response
