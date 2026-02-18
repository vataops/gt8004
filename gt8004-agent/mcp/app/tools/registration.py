import json

from shared.api_client import GT8004APIError


def register_tools(mcp, get_client):
    """Register registration-related MCP tools."""

    @mcp.tool()
    async def register_agent(
        wallet_address: str,
        token_id: int,
        chain_id: int,
        tier: str = "open",
    ) -> str:
        """Register an AI agent on GT8004 using an ERC-8004 token.

        The token must be minted on a supported chain (Base 8453, Ethereum 1,
        Base Sepolia 84532, Ethereum Sepolia 11155111). The wallet_address must
        own the token on-chain.

        Returns agent_id and API key. Save the API key — you'll need it for
        all subsequent tool calls.

        Args:
            wallet_address: EVM wallet address that owns the ERC-8004 token (0x...)
            token_id: ERC-8004 token ID on the specified chain
            chain_id: Chain ID (8453=Base, 1=Ethereum, 84532=Base Sepolia, 11155111=Ethereum Sepolia)
            tier: Service tier — 'open' (free) or 'lite' (default: open)
        """
        client = get_client()
        try:
            result = await client.register(wallet_address, token_id, chain_id, tier)
        except GT8004APIError as e:
            return f"Registration failed: {e.detail}"

        return (
            f"Agent registered successfully!\n\n"
            f"Agent ID: {result['agent_id']}\n"
            f"API Key: {result['api_key']}\n"
            f"Tier: {result.get('tier', 'open')}\n"
            f"Dashboard: https://gt8004.xyz{result.get('dashboard_url', '')}\n"
            f"Endpoint: {result.get('gt8004_endpoint', '')}\n\n"
            f"IMPORTANT: Save your API key. You'll need it for all subsequent calls."
        )

    @mcp.tool()
    async def deregister_agent(api_key: str, agent_id: str) -> str:
        """Deregister an agent from GT8004. This action is irreversible — the
        agent will be marked as deregistered and its API key will stop working.

        You can re-register using the same ERC-8004 token later.

        Args:
            api_key: Your GT8004 API key (gt8004_sk_...)
            agent_id: The agent's GT8004 ID (e.g., '8453-a1b2c3')
        """
        client = get_client()
        try:
            await client.deregister(agent_id, api_key)
        except GT8004APIError as e:
            return f"Deregistration failed: {e.detail}"

        return f"Agent {agent_id} has been deregistered."
