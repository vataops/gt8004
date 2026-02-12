"""
GT8004 Bot Agent — sends diverse requests to Friend-Agent and logs everything.
Usage: python main.py [--url URL] [--delay SECONDS]
"""

import argparse
import asyncio
import json
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

import httpx

FRIEND_AGENT_URL = "https://friend-agent-176882932608.us-central1.run.app"

# 20 requests across all 4 skills, reflecting real-world agent usage patterns
REQUESTS = [
    # ── Chat (general conversation) ──
    {"skill_id": "chat", "text": "What is ERC-8004 and how does it relate to on-chain agent identity?"},
    {"skill_id": "chat", "text": "Explain the difference between A2A protocol and MCP protocol in one paragraph."},
    {"skill_id": "chat", "text": "What are the benefits of decentralized agent registries?"},
    {"skill_id": "chat", "text": "How does x402 payment protocol work for agent-to-agent transactions?"},
    {"skill_id": "chat", "text": "What is the role of reputation scores in agent networks?"},

    # ── Summarize ──
    {"skill_id": "summarize", "text": (
        "The Agent-to-Agent (A2A) protocol enables AI agents to communicate and collaborate "
        "without sharing internal architectures. It uses JSON-RPC over HTTPS, supports task "
        "lifecycle management with states like submitted, working, completed, and failed. "
        "Agents discover each other through well-known agent cards published at "
        "/.well-known/agent.json endpoints. The protocol supports both synchronous request-response "
        "and streaming via SSE for long-running tasks."
    )},
    {"skill_id": "summarize", "text": (
        "Smart contracts on Ethereum enable trustless execution of agreements. ERC-8004 extends "
        "this concept to AI agents by providing on-chain identity, metadata storage, and "
        "reputation tracking. Each agent is represented as an NFT with a unique token ID, "
        "and its capabilities are described in metadata stored on-chain or via IPFS. "
        "The registry allows clients to verify agent authenticity before interaction."
    )},
    {"skill_id": "summarize", "text": (
        "Observability in distributed agent systems requires capturing request logs, response "
        "times, error rates, and customer analytics. The GT8004 SDK automatically instruments "
        "HTTP middleware to collect this data, batches it for efficiency, and sends it to a "
        "centralized ingest service. The data is then enriched with geo-IP information, "
        "customer tracking, and revenue attribution before being stored in PostgreSQL."
    )},
    {"skill_id": "summarize", "text": (
        "WebSocket connections allow real-time bidirectional communication between clients and "
        "servers. Unlike HTTP polling, WebSockets maintain a persistent connection, reducing "
        "latency and overhead. In agent networks, WebSockets are used for streaming responses, "
        "live dashboard updates, and event-driven notifications. The protocol starts as an HTTP "
        "upgrade request and then switches to a full-duplex TCP connection."
    )},
    {"skill_id": "summarize", "text": (
        "Rate limiting protects APIs from abuse and ensures fair usage. Token bucket algorithms "
        "allow bursts of traffic while maintaining a steady average rate. In agent gateways, "
        "rate limits are typically applied per API key or per customer ID. When limits are "
        "exceeded, the gateway returns HTTP 429 with a Retry-After header. Sophisticated "
        "implementations use Redis for distributed rate limiting across multiple gateway instances."
    )},

    # ── Translate ──
    {"skill_id": "translate", "text": "Translate to Korean: The agent successfully completed the task and returned a valid response."},
    {"skill_id": "translate", "text": "Translate to Japanese: Please check the API documentation for authentication requirements."},
    {"skill_id": "translate", "text": "Translate to Spanish: The blockchain transaction was confirmed in 12 seconds with minimal gas fees."},
    {"skill_id": "translate", "text": "Translate to French: Our decentralized agent network now supports over 500 registered agents."},
    {"skill_id": "translate", "text": "Translate to Chinese: Real-time analytics dashboard shows 99.9% uptime across all services."},

    # ── Code Assist ──
    {"skill_id": "code-assist", "text": "Write a Python function that validates an Ethereum address using regex."},
    {"skill_id": "code-assist", "text": "Show me how to make a POST request with retry logic in Python using httpx."},
    {"skill_id": "code-assist", "text": "Write a simple rate limiter class in Python using the token bucket algorithm."},
    {"skill_id": "code-assist", "text": "How do I parse a JSON-RPC 2.0 request in Python? Show a minimal example."},
    {"skill_id": "code-assist", "text": "Write a FastAPI middleware that measures and logs request duration."},
]


def build_payload(skill_id: str, text: str) -> dict:
    return {
        "id": f"bot-{uuid.uuid4().hex[:12]}",
        "skill_id": skill_id,
        "message": {
            "role": "user",
            "parts": [{"type": "text", "text": text}],
        },
    }


