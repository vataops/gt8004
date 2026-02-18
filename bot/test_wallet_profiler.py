"""
GT8004 Wallet Profiler Agent -- Endpoint Test Bot
==================================================
Tests all A2A and MCP endpoints of the deployed wallet-profiler-agent.
Free endpoints get full responses; paid endpoints receive 402 responses
showing the x402 payment flow.

Usage:
    pip install -r bot/requirements.txt
    python bot/test_wallet_profiler.py
"""

import asyncio
import json
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, List, Dict, Any

import httpx
import httpx_sse

# ── Deployed service URLs ──
A2A_BASE = "https://wallet-profiler-a2a-xo7r66odiq-uc.a.run.app"
MCP_BASE = "https://wallet-profiler-mcp-xo7r66odiq-uc.a.run.app"

# Well-known public wallet addresses for testing
WALLETS = [
    "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",  # Vitalik
    "0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8",  # Binance 7
    "0x47ac0Fb4F2D84898e4D9E7b4DaB3C24507a6D503",  # Binance 8
    "0x1f9090aaE28b8a3dCeaDf281B0F12828e676c326",  # rsync Builder
    "0x388C818CA8B9251b393131C08a736A67ccB19297",  # Lido DAO
    "0xA7EFAe728D2936e78BDA97dc267687568dD593f3",  # OKX
    "0x0716a17FBAEe714f1E6aB0f9d59edbC5f09815C0",  # Jump Trading
    "0xDef1C0ded9bec7F1a1670819833240f027b25EfF",  # 0x Protocol
    "0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD",  # Uniswap Router
    "0x28C6c06298d514Db089934071355E5743bf21d60",  # Binance 14
]
TEST_WALLET = WALLETS[0]

LOG_DIR = Path(__file__).parent / "logs"


# ── Data model ──

@dataclass
class LogEntry:
    timestamp: str = ""
    test_name: str = ""
    test_number: int = 0
    # Request
    method: str = ""
    url: str = ""
    request_headers: Dict[str, str] = field(default_factory=dict)
    request_body: Optional[str] = None
    # Response
    status_code: int = 0
    response_headers: Dict[str, str] = field(default_factory=dict)
    response_body: str = ""
    # Metadata
    expected_status: int = 200
    passed: bool = False
    duration_ms: float = 0.0
    notes: str = ""
    error: Optional[str] = None


# ── Formatting ──

def _pretty_json(text: str) -> str:
    try:
        return json.dumps(json.loads(text), indent=2, ensure_ascii=False)
    except (json.JSONDecodeError, TypeError):
        return text


def format_log_entry(entry: LogEntry) -> str:
    sep = "=" * 80
    icon = "PASS" if entry.passed else "FAIL"
    lines = [
        sep,
        f"TEST #{entry.test_number}: {entry.test_name}  [{icon}]",
        f"Timestamp: {entry.timestamp}",
        f"Duration:  {entry.duration_ms:.1f}ms",
        sep,
        "",
        ">>> REQUEST",
        f"  {entry.method} {entry.url}",
        "  Headers:",
    ]
    for k, v in entry.request_headers.items():
        lines.append(f"    {k}: {v}")
    if entry.request_body:
        lines.append("  Body:")
        for line in _pretty_json(entry.request_body).splitlines():
            lines.append(f"    {line}")
    lines.append("")
    lines.append(
        f"<<< RESPONSE  (status: {entry.status_code}, expected: {entry.expected_status})"
    )
    lines.append("  Headers:")
    for k, v in entry.response_headers.items():
        lines.append(f"    {k}: {v}")
    lines.append("  Body:")
    for line in _pretty_json(entry.response_body).splitlines():
        lines.append(f"    {line}")
    if entry.notes:
        lines.append("")
        lines.append(f"  Notes: {entry.notes}")
    if entry.error:
        lines.append(f"  Error: {entry.error}")
    lines.append("")
    return "\n".join(lines)


# ── Helpers ──

def _task_body(text: str, skill_id: Optional[str] = None) -> dict:
    """Build a TaskRequest-compatible body."""
    body: Dict[str, Any] = {
        "id": f"test-{uuid.uuid4().hex[:12]}",
        "message": {
            "role": "user",
            "parts": [{"type": "text", "text": text}],
        },
    }
    if skill_id:
        body["skill_id"] = skill_id
    return body


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── TestBot ──

