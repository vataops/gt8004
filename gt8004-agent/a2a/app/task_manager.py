import re
import logging
from typing import Optional, Dict

from app.models import TaskRequest, TaskResponse, TaskStatus, Artifact, Part
from shared.llm.base import LLMBackend
from shared.knowledge import (
    SYSTEM_PROMPT,
    REGISTER_PROMPT,
    ANALYTICS_PROMPT,
    REVENUE_PROMPT,
    PERFORMANCE_PROMPT,
    GUIDE_PROMPT,
)

logger = logging.getLogger(__name__)

SKILL_PROMPTS = {
    "register": REGISTER_PROMPT,
    "analytics": ANALYTICS_PROMPT,
    "revenue": REVENUE_PROMPT,
    "performance": PERFORMANCE_PROMPT,
    "guide": GUIDE_PROMPT,
}

SKILL_KEYWORDS = {
    "register": ["register", "등록", "onboard", "signup", "mint", "erc-8004", "erc8004", "토큰"],
    "analytics": ["analytics", "stats", "분석", "통계", "requests", "요청", "daily", "customers", "고객"],
    "revenue": ["revenue", "수익", "매출", "payment", "결제", "x402", "funnel", "전환", "arpu"],
    "performance": ["performance", "성능", "latency", "레이턴시", "error", "에러", "p95", "p99", "uptime"],
    "guide": ["guide", "가이드", "help", "도움", "how", "어떻게", "what", "뭐", "start", "시작", "sdk"],
}

_API_KEY_PATTERN = re.compile(r"gt8004_sk_[a-f0-9]+")
_AGENT_ID_PATTERN = re.compile(r"\b\d+-[a-f0-9]{6}\b")


class TaskManager:
    def __init__(self, api_client=None):
        self._tasks: Dict[str, TaskResponse] = {}
        self._api_client = api_client

    def set_api_client(self, client):
        self._api_client = client

    async def submit(self, request: TaskRequest, llm: LLMBackend) -> TaskResponse:
        task_id = request.id
        self._tasks[task_id] = TaskResponse(
            id=task_id, status=TaskStatus(state="working"),
        )

        user_text = ""
        for part in request.message.parts:
            if part.text:
                user_text += part.text

        if not user_text:
            return self._fail(task_id, "Empty message")

        skill_id = request.skill_id or self._detect_skill(user_text)
        system_prompt = SKILL_PROMPTS.get(skill_id, SYSTEM_PROMPT)

        # Try to extract credentials and fetch real data
        api_data = await self._fetch_api_data(user_text, skill_id)
        if api_data:
            user_text = f"{user_text}\n\n--- GT8004 API Data ---\n{api_data}"

        try:
            result = await llm.generate(user_text, system_prompt=system_prompt)
        except Exception as e:
            logger.error(f"LLM generation failed: {e}")
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

    async def _fetch_api_data(self, text: str, skill_id: str) -> Optional[str]:
        """Extract api_key + agent_id from message and fetch relevant data."""
        if not self._api_client:
            return None

        api_key_match = _API_KEY_PATTERN.search(text)
        agent_id_match = _AGENT_ID_PATTERN.search(text)

        if not api_key_match or not agent_id_match:
            return None

        api_key = api_key_match.group()
        agent_id = agent_id_match.group()

        try:
            if skill_id == "revenue":
                data = await self._api_client.get_revenue(agent_id, api_key)
                return f"Revenue data for {agent_id}:\n{data}"
            elif skill_id == "performance":
                data = await self._api_client.get_performance(agent_id, api_key)
                return f"Performance data for {agent_id}:\n{data}"
            elif skill_id in ("analytics", "register"):
                data = await self._api_client.get_stats(agent_id, api_key)
                return f"Stats for {agent_id}:\n{data}"
            else:
                data = await self._api_client.get_stats(agent_id, api_key)
                return f"Stats for {agent_id}:\n{data}"
        except Exception as e:
            logger.warning(f"API fetch failed: {e}")
            return None

    def _detect_skill(self, text: str) -> str:
        text_lower = text.lower()
        for skill_id, keywords in SKILL_KEYWORDS.items():
            if any(kw in text_lower for kw in keywords):
                return skill_id
        return "guide"

    def _fail(self, task_id: str, error: str) -> TaskResponse:
        response = TaskResponse(
            id=task_id,
            status=TaskStatus(state="failed"),
            artifacts=[Artifact(parts=[Part(text=f"Error: {error}")])],
        )
        self._tasks[task_id] = response
        return response