async def send_request(
    client: httpx.AsyncClient,
    url: str,
    skill_id: str,
    text: str,
    index: int,
    results: list,
):
    payload = build_payload(skill_id, text)
    ts_start = time.monotonic()
    started_at = datetime.now(timezone.utc).isoformat()

    entry = {
        "index": index + 1,
        "skill_id": skill_id,
        "request": {
            "text": text[:120] + ("..." if len(text) > 120 else ""),
            "full_text": text,
            "payload": payload,
        },
        "started_at": started_at,
    }

    try:
        resp = await client.post(
            f"{url}/a2a/tasks/send",
            json=payload,
            timeout=30.0,
        )
        elapsed_ms = round((time.monotonic() - ts_start) * 1000)
        body = resp.json()

        state = body.get("status", {}).get("state", "unknown")
        artifacts = body.get("artifacts", [])
        response_text = ""
        if artifacts:
            parts = artifacts[0].get("parts", [])
            if parts:
                response_text = parts[0].get("text", "")

        entry["response"] = {
            "status_code": resp.status_code,
            "state": state,
            "text": response_text[:200] + ("..." if len(response_text) > 200 else ""),
            "full_text": response_text,
            "elapsed_ms": elapsed_ms,
            "task_id": body.get("id", ""),
        }

        icon = "OK" if state == "completed" else "FAIL"
        print(f"  [{index+1:2d}/20] [{icon:4s}] {skill_id:<12s} {elapsed_ms:>5d}ms  {text[:60]}...")

    except Exception as exc:
        elapsed_ms = round((time.monotonic() - ts_start) * 1000)
        entry["response"] = {
            "error": str(exc),
            "elapsed_ms": elapsed_ms,
        }
        print(f"  [{index+1:2d}/20] [ERR ] {skill_id:<12s} {elapsed_ms:>5d}ms  {str(exc)[:60]}")

    results.append(entry)


async def run(url: str, delay: float):
    print(f"\n{'='*70}")
    print(f"  GT8004 Bot Agent")
    print(f"  Target: {url}")
    print(f"  Requests: {len(REQUESTS)}")
    print(f"  Delay: {delay}s between requests")
    print(f"  Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*70}\n")

    results = []

    async with httpx.AsyncClient() as client:
        for i, req in enumerate(REQUESTS):
            await send_request(client, url, req["skill_id"], req["text"], i, results)
            if delay > 0 and i < len(REQUESTS) - 1:
                await asyncio.sleep(delay)

    # Summary
    total = len(results)
    ok = sum(1 for r in results if r.get("response", {}).get("state") == "completed")
    failed = sum(1 for r in results if r.get("response", {}).get("state") == "failed")
    errors = sum(1 for r in results if "error" in r.get("response", {}))
    times = [r["response"]["elapsed_ms"] for r in results if "elapsed_ms" in r.get("response", {})]
    avg_ms = round(sum(times) / len(times)) if times else 0

    print(f"\n{'='*70}")
    print(f"  Results: {ok} completed, {failed} failed, {errors} errors / {total} total")
    print(f"  Avg response: {avg_ms}ms")
    if times:
        print(f"  Min/Max: {min(times)}ms / {max(times)}ms")

    by_skill = {}
    for r in results:
        sid = r["skill_id"]
        by_skill.setdefault(sid, {"ok": 0, "fail": 0, "times": []})
        if r.get("response", {}).get("state") == "completed":
            by_skill[sid]["ok"] += 1
        else:
            by_skill[sid]["fail"] += 1
        if "elapsed_ms" in r.get("response", {}):
            by_skill[sid]["times"].append(r["response"]["elapsed_ms"])

    print(f"\n  By Skill:")
    for sid, stats in sorted(by_skill.items()):
        avg = round(sum(stats["times"]) / len(stats["times"])) if stats["times"] else 0
        print(f"    {sid:<14s}  {stats['ok']} ok / {stats['fail']} fail  avg {avg}ms")
    print(f"{'='*70}\n")

    # Save log
    log_dir = Path(__file__).parent / "logs"
    log_dir.mkdir(exist_ok=True)
    log_file = log_dir / f"run-{datetime.now().strftime('%Y%m%d-%H%M%S')}.json"

    log_data = {
        "target": url,
        "started_at": results[0]["started_at"] if results else None,
        "total_requests": total,
        "completed": ok,
        "failed": failed,
        "errors": errors,
        "avg_ms": avg_ms,
        "results": results,
    }

    log_file.write_text(json.dumps(log_data, indent=2, ensure_ascii=False))
    print(f"  Log saved: {log_file}")


def main():
    parser = argparse.ArgumentParser(description="GT8004 Bot Agent")
    parser.add_argument("--url", default=FRIEND_AGENT_URL, help="Friend-Agent URL")
    parser.add_argument("--delay", type=float, default=1.0, help="Delay between requests (seconds)")
    args = parser.parse_args()

    asyncio.run(run(args.url, args.delay))


if __name__ == "__main__":
    main()
