"""
A2A Test Bot
=============
Sends A2A tasks/send requests to Companion-Agent and Friend-Agent.
Supports both Direct mode (Cloud Run URL) and Gateway mode (GT8004 proxy).

Usage:
    pip install httpx python-dotenv
    python bot.py --direct                         # Direct mode, all agents, all skills
    python bot.py --gateway                        # Gateway mode
    python bot.py --gateway --agent companion      # Gateway, companion only
    python bot.py --direct --skill chat            # Direct, chat skill only
    python bot.py --direct --message "Hey there"   # Custom message
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import uuid
from pathlib import Path

import httpx
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")

# ── Colors ──────────────────────────────────────────────────

BOLD = "\033[1m"
GREEN = "\033[32m"
YELLOW = "\033[33m"
CYAN = "\033[36m"
RED = "\033[31m"
DIM = "\033[2m"
RESET = "\033[0m"

# ── Test Messages ───────────────────────────────────────────

TEST_MESSAGES = {
    "chat": "Hello, introduce yourself briefly.",
    "summarize": (
        "Summarize the following: "
        "The ERC-8004 standard defines a decentralized identity registry for AI agents. "
        "It allows agents to register on-chain with a unique token ID, enabling verifiable "
        "identity, reputation tracking, and interoperability across platforms. The standard "
        "supports metadata storage via agent URIs and integrates with existing EVM wallets "
        "for ownership verification through challenge-response authentication."
    ),
    "translate": "Translate to Korean: The agent economy is growing rapidly as more AI services adopt open protocols.",
    "code-assist": "Write a Python function to check if a number is prime. Include docstring and type hints.",
}

SKILLS = list(TEST_MESSAGES.keys())

# ── Agent Config ────────────────────────────────────────────

AGENTS = {
    "companion": {
        "name": "Companion-Agent",
        "direct_env": "COMPANION_URL",
        "agent_id_env": "COMPANION_AGENT_ID",
    },
    "friend": {
        "name": "Friend-Agent",
        "direct_env": "FRIEND_URL",
        "agent_id_env": "FRIEND_AGENT_ID",
    },
}


def build_url(agent_key: str, mode: str) -> str | None:
    """Build the A2A tasks/send URL for the given agent and mode."""
    agent = AGENTS[agent_key]

    if mode == "direct":
        base = os.environ.get(agent["direct_env"], "").rstrip("/")
        if not base:
            print(f"{RED}Error: {agent['direct_env']} not set in .env{RESET}")
            return None
        return f"{base}/a2a/tasks/send"

    # gateway mode
    gateway = os.environ.get("GATEWAY_URL", "").rstrip("/")
    agent_id = os.environ.get(agent["agent_id_env"], "")
    if not gateway:
        print(f"{RED}Error: GATEWAY_URL not set in .env{RESET}")
        return None
    if not agent_id:
        print(f"{RED}Error: {agent['agent_id_env']} not set in .env{RESET}")
        return None
    return f"{gateway}/gateway/{agent_id}/a2a/tasks/send"


def send_task(client: httpx.Client, url: str, skill_id: str, message: str) -> dict:
    """Send an A2A tasks/send request and return the response."""
    body = {
        "id": f"test-{uuid.uuid4().hex[:8]}",
        "skill_id": skill_id,
        "message": {
            "role": "user",
            "parts": [{"type": "text", "text": message}],
        },
    }
    resp = client.post(url, json=body, timeout=60)
    resp.raise_for_status()
    return resp.json()


def print_result(agent_name: str, skill: str, result: dict, elapsed: float):
    """Pretty-print a test result."""
    status = result.get("status", {}).get("state", "unknown")
    color = GREEN if status == "completed" else RED

    print(f"\n{BOLD}{CYAN}[{agent_name}]{RESET} {YELLOW}{skill}{RESET}  "
          f"{color}{status}{RESET}  {DIM}{elapsed:.1f}s{RESET}")

    artifacts = result.get("artifacts", [])
    for artifact in artifacts:
        for part in artifact.get("parts", []):
            text = part.get("text", "")
            # Truncate long responses
            if len(text) > 500:
                text = text[:500] + f"\n{DIM}... (truncated){RESET}"
            print(f"  {text}")


def run_tests(mode: str, agent_filter: str | None, skill_filter: str | None, custom_message: str | None):
    """Run A2A tests against configured agents."""
    agents_to_test = [agent_filter] if agent_filter else list(AGENTS.keys())
    skills_to_test = [skill_filter] if skill_filter else SKILLS

    print(f"\n{BOLD}{'='*60}{RESET}")
    print(f"{BOLD}  A2A Test Bot — {mode.upper()} mode{RESET}")
    print(f"{BOLD}{'='*60}{RESET}")
    print(f"  Agents: {', '.join(agents_to_test)}")
    print(f"  Skills: {', '.join(skills_to_test)}")

    total = 0
    passed = 0
    failed = 0

    with httpx.Client() as client:
        for agent_key in agents_to_test:
            agent = AGENTS[agent_key]
            url = build_url(agent_key, mode)
            if not url:
                failed += len(skills_to_test)
                total += len(skills_to_test)
                continue

            print(f"\n{DIM}  → {url}{RESET}")

            for skill in skills_to_test:
                total += 1
                message = custom_message or TEST_MESSAGES[skill]

                try:
                    start = time.time()
                    result = send_task(client, url, skill, message)
                    elapsed = time.time() - start
                    print_result(agent["name"], skill, result, elapsed)

                    if result.get("status", {}).get("state") == "completed":
                        passed += 1
                    else:
                        failed += 1

                except httpx.ConnectError:
                    elapsed = time.time() - start
                    print(f"\n{BOLD}{CYAN}[{agent['name']}]{RESET} {YELLOW}{skill}{RESET}  "
                          f"{RED}CONNECTION REFUSED{RESET}  {DIM}{elapsed:.1f}s{RESET}")
                    print(f"  {DIM}Is the agent running at {url}?{RESET}")
                    failed += 1

                except httpx.HTTPStatusError as e:
                    elapsed = time.time() - start
                    print(f"\n{BOLD}{CYAN}[{agent['name']}]{RESET} {YELLOW}{skill}{RESET}  "
                          f"{RED}HTTP {e.response.status_code}{RESET}  {DIM}{elapsed:.1f}s{RESET}")
                    print(f"  {e.response.text[:200]}")
                    failed += 1

                except Exception as e:
                    print(f"\n{BOLD}{CYAN}[{agent['name']}]{RESET} {YELLOW}{skill}{RESET}  "
                          f"{RED}ERROR{RESET}")
                    print(f"  {e}")
                    failed += 1

    # Summary
    print(f"\n{BOLD}{'='*60}{RESET}")
    summary_color = GREEN if failed == 0 else RED
    print(f"  {summary_color}{passed}/{total} passed{RESET}  "
          f"{f'{RED}{failed} failed{RESET}' if failed else ''}")
    print(f"{BOLD}{'='*60}{RESET}\n")

    return 0 if failed == 0 else 1


def main():
    parser = argparse.ArgumentParser(description="A2A Test Bot")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--direct", action="store_true", help="Direct mode (Cloud Run URLs)")
    group.add_argument("--gateway", action="store_true", help="Gateway mode (GT8004 proxy)")
    parser.add_argument("--agent", choices=list(AGENTS.keys()), help="Test specific agent only")
    parser.add_argument("--skill", choices=SKILLS, help="Test specific skill only")
    parser.add_argument("--message", type=str, help="Custom message (overrides default test messages)")
    args = parser.parse_args()

    mode = "direct" if args.direct else "gateway"
    sys.exit(run_tests(mode, args.agent, args.skill, args.message))


if __name__ == "__main__":
    main()
