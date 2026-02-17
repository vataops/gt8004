"""
GT8004 Stablecoin MCP Bot — quick test client (SSE transport).

Usage:
    python bot/test_mcp.py                    # list tools
    python bot/test_mcp.py about              # call 'about' tool
    python bot/test_mcp.py analyze DAI        # call 'analyze' with stablecoin arg
    python bot/test_mcp.py compare "DAI,LUSD" # call 'compare'
    python bot/test_mcp.py risk GHO           # call 'risk'

Requires Python 3.10+ and mcp SDK:
    pip install mcp
"""

import asyncio
import sys

MCP_URL = "https://stablecoin-mcp-176882932608.us-central1.run.app"


async def main():
    try:
        from mcp import ClientSession
        from mcp.client.sse import sse_client
    except ImportError:
        sys.exit("Install the MCP SDK first:  pip install mcp")

    tool_name = sys.argv[1] if len(sys.argv) > 1 else None
    tool_arg = sys.argv[2] if len(sys.argv) > 2 else None

    # Try /mcp/sse first (FastAPI mount path), then /sse
    for sse_path in ["/mcp/sse", "/sse"]:
        sse_url = f"{MCP_URL}{sse_path}"
        print(f"Connecting to {sse_url} ...")
        try:
            async with sse_client(sse_url) as (read, write):
                async with ClientSession(read, write) as session:
                    await session.initialize()
                    print("Connected!\n")

                    # List available tools
                    tools = await session.list_tools()
                    print(f"Available tools ({len(tools.tools)}):")
                    for t in tools.tools:
                        desc = t.description[:80] if t.description else ""
                        print(f"  - {t.name}: {desc}...")
                    print()

                    if not tool_name:
                        print("Pass a tool name as argument to call it. Example: python bot/test_mcp.py about")
                        return

                    # Build arguments
                    args = {}
                    if tool_name in ("analyze", "risk") and tool_arg:
                        args = {"stablecoin": tool_arg}
                    elif tool_name == "compare" and tool_arg:
                        args = {"coins": tool_arg}

                    print(f"Calling tool '{tool_name}' with args: {args}")
                    print("-" * 60)

                    result = await session.call_tool(tool_name, args)

                    for content in result.content:
                        if hasattr(content, "text"):
                            print(content.text)
                        else:
                            print(content)

                    print("-" * 60)
                    print("Done!")
                    return
        except Exception as e:
            print(f"  Failed: {e}\n")
            continue

    print("Could not connect to MCP server on any SSE path.")


if __name__ == "__main__":
    asyncio.run(main())
