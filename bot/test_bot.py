"""
GT8004 Stablecoin Agent -- Endpoint Test Bot
=============================================
Tests all A2A and MCP endpoints of the deployed stablecoin-agent.
Free endpoints get full responses; paid endpoints receive 402 responses
showing the x402 payment flow.

Usage:
    pip install -r bot/requirements.txt
    python bot/test_bot.py
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
A2A_BASE = "https://stablecoin-a2a-176882932608.us-central1.run.app"
MCP_BASE = "https://stablecoin-mcp-176882932608.us-central1.run.app"

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

            # Phase 1: A2A endpoints
            if a2a_proto == "a2a":
                print("\n=== Phase 1: A2A Endpoints ===\n")
                await self.test_a2a_health()
                await self.test_a2a_agent_card()
                await self.test_a2a_tasks_send()
                await self.test_a2a_task_poll()
                for skill in ("overview", "analyze", "compare", "risk"):
                    await self.test_a2a_direct_skill(skill)
            else:
                print(f"\n=== Phase 1: A2A Endpoints (SKIPPED — service reports '{a2a_proto}') ===\n")
                print(f"  [SKIP] A2A URL is running {a2a_proto} code, not A2A.")
                print(f"         A2A routes (/.well-known/agent.json, /a2a/*) are not available.")

            # Phase 2: MCP endpoints
            print("\n=== Phase 2: MCP Endpoints ===\n")
            base = MCP_BASE
            if mcp_proto != "mcp" and a2a_proto == "mcp":
                base = A2A_BASE
                print(f"  (Using A2A URL as MCP base: {base})")

            await self.test_mcp_health(base)
            session_url = await self.test_mcp_sse_connect(base)
            await self.test_mcp_tools_list(base)
            for tool_name, args in [
                ("about", {}),
                ("overview", {}),
                ("analyze", {"stablecoin": "DAI"}),
                ("compare", {"coins": "DAI, LUSD"}),
                ("risk", {"stablecoin": "FRAX"}),
            ]:
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

    async def test_a2a_tasks_send(self) -> None:
        num = self._next()
        url = f"{A2A_BASE}/a2a/tasks/send"
        body = _task_body("Give me a comprehensive overview of collateralized stablecoins")
        entry = await self._post(num, "a2a_tasks_send", url, body, expected=402,
                                 notes="x402 payment required; 402 with payment requirements is expected")
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

    async def test_a2a_direct_skill(self, skill_id: str) -> None:
        num = self._next()
        url = f"{A2A_BASE}/a2a/{skill_id}"
        prompts = {
            "overview": "Provide a comprehensive overview of collateralized stablecoins",
            "analyze": "Analyze DAI stablecoin in depth",
            "compare": "Compare DAI, LUSD, and GHO stablecoins",
            "risk": "Risk assessment of GHO stablecoin",
        }
        body = _task_body(prompts.get(skill_id, f"Test {skill_id}"))
        entry = await self._post(num, f"a2a_direct_{skill_id}", url, body, expected=402,
                                 notes=f"Direct skill /{skill_id} — x402 payment required")
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
        """Open a fresh SSE session, send tools/list, read response from SSE stream.

        Uses a single aiter_sse() call to avoid stream re-read errors.
        Uses a separate httpx client for the POST to prevent connection conflicts.
        """
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
                        # Phase 1: get session URL from endpoint event
                        if ev.event == "endpoint" and not session_url:
                            raw = ev.data
                            session_url = f"{base}{raw}" if raw.startswith("/") else raw
                            sse_events.append({"event": ev.event, "data": ev.data})

                            # POST tools/list using a separate client
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

                        # Phase 2: collect response events after POST
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

        # x402 middleware intercepts before SSE layer, so any POST to /mcp/* works
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
        log_path = LOG_DIR / f"test_run_{ts}.log"

        lines = [
            "GT8004 Stablecoin Agent -- Test Run",
            f"Date: {datetime.now(timezone.utc).isoformat()}",
            f"A2A:  {A2A_BASE}",
            f"MCP:  {MCP_BASE}",
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
