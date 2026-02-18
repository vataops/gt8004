import json

from shared.api_client import GT8004APIError


def _fmt(data: dict | list, indent: int = 2) -> str:
    """Format a JSON-serialisable object as a compact, readable string."""
    return json.dumps(data, indent=indent, ensure_ascii=False, default=str)


def register_tools(mcp, get_client):
    """Register analytics-related MCP tools."""

    @mcp.tool()
    async def get_agent_profile(api_key: str) -> str:
        """Get the authenticated agent's full profile — name, tier, status,
        ERC-8004 details, and registration info.

        Args:
            api_key: Your GT8004 API key (gt8004_sk_...)
        """
        client = get_client()
        try:
            profile = await client.get_me(api_key)
        except GT8004APIError as e:
            return f"Failed: {e.detail}"

        name = profile.get("name", "unnamed")
        agent_id = profile.get("agent_id", "")
        status = profile.get("status", "")
        tier = profile.get("current_tier", "")
        chain_id = profile.get("chain_id", "")
        evm = profile.get("evm_address", "")
        token_id = profile.get("erc8004_token_id")
        protocols = profile.get("protocols", [])
        total_req = profile.get("total_requests", 0)
        total_rev = profile.get("total_revenue_usdc", 0)
        created = profile.get("created_at", "")

        lines = [
            f"Agent: {name}",
            f"Agent ID: {agent_id}",
            f"Status: {status}",
            f"Tier: {tier}",
            f"Chain: {chain_id}",
            f"Wallet: {evm}",
        ]
        if token_id is not None:
            lines.append(f"ERC-8004 Token: #{token_id}")
        if protocols:
            lines.append(f"Protocols: {', '.join(protocols)}")
        lines += [
            f"Total Requests: {total_req:,}",
            f"Total Revenue: ${total_rev:.2f} USDC",
            f"Registered: {created}",
        ]
        return "\n".join(lines)

    @mcp.tool()
    async def get_stats(api_key: str, agent_id: str) -> str:
        """Get snapshot statistics for an agent — total requests, today's
        requests, revenue, average response time, and error rate.

        Args:
            api_key: Your GT8004 API key
            agent_id: The agent's GT8004 ID (e.g., '8453-a1b2c3')
        """
        client = get_client()
        try:
            data = await client.get_stats(agent_id, api_key)
        except GT8004APIError as e:
            return f"Failed: {e.detail}"

        return (
            f"Stats for {agent_id}\n\n"
            f"Total Requests: {data.get('total_requests', 0):,}\n"
            f"Today: {data.get('today_requests', 0):,}\n"
            f"This Week: {data.get('week_requests', 0):,}\n"
            f"This Month: {data.get('month_requests', 0):,}\n"
            f"Revenue: ${data.get('total_revenue_usdc', 0):.2f} USDC\n"
            f"Avg Response: {data.get('avg_response_ms', 0):.0f}ms\n"
            f"Error Rate: {data.get('error_rate', 0):.1%}"
        )

    @mcp.tool()
    async def get_daily_stats(
        api_key: str, agent_id: str, days: int = 30,
    ) -> str:
        """Get daily time-series statistics for an agent — request count,
        revenue, and response time per day.

        Args:
            api_key: Your GT8004 API key
            agent_id: The agent's GT8004 ID
            days: Number of days of history (1-365, default 30)
        """
        client = get_client()
        try:
            data = await client.get_daily_stats(agent_id, api_key, days)
        except GT8004APIError as e:
            return f"Failed: {e.detail}"

        items = data if isinstance(data, list) else data.get("daily", data.get("stats", []))
        if not items:
            return f"No daily data for {agent_id} in the last {days} days."

        lines = [f"Daily Stats for {agent_id} (last {days} days)\n"]
        for day in items[-14:]:  # Show last 14 days max for readability
            date = day.get("date", "?")
            reqs = day.get("requests", day.get("total_requests", 0))
            rev = day.get("revenue", day.get("total_revenue", 0))
            lines.append(f"  {date}: {reqs:,} requests, ${rev:.2f}")

        if len(items) > 14:
            lines.append(f"\n  ... showing last 14 of {len(items)} days")
        return "\n".join(lines)

    @mcp.tool()
    async def get_customers(
        api_key: str, agent_id: str, limit: int = 50,
    ) -> str:
        """Get the customer list for an agent — unique callers, their request
        counts, revenue, and last seen time.

        Args:
            api_key: Your GT8004 API key
            agent_id: The agent's GT8004 ID
            limit: Max number of customers to return (1-200, default 50)
        """
        client = get_client()
        try:
            data = await client.get_customers(agent_id, api_key, limit)
        except GT8004APIError as e:
            return f"Failed: {e.detail}"

        customers = data if isinstance(data, list) else data.get("customers", [])
        total = data.get("total", len(customers)) if isinstance(data, dict) else len(customers)

        if not customers:
            return f"No customers found for {agent_id}."

        lines = [f"Customers for {agent_id} ({total} total)\n"]
        for c in customers[:20]:
            cid = c.get("customer_id", "?")
            reqs = c.get("total_requests", 0)
            rev = c.get("total_revenue", 0)
            last = c.get("last_seen_at", "?")
            lines.append(f"  {cid}: {reqs:,} requests, ${rev:.2f}, last seen {last}")

        if len(customers) > 20:
            lines.append(f"\n  ... showing 20 of {len(customers)} customers")
        return "\n".join(lines)

    @mcp.tool()
    async def get_revenue(
        api_key: str, agent_id: str, period: str = "monthly",
    ) -> str:
        """Get revenue report for an agent — total revenue, breakdown by period,
        and revenue per tool.

        Args:
            api_key: Your GT8004 API key
            agent_id: The agent's GT8004 ID
            period: 'monthly' or 'weekly' (default: monthly)
        """
        client = get_client()
        try:
            data = await client.get_revenue(agent_id, api_key, period)
        except GT8004APIError as e:
            return f"Failed: {e.detail}"

        return f"Revenue Report for {agent_id} ({period})\n\n{_fmt(data)}"

    @mcp.tool()
    async def get_performance(
        api_key: str, agent_id: str, window: str = "24h",
    ) -> str:
        """Get performance metrics for an agent — latency percentiles (p50/p95/p99),
        error rate, throughput, and uptime.

        Args:
            api_key: Your GT8004 API key
            agent_id: The agent's GT8004 ID
            window: Time window — '1h', '24h', or '72h' (default: 24h)
        """
        client = get_client()
        try:
            data = await client.get_performance(agent_id, api_key, window)
        except GT8004APIError as e:
            return f"Failed: {e.detail}"

        return f"Performance for {agent_id} (window: {window})\n\n{_fmt(data)}"

    @mcp.tool()
    async def get_logs(
        api_key: str, agent_id: str, limit: int = 50,
    ) -> str:
        """Get recent request logs for an agent — method, path, status code,
        response time, and customer info for each request.

        Args:
            api_key: Your GT8004 API key
            agent_id: The agent's GT8004 ID
            limit: Max number of logs (1-200, default 50)
        """
        client = get_client()
        try:
            data = await client.get_logs(agent_id, api_key, limit)
        except GT8004APIError as e:
            return f"Failed: {e.detail}"

        logs = data if isinstance(data, list) else data.get("logs", [])
        if not logs:
            return f"No logs found for {agent_id}."

        lines = [f"Recent Logs for {agent_id} ({len(logs)} entries)\n"]
        for log in logs[:30]:
            ts = log.get("created_at", "?")
            method = log.get("method", "?")
            path = log.get("path", "?")
            status = log.get("status_code", "?")
            ms = log.get("response_ms", 0)
            tool = log.get("tool_name", "")
            tool_str = f" [{tool}]" if tool else ""
            lines.append(f"  {ts} {method} {path} → {status} ({ms}ms){tool_str}")

        if len(logs) > 30:
            lines.append(f"\n  ... showing 30 of {len(logs)} logs")
        return "\n".join(lines)

    @mcp.tool()
    async def get_conversion_funnel(
        api_key: str, agent_id: str, days: int = 30,
    ) -> str:
        """Get x402 payment conversion funnel for an agent — how many MCP users
        convert to A2A, and how many A2A users convert to paid.

        Args:
            api_key: Your GT8004 API key
            agent_id: The agent's GT8004 ID
            days: Number of days of history (1-90, default 30)
        """
        client = get_client()
        try:
            data = await client.get_funnel(agent_id, api_key, days)
        except GT8004APIError as e:
            return f"Failed: {e.detail}"

        summary = data.get("summary", data)
        lines = [
            f"Conversion Funnel for {agent_id} (last {days} days)\n",
            f"MCP Customers: {summary.get('mcp_customers', 0)}",
            f"MCP → A2A: {summary.get('mcp_to_a2a', 0)} ({summary.get('mcp_to_a2a_rate', 0):.1%})",
            f"A2A → Paid: {summary.get('a2a_to_paid', 0)} ({summary.get('a2a_to_paid_rate', 0):.1%})",
            f"Total Paid: {summary.get('paid_customers', 0)}",
            f"Full Funnel Rate: {summary.get('full_funnel_rate', 0):.1%}",
        ]
        return "\n".join(lines)

    @mcp.tool()
    async def get_analytics_report(
        api_key: str, agent_id: str, days: int = 30,
    ) -> str:
        """Get a comprehensive analytics report — protocol breakdown (HTTP/MCP/A2A),
        tool usage ranking, health metrics, customer intelligence, revenue summary,
        and daily trends all in one call.

        Args:
            api_key: Your GT8004 API key
            agent_id: The agent's GT8004 ID
            days: Number of days of history (1-90, default 30)
        """
        client = get_client()
        try:
            data = await client.get_analytics(agent_id, api_key, days)
        except GT8004APIError as e:
            return f"Failed: {e.detail}"

        return f"Analytics Report for {agent_id} (last {days} days)\n\n{_fmt(data)}"