class TestBot:
    def __init__(self) -> None:
        self.results: List[LogEntry] = []
        self._counter = 0
        self.client: Optional[httpx.AsyncClient] = None

    def _next(self) -> int:
        self._counter += 1
        return self._counter

    # ── Runner ──

    async def run(self) -> None:
        LOG_DIR.mkdir(parents=True, exist_ok=True)
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            self.client = client

            # Phase 0: detect protocols
            a2a_proto = await self._detect_protocol(A2A_BASE)
            mcp_proto = await self._detect_protocol(MCP_BASE)

            print(f"\n  A2A service ({A2A_BASE}): protocol={a2a_proto}")
            print(f"  MCP service ({MCP_BASE}): protocol={mcp_proto}")

            # Phase 1: A2A endpoints (~35 requests)
            if a2a_proto == "a2a":
                print("\n=== Phase 1: A2A Endpoints ===\n")
                await self.test_a2a_health()
                await self.test_a2a_agent_card()

                # tasks/send — varied prompts with different wallets (8)
                for i, prompt in enumerate([
                    f"Profile the wallet {WALLETS[0]}",
                    f"What kind of wallet is {WALLETS[1]}?",
                    f"Analyze portfolio composition of {WALLETS[2]}",
                    f"Is {WALLETS[3]} a MEV bot?",
                    f"Risk assessment for {WALLETS[4]}",
                    f"What DeFi protocols does {WALLETS[5]} use?",
                    f"Compare activity patterns of {WALLETS[6]} and {WALLETS[7]}",
                    f"Show me the transaction history analysis for {WALLETS[8]}",
                ]):
                    await self.test_a2a_tasks_send(prompt)

                # task poll — 3 fake IDs
                for _ in range(3):
                    await self.test_a2a_task_poll()

                # direct skills — multiple wallets per skill (20)
                skill_prompts = {
                    "profile": [
                        f"Profile {WALLETS[0]} — is this a whale or smart money?",
                        f"Classify the behavior of {WALLETS[1]}",
                        f"What type of wallet is {WALLETS[3]}? Builder, trader, or bot?",
                        f"Generate a behavioral fingerprint for {WALLETS[6]}",
                        f"Is {WALLETS[9]} an exchange or individual wallet?",
                    ],
                    "portfolio": [
                        f"Portfolio composition of {WALLETS[0]}",
                        f"What tokens does {WALLETS[2]} hold?",
                        f"DeFi positions and yield farming for {WALLETS[4]}",
                        f"Cross-chain asset distribution for {WALLETS[5]}",
                        f"Diversification score for {WALLETS[8]}",
                    ],
                    "risk": [
                        f"Risk assessment for {WALLETS[0]}",
                        f"Check approval hygiene for {WALLETS[1]}",
                        f"Counterparty exposure of {WALLETS[3]}",
                        f"Rugpull exposure check for {WALLETS[7]}",
                        f"Compliance flags for {WALLETS[9]}",
                    ],
                    "activity": [
                        f"On-chain activity analysis for {WALLETS[0]}",
                        f"Transaction frequency of {WALLETS[2]} over the past month",
                        f"Bridge usage patterns for {WALLETS[5]}",
                        f"Governance participation of {WALLETS[4]}",
                        f"DeFi interaction timeline for {WALLETS[6]}",
                    ],
                }
                for skill_id, prompts in skill_prompts.items():
                    for prompt in prompts:
                        await self.test_a2a_direct_skill(skill_id, prompt)
            else:
                print(f"\n=== Phase 1: A2A Endpoints (SKIPPED — service reports '{a2a_proto}') ===\n")
                print(f"  [SKIP] A2A URL is running {a2a_proto} code, not A2A.")

            # Phase 2: MCP endpoints (~45 requests)
            print("\n=== Phase 2: MCP Endpoints ===\n")
            base = MCP_BASE
            if mcp_proto != "mcp" and a2a_proto == "mcp":
                base = A2A_BASE
                print(f"  (Using A2A URL as MCP base: {base})")

            await self.test_mcp_health(base)
            session_url = await self.test_mcp_sse_connect(base)
            await self.test_mcp_tools_list(base)

            mcp_calls = [
                # about (2)
                ("about", {}),
                ("about", {}),
                # profile — varied wallets (10)
                ("profile", {"address": WALLETS[0]}),
                ("profile", {"address": WALLETS[1]}),
                ("profile", {"address": WALLETS[2]}),
                ("profile", {"address": WALLETS[3]}),
                ("profile", {"address": WALLETS[4]}),
                ("profile", {"address": WALLETS[5]}),
                ("profile", {"address": WALLETS[6]}),
                ("profile", {"address": WALLETS[7]}),
                ("profile", {"address": WALLETS[8]}),
                ("profile", {"address": WALLETS[9]}),
                # portfolio — varied wallets (10)
                ("portfolio", {"address": WALLETS[0]}),
                ("portfolio", {"address": WALLETS[1]}),
                ("portfolio", {"address": WALLETS[2]}),
                ("portfolio", {"address": WALLETS[3]}),
                ("portfolio", {"address": WALLETS[4]}),
                ("portfolio", {"address": WALLETS[5]}),
                ("portfolio", {"address": WALLETS[6]}),
                ("portfolio", {"address": WALLETS[7]}),
                ("portfolio", {"address": WALLETS[8]}),
                ("portfolio", {"address": WALLETS[9]}),
                # risk — varied wallets (10)
                ("risk", {"address": WALLETS[0]}),
                ("risk", {"address": WALLETS[1]}),
                ("risk", {"address": WALLETS[2]}),
                ("risk", {"address": WALLETS[3]}),
                ("risk", {"address": WALLETS[4]}),
                ("risk", {"address": WALLETS[5]}),
                ("risk", {"address": WALLETS[6]}),
                ("risk", {"address": WALLETS[7]}),
                ("risk", {"address": WALLETS[8]}),
                ("risk", {"address": WALLETS[9]}),
                # activity — varied wallets (10)
                ("activity", {"address": WALLETS[0]}),
                ("activity", {"address": WALLETS[1]}),
                ("activity", {"address": WALLETS[2]}),
                ("activity", {"address": WALLETS[3]}),
                ("activity", {"address": WALLETS[4]}),
                ("activity", {"address": WALLETS[5]}),
                ("activity", {"address": WALLETS[6]}),
                ("activity", {"address": WALLETS[7]}),
                ("activity", {"address": WALLETS[8]}),
                ("activity", {"address": WALLETS[9]}),
            ]
            for tool_name, args in mcp_calls:
                await self.test_mcp_tools_call(tool_name, args, session_url, base)

        log_path = self._write_log()
        self._print_summary(log_path)

    async def _detect_protocol(self, base_url: str) -> str:
        """Hit /health and return the reported protocol."""
        try:
            resp = await self.client.get(f"{base_url}/health")
            data = resp.json()
            return data.get("protocol", "unknown")
        except Exception:
            return "unknown"

    # ── A2A tests ──

    async def test_a2a_health(self) -> None:
        num = self._next()
        url = f"{A2A_BASE}/health"
        entry = await self._get(num, "a2a_health", url, expected=200,
                                notes="A2A health check")
        self.results.append(entry)
        self._print(entry)

    async def test_a2a_agent_card(self) -> None:
        num = self._next()
        url = f"{A2A_BASE}/.well-known/agent.json"
        entry = await self._get(num, "a2a_agent_card", url, expected=200,
                                notes="Agent Card discovery — skills, auth, metadata")
        self.results.append(entry)
        self._print(entry)

    async def test_a2a_tasks_send(self, prompt: str = f"Profile the wallet {TEST_WALLET}") -> None:
        num = self._next()
        url = f"{A2A_BASE}/a2a/tasks/send"
        body = _task_body(prompt)
        short = prompt[:50]
        entry = await self._post(num, "a2a_tasks_send", url, body, expected=402,
                                 notes=f"x402 payment required — \"{short}...\"")
        self.results.append(entry)
        self._print(entry)

    async def test_a2a_task_poll(self) -> None:
        num = self._next()
        fake_id = f"test-{uuid.uuid4().hex[:12]}"
        url = f"{A2A_BASE}/a2a/tasks/{fake_id}"
        entry = await self._get(num, "a2a_task_poll", url, expected=200,
                                notes="Non-existent task — expect not_found state")
        self.results.append(entry)
        self._print(entry)

    async def test_a2a_direct_skill(self, skill_id: str, prompt: Optional[str] = None) -> None:
        num = self._next()
        url = f"{A2A_BASE}/a2a/{skill_id}"
        if prompt is None:
            prompt = f"Test {skill_id}"
        body = _task_body(prompt)
        short = prompt[:50]
        entry = await self._post(num, f"a2a_direct_{skill_id}", url, body, expected=402,
                                 notes=f"Direct /{skill_id} — \"{short}...\"")
        self.results.append(entry)
        self._print(entry)

    # ── MCP tests ──

    async def test_mcp_health(self, base: str = MCP_BASE) -> None:
        num = self._next()
        url = f"{base}/health"
        entry = await self._get(num, "mcp_health", url, expected=200,
                                notes="MCP service health check")
        self.results.append(entry)
        self._print(entry)

    async def test_mcp_sse_connect(self, base: str = MCP_BASE) -> Optional[str]:
        """Connect to SSE stream and retrieve session URL."""
        num = self._next()
        url = f"{base}/mcp/sse"
        session_url = None
        sse_events: List[dict] = []

        start = time.monotonic()
        try:
            async with httpx_sse.aconnect_sse(self.client, "GET", url) as source:
                async def _read():
                    nonlocal session_url
                    async for ev in source.aiter_sse():
                        sse_events.append({"event": ev.event, "data": ev.data})
                        if ev.event == "endpoint":
                            raw = ev.data
                            session_url = f"{base}{raw}" if raw.startswith("/") else raw
                            return

                await asyncio.wait_for(_read(), timeout=15)

            elapsed = (time.monotonic() - start) * 1000
            entry = LogEntry(
                timestamp=_now(), test_name="mcp_sse_connect", test_number=num,
                method="GET (SSE)", url=url,
                request_headers={"accept": "text/event-stream"},
                status_code=200,
                response_body=json.dumps(sse_events, indent=2, ensure_ascii=False),
                expected_status=200,
                passed=session_url is not None,
                duration_ms=round(elapsed, 1),
                notes=f"SSE endpoint event received. Session URL: {session_url}",
            )
        except Exception as e:
            elapsed = (time.monotonic() - start) * 1000
            entry = LogEntry(
                timestamp=_now(), test_name="mcp_sse_connect", test_number=num,
                method="GET (SSE)", url=url,
                error=str(e), duration_ms=round(elapsed, 1),
            )

        self.results.append(entry)
        self._print(entry)
        return session_url

    async def test_mcp_tools_list(self, base: str = MCP_BASE) -> None:
        """Open a fresh SSE session, send tools/list, read response from SSE stream."""
        num = self._next()
        sse_url = f"{base}/mcp/sse"
        body = {"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}
        sse_events: List[dict] = []
        tools_response = None
        post_status = 0
        post_headers: Dict[str, str] = {}
        post_body_text = ""
        req_headers: Dict[str, str] = {}
        session_url = ""

        start = time.monotonic()
        try:
            async with httpx_sse.aconnect_sse(self.client, "GET", sse_url) as source:
                post_sent = False

                async def _run():
                    nonlocal session_url, tools_response, post_sent
                    nonlocal post_status, post_headers, post_body_text, req_headers

                    async for ev in source.aiter_sse():
                        if ev.event == "endpoint" and not session_url:
                            raw = ev.data
                            session_url = f"{base}{raw}" if raw.startswith("/") else raw
                            sse_events.append({"event": ev.event, "data": ev.data})

                            async with httpx.AsyncClient(timeout=15) as post_client:
                                resp = await post_client.post(
                                    session_url, json=body,
                                    headers={"content-type": "application/json"},
                                )
                                post_status = resp.status_code
                                post_headers = dict(resp.headers)
                                post_body_text = resp.text
                                req_headers = dict(resp.request.headers)
                            post_sent = True
                            continue

                        if post_sent:
                            sse_events.append({"event": ev.event, "data": ev.data})
                            try:
                                data = json.loads(ev.data)
                                if "result" in data or "error" in data:
                                    tools_response = data
                                    return
                            except (json.JSONDecodeError, TypeError):
                                pass

                await asyncio.wait_for(_run(), timeout=20)

            elapsed = (time.monotonic() - start) * 1000

            combined = json.dumps({
                "post_status": post_status,
                "post_body": post_body_text,
                "sse_events": sse_events,
                "tools_response": tools_response,
            }, indent=2, ensure_ascii=False)

            entry = LogEntry(
                timestamp=_now(), test_name="mcp_tools_list", test_number=num,
                method="POST + SSE", url=session_url,
                request_headers=req_headers,
                request_body=json.dumps(body, indent=2),
                status_code=post_status,
                response_headers=post_headers,
                response_body=combined,
                expected_status=200,
                passed=tools_response is not None,
                duration_ms=round(elapsed, 1),
                notes="tools/list is free; response delivered via SSE stream",
            )
        except Exception as e:
            elapsed = (time.monotonic() - start) * 1000
            entry = LogEntry(
                timestamp=_now(), test_name="mcp_tools_list", test_number=num,
                method="POST + SSE", url=session_url or sse_url,
                request_body=json.dumps(body, indent=2),
                error=str(e), duration_ms=round(elapsed, 1),
            )

        self.results.append(entry)
        self._print(entry)

    async def test_mcp_tools_call(
        self, tool_name: str, args: dict,
        session_url: Optional[str], base: str = MCP_BASE,
    ) -> None:
        """POST tools/call — x402 middleware returns 402 directly as HTTP response."""
        num = self._next()
        body = {
            "jsonrpc": "2.0",
            "id": 2,
            "method": "tools/call",
            "params": {"name": tool_name, "arguments": args},
        }

        target = session_url or f"{base}/mcp/sse"

        entry = await self._post(
            num, f"mcp_tools_call_{tool_name}", target, body, expected=402,
            notes=f"tools/call({tool_name}) — x402 middleware returns 402 before SSE layer",
        )
        self.results.append(entry)
        self._print(entry)

    # ── HTTP helpers ──

    async def _get(
        self, num: int, name: str, url: str, expected: int = 200, notes: str = ""
    ) -> LogEntry:
        start = time.monotonic()
        try:
            resp = await self.client.get(url)
            elapsed = (time.monotonic() - start) * 1000
            return LogEntry(
                timestamp=_now(), test_name=name, test_number=num,
                method="GET", url=url,
                request_headers=dict(resp.request.headers),
                status_code=resp.status_code,
                response_headers=dict(resp.headers),
                response_body=resp.text,
                expected_status=expected,
                passed=(resp.status_code == expected),
                duration_ms=round(elapsed, 1),
                notes=notes,
            )
        except Exception as e:
            elapsed = (time.monotonic() - start) * 1000
            return LogEntry(
                timestamp=_now(), test_name=name, test_number=num,
                method="GET", url=url,
                error=str(e), duration_ms=round(elapsed, 1),
            )

    async def _post(
        self, num: int, name: str, url: str, body: dict,
        expected: int = 200, notes: str = ""
    ) -> LogEntry:
        start = time.monotonic()
        try:
            resp = await self.client.post(url, json=body)
            elapsed = (time.monotonic() - start) * 1000
            return LogEntry(
                timestamp=_now(), test_name=name, test_number=num,
                method="POST", url=url,
                request_headers=dict(resp.request.headers),
                request_body=json.dumps(body, indent=2, ensure_ascii=False),
                status_code=resp.status_code,
                response_headers=dict(resp.headers),
                response_body=resp.text,
                expected_status=expected,
                passed=(resp.status_code == expected),
                duration_ms=round(elapsed, 1),
                notes=notes,
            )
        except Exception as e:
            elapsed = (time.monotonic() - start) * 1000
            return LogEntry(
                timestamp=_now(), test_name=name, test_number=num,
                method="POST", url=url,
                request_body=json.dumps(body, indent=2, ensure_ascii=False),
                error=str(e), duration_ms=round(elapsed, 1),
            )

    # ── Output ──

    def _print(self, entry: LogEntry) -> None:
        icon = "PASS" if entry.passed else "FAIL"
        status = entry.error or str(entry.status_code)
        print(f"  [{icon}] #{entry.test_number:>2} {entry.test_name:<30} "
              f"{status} ({entry.duration_ms:.0f}ms)")

    def _write_log(self) -> Path:
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        log_path = LOG_DIR / f"wallet_profiler_{ts}.log"

        lines = [
            "GT8004 Wallet Profiler Agent -- Test Run",
            f"Date: {datetime.now(timezone.utc).isoformat()}",
            f"A2A:  {A2A_BASE}",
            f"MCP:  {MCP_BASE}",
            f"Test Wallet: {TEST_WALLET}",
            "",
            f"Total tests: {len(self.results)}",
            f"Passed:      {sum(1 for r in self.results if r.passed)}",
            f"Failed:      {sum(1 for r in self.results if not r.passed)}",
            "",
        ]
        for entry in self.results:
            lines.append(format_log_entry(entry))

        log_path.write_text("\n".join(lines), encoding="utf-8")
        return log_path

    def _print_summary(self, log_path: Path) -> None:
        passed = sum(1 for r in self.results if r.passed)
        total = len(self.results)
        print(f"\n{'=' * 60}")
        print(f"Results: {passed}/{total} passed")
        print(f"Log file: {log_path}")
        print(f"{'=' * 60}")


if __name__ == "__main__":
    bot = TestBot()
    asyncio.run(bot.run())
