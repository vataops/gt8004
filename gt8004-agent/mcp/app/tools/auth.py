import json

from shared.api_client import GT8004APIError


def register_tools(mcp, get_client):
    """Register auth-related MCP tools."""

    @mcp.tool()
    async def authenticate(api_key: str) -> str:
        """Verify an existing GT8004 API key and retrieve the agent profile.

        Use this if you already have an API key from a previous registration.

        Args:
            api_key: GT8004 API key (gt8004_sk_...)
        """
        client = get_client()
        try:
            profile = await client.get_me(api_key)
        except GT8004APIError as e:
            return f"Authentication failed: {e.detail}"

        agent_id = profile.get("agent_id", "unknown")
        name = profile.get("name", "unnamed")
        status = profile.get("status", "unknown")
        tier = profile.get("current_tier", "unknown")

        return (
            f"Authenticated successfully!\n\n"
            f"Agent: {name}\n"
            f"Agent ID: {agent_id}\n"
            f"Status: {status}\n"
            f"Tier: {tier}"
        )

    @mcp.tool()
    async def get_api_key(api_key: str, agent_id: str) -> str:
        """Retrieve the current active API key for an agent.

        Args:
            api_key: Your GT8004 API key for authentication
            agent_id: The agent's GT8004 ID (e.g., '8453-a1b2c3')
        """
        client = get_client()
        try:
            result = await client.get_api_key(agent_id, api_key)
        except GT8004APIError as e:
            return f"Failed to retrieve API key: {e.detail}"

        return f"Active API key: {result.get('api_key', 'not found')}"

    @mcp.tool()
    async def regenerate_api_key(api_key: str, agent_id: str) -> str:
        """Generate a new API key for an agent. The old key will be revoked
        immediately. Save the new key — you'll need it for all subsequent calls.

        Args:
            api_key: Your current GT8004 API key for authentication
            agent_id: The agent's GT8004 ID (e.g., '8453-a1b2c3')
        """
        client = get_client()
        try:
            result = await client.regenerate_api_key(agent_id, api_key)
        except GT8004APIError as e:
            return f"Failed to regenerate API key: {e.detail}"

        return (
            f"API key regenerated successfully!\n\n"
            f"New API key: {result.get('api_key', 'error')}\n\n"
            f"IMPORTANT: Your old API key has been revoked. Use this new key."
        )
