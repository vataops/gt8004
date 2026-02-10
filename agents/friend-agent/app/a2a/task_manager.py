from typing import Optional, Dict

from app.a2a.models import TaskRequest, TaskResponse, TaskStatus, Artifact, Part
from app.llm.base import LLMBackend

SKILL_PROMPTS = {
    "chat": None,
    "summarize": "You are a summarization assistant. Provide a concise summary of the given text. Respond in the same language as the input.",
    "translate": "You are a translation assistant. Translate the given text to the requested language. If no target language is specified, translate to English.",
    "code-assist": "You are a coding assistant. Help with code questions, debugging, and implementation. Provide clear, working code examples.",
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

        skill_id = request.skill_id or "chat"
        system_prompt = SKILL_PROMPTS.get(skill_id)

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
