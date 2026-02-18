import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)


class GT8004APIError(Exception):
    """Error from the GT8004 API."""

    def __init__(self, status_code: int, detail: str):
        self.status_code = status_code
        self.detail = detail
        super().__init__(f"HTTP {status_code}: {detail}")


class GT8004Client:
    """HTTP client for GT8004 platform API."""

    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip("/")
        self._client: httpx.AsyncClient | None = None

    async def start(self):
        self._client = httpx.AsyncClient(
            base_url=self.base_url,
            timeout=30.0,
        )

    async def close(self):
        if self._client:
            await self._client.aclose()
            self._client = None

    def _auth_headers(self, api_key: str) -> dict[str, str]:
        return {"Authorization": f"Bearer {api_key}"}

    async def _request(
        self,
        method: str,
        path: str,
        api_key: str | None = None,
        json: dict | None = None,
        params: dict | None = None,
    ) -> dict[str, Any]:
        assert self._client is not None, "Client not started"
        headers = self._auth_headers(api_key) if api_key else {}
        resp = await self._client.request(
            method, path, headers=headers, json=json, params=params,
        )
        if resp.status_code >= 400:
            try:
                body = resp.json()
                detail = body.get("error", resp.text)
            except Exception:
                detail = resp.text
            raise GT8004APIError(resp.status_code, detail)
        return resp.json()

    # ── Registration ──

    async def register(
        self,
        wallet_address: str,
        token_id: int,
        chain_id: int,
        tier: str = "open",
    ) -> dict:
        """POST /v1/services/register — register an ERC-8004 agent."""
        return await self._request(
            "POST",
            "/v1/services/register",
            json={
                "wallet_address": wallet_address,
                "erc8004_token_id": token_id,
                "chain_id": chain_id,
                "tier": tier,
            },
        )

    async def deregister(self, agent_id: str, api_key: str) -> dict:
        """DELETE /v1/services/{agent_id} — deregister an agent."""
        return await self._request(
            "DELETE", f"/v1/services/{agent_id}", api_key=api_key,
        )

    # ── Auth / Profile ──

    async def get_me(self, api_key: str) -> dict:
        """GET /v1/agents/me — authenticated agent profile."""
        return await self._request("GET", "/v1/agents/me", api_key=api_key)

    async def get_api_key(self, agent_id: str, api_key: str) -> dict:
        """GET /v1/agents/{agent_id}/api-key — retrieve current API key."""
        return await self._request(
            "GET", f"/v1/agents/{agent_id}/api-key", api_key=api_key,
        )

    async def regenerate_api_key(self, agent_id: str, api_key: str) -> dict:
        """POST /v1/agents/{agent_id}/api-key/regenerate — issue new key."""
        return await self._request(
            "POST", f"/v1/agents/{agent_id}/api-key/regenerate", api_key=api_key,
        )

    # ── Analytics ──

    async def get_stats(self, agent_id: str, api_key: str) -> dict:
        """GET /v1/agents/{agent_id}/stats — snapshot statistics."""
        return await self._request(
            "GET", f"/v1/agents/{agent_id}/stats", api_key=api_key,
        )

    async def get_daily_stats(
        self, agent_id: str, api_key: str, days: int = 30,
    ) -> dict:
        """GET /v1/agents/{agent_id}/stats/daily — daily time-series."""
        return await self._request(
            "GET",
            f"/v1/agents/{agent_id}/stats/daily",
            api_key=api_key,
            params={"days": days},
        )

    async def get_customers(
        self, agent_id: str, api_key: str, limit: int = 50, offset: int = 0,
    ) -> dict:
        """GET /v1/agents/{agent_id}/customers — customer list."""
        return await self._request(
            "GET",
            f"/v1/agents/{agent_id}/customers",
            api_key=api_key,
            params={"limit": limit, "offset": offset},
        )

    async def get_revenue(
        self, agent_id: str, api_key: str, period: str = "monthly",
    ) -> dict:
        """GET /v1/agents/{agent_id}/revenue — revenue report."""
        return await self._request(
            "GET",
            f"/v1/agents/{agent_id}/revenue",
            api_key=api_key,
            params={"period": period},
        )

    async def get_performance(
        self, agent_id: str, api_key: str, window: str = "24h",
    ) -> dict:
        """GET /v1/agents/{agent_id}/performance — performance metrics."""
        return await self._request(
            "GET",
            f"/v1/agents/{agent_id}/performance",
            api_key=api_key,
            params={"window": window},
        )

    async def get_logs(
        self, agent_id: str, api_key: str, limit: int = 50,
    ) -> dict:
        """GET /v1/agents/{agent_id}/logs — recent request logs."""
        return await self._request(
            "GET",
            f"/v1/agents/{agent_id}/logs",
            api_key=api_key,
            params={"limit": limit},
        )

    async def get_funnel(
        self, agent_id: str, api_key: str, days: int = 30,
    ) -> dict:
        """GET /v1/agents/{agent_id}/funnel — conversion funnel."""
        return await self._request(
            "GET",
            f"/v1/agents/{agent_id}/funnel",
            api_key=api_key,
            params={"days": days},
        )

    async def get_analytics(
        self, agent_id: str, api_key: str, days: int = 30,
    ) -> dict:
        """GET /v1/agents/{agent_id}/analytics — full analytics report."""
        return await self._request(
            "GET",
            f"/v1/agents/{agent_id}/analytics",
            api_key=api_key,
            params={"days": days},
        )
