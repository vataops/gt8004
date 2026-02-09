"""
Multi-Agent Test Client
========================
여러 agent의 게이트웨이 엔드포인트로 주제별 요청을 보내는 클라이언트.
API key 불필요 - 공개 게이트웨이로 직접 요청.

Usage:
    # 단일 agent
    python client.py --agents defi-agent-id

    # 여러 agent
    python client.py --agents defi-agent-id market-agent-id nft-agent-id

    # 옵션
    python client.py --agents id1 id2 --count 200 --interval 0.2
"""

import argparse
import json
import random
import socket
import sys
import time
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

# ── Agent별 요청 시나리오 ──────────────────────────────────────

SCENARIOS = {
    "defi": {
        "endpoints": [
            {
                "path": "/api/pool-analysis",
                "payloads": [
                    {"pool": "ETH/USDC", "chain": "ethereum", "dex": "uniswap-v3"},
                    {"pool": "WBTC/ETH", "chain": "ethereum", "dex": "uniswap-v3"},
                    {"pool": "ARB/ETH", "chain": "arbitrum", "dex": "camelot"},
                    {"pool": "USDC/USDT", "chain": "base", "dex": "aerodrome"},
                    {"pool": "ETH/DAI", "chain": "optimism", "dex": "velodrome"},
                ],
                "weight": 30,
            },
            {
                "path": "/api/yield-compare",
                "payloads": [
                    {"asset": "USDC", "chains": ["ethereum", "base", "arbitrum"]},
                    {"asset": "ETH", "chains": ["ethereum", "base"]},
                    {"asset": "WBTC", "chains": ["ethereum"]},
                    {"asset": "DAI", "chains": ["ethereum", "optimism"]},
                ],
                "weight": 25,
            },
            {
                "path": "/api/risk-score",
                "payloads": [
                    {"protocol": "Uniswap V3", "chain": "ethereum"},
                    {"protocol": "Aave V3", "chain": "ethereum"},
                    {"protocol": "Compound V3", "chain": "ethereum"},
                    {"protocol": "GMX", "chain": "arbitrum"},
                    {"protocol": "Aerodrome", "chain": "base"},
                    {"protocol": "Morpho Blue", "chain": "ethereum"},
                ],
                "weight": 25,
            },
            {
                "path": "/api/impermanent-loss",
                "payloads": [
                    {"pair": "ETH/USDC", "entry_price": 3000, "current_price": 3400},
                    {"pair": "SOL/USDC", "entry_price": 120, "current_price": 187},
                    {"pair": "ARB/ETH", "entry_price": 0.0004, "current_price": 0.00036},
                    {"pair": "MATIC/ETH", "entry_price": 0.00025, "current_price": 0.00018},
                ],
                "weight": 20,
            },
        ],
    },
    "market": {
        "endpoints": [
            {
                "path": "/api/market-overview",
                "payloads": [
                    {"timeframe": "1h"},
                    {"timeframe": "4h"},
                    {"timeframe": "1d"},
                    {"timeframe": "1w"},
                ],
                "weight": 20,
            },
            {
                "path": "/api/token-analysis",
                "payloads": [
                    {"token": "BTC", "timeframe": "4h"},
                    {"token": "ETH", "timeframe": "4h"},
                    {"token": "SOL", "timeframe": "1d"},
                    {"token": "ARB", "timeframe": "1d"},
                    {"token": "OP", "timeframe": "1d"},
                    {"token": "AVAX", "timeframe": "4h"},
                    {"token": "LINK", "timeframe": "1d"},
                    {"token": "UNI", "timeframe": "1w"},
                ],
                "weight": 35,
            },
            {
                "path": "/api/whale-alerts",
                "payloads": [
                    {"min_usd": 1_000_000, "tokens": ["BTC", "ETH"]},
                    {"min_usd": 500_000, "tokens": ["SOL", "ARB", "OP"]},
                    {"min_usd": 10_000_000, "tokens": ["BTC"]},
                ],
                "weight": 25,
            },
            {
                "path": "/api/correlation",
                "payloads": [
                    {"tokens": ["BTC", "ETH", "SOL"], "period": "30d"},
                    {"tokens": ["BTC", "GOLD", "SPY"], "period": "90d"},
                    {"tokens": ["ETH", "SOL", "AVAX", "MATIC"], "period": "7d"},
                ],
                "weight": 20,
            },
        ],
    },
    "nft": {
        "endpoints": [
            {
                "path": "/api/collection-stats",
                "payloads": [
                    {"collection": "cryptopunks", "chain": "ethereum"},
                    {"collection": "boredapeyachtclub", "chain": "ethereum"},
                    {"collection": "azuki", "chain": "ethereum"},
                    {"collection": "pudgypenguins", "chain": "ethereum"},
                    {"collection": "milady", "chain": "ethereum"},
                ],
                "weight": 25,
            },
            {
                "path": "/api/wallet-profile",
                "payloads": [
                    {"address": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"},
                    {"address": "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B"},
                    {"address": "0x1234567890abcdef1234567890abcdef12345678"},
                    {"address": "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef"},
                ],
                "weight": 25,
            },
            {
                "path": "/api/gas-estimate",
                "payloads": [
                    {"operations": ["transfer", "swap"]},
                    {"operations": ["nft_mint"]},
                    {"operations": ["contract_deploy"]},
                    {"operations": ["swap", "nft_mint", "transfer"]},
                ],
                "weight": 30,
            },
            {
                "path": "/api/contract-scan",
                "payloads": [
                    {"address": "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984", "chain": "ethereum"},
                    {"address": "0x6B175474E89094C44Da98b954EedeAC495271d0F", "chain": "ethereum"},
                    {"address": "0xdeadbeefcafebabedeadbeefcafebabe12345678", "chain": "base"},
                ],
                "weight": 20,
            },
        ],
    },
    "p2e": {
        "endpoints": [
            {
                "path": "/api/game-stats",
                "payloads": [
                    {"game": "Axie Infinity", "chain": "ronin"},
                    {"game": "The Sandbox", "chain": "ethereum"},
                    {"game": "Illuvium", "chain": "ethereum"},
                    {"game": "Star Atlas", "chain": "solana"},
                    {"game": "Gods Unchained", "chain": "immutablex"},
                ],
                "weight": 25,
            },
            {
                "path": "/api/token-economy",
                "payloads": [
                    {"game": "Axie Infinity", "token": "SLP"},
                    {"game": "StepN", "token": "GMT"},
                    {"game": "Gods Unchained", "token": "GODS"},
                    {"game": "Illuvium", "token": "ILV"},
                    {"game": "Star Atlas", "token": "ATLAS"},
                ],
                "weight": 30,
            },
            {
                "path": "/api/guild-rankings",
                "payloads": [
                    {"game": "all", "sort_by": "tvl"},
                    {"game": "all", "sort_by": "members"},
                    {"game": "Axie Infinity", "sort_by": "earnings"},
                    {"game": "The Sandbox", "sort_by": "tvl"},
                ],
                "weight": 20,
            },
            {
                "path": "/api/reward-estimate",
                "payloads": [
                    {"game": "Axie Infinity", "strategy": "competitive", "investment_usd": 500},
                    {"game": "The Sandbox", "strategy": "land-rental", "investment_usd": 2000},
                    {"game": "Illuvium", "strategy": "farming", "investment_usd": 1000},
                    {"game": "Star Atlas", "strategy": "mining", "investment_usd": 300},
                    {"game": "StepN", "strategy": "walking", "investment_usd": 800},
                ],
                "weight": 25,
            },
        ],
    },
}

# 가상 고객 에이전트들 (다른 AI agent들이 호출하는 시나리오)
CUSTOMERS = [
    "portfolio-manager-01",
    "trading-bot-alpha",
    "risk-monitor-v2",
    "yield-optimizer",
    "defi-dashboard",
    "whale-tracker",
    "nft-sniper-bot",
    "market-maker-east",
    "quant-strategy-3",
    "analytics-pipeline",
    "rebalancer-daily",
    "alert-service",
]


def pick_scenario(agent_config: dict) -> tuple[str, dict]:
    """Pick a random endpoint + payload based on weights."""
    endpoints = agent_config["endpoints"]
    weights = [e["weight"] for e in endpoints]
    chosen = random.choices(endpoints, weights=weights, k=1)[0]
    payload = random.choice(chosen["payloads"])
    return chosen["path"], dict(payload)


def send_request(base_url: str, agent_id: str, path: str, payload: dict, customer: str) -> dict:
    url = f"{base_url}/gateway/{agent_id}{path}"
    headers = {
        "Content-Type": "application/json",
        "X-Agent-ID": customer,
    }
    data = json.dumps(payload).encode()

    start = time.time()
    try:
        req = Request(url, data=data, headers=headers, method="POST")
        with urlopen(req, timeout=30) as resp:
            resp.read()
            elapsed = (time.time() - start) * 1000
            return {"status": resp.status, "ms": round(elapsed, 1), "path": path, "ok": True}
    except HTTPError as e:
        elapsed = (time.time() - start) * 1000
        return {"status": e.code, "ms": round(elapsed, 1), "path": path, "ok": False, "error": str(e.reason)}
    except (URLError, TimeoutError, socket.timeout, OSError) as e:
        elapsed = (time.time() - start) * 1000
        return {"status": 0, "ms": round(elapsed, 1), "path": path, "ok": False, "error": str(e)}


def detect_persona(agent_id: str) -> str:
    """Guess persona from agent_id string. Falls back to random."""
    aid = agent_id.lower()
    if any(k in aid for k in ["defi", "yield", "pool", "liquidity"]):
        return "defi"
    if any(k in aid for k in ["market", "trade", "price", "whale"]):
        return "market"
    if any(k in aid for k in ["nft", "chain", "gas", "wallet", "contract"]):
        return "nft"
    if any(k in aid for k in ["p2e", "game", "guild", "play", "reward"]):
        return "p2e"
    return random.choice(list(SCENARIOS.keys()))


def main():
    parser = argparse.ArgumentParser(description="GT8004 Multi-Agent Test Client")
    parser.add_argument("--agents", nargs="+", required=True,
                        help="Agent IDs (space-separated)")
    parser.add_argument("--personas", nargs="*", default=None,
                        help="Persona per agent: defi market nft p2e (auto-detected if omitted)")
    parser.add_argument("--base-url", default="http://localhost:8080")
    parser.add_argument("--count", type=int, default=100,
                        help="Total requests across all agents (default: 100)")
    parser.add_argument("--interval", type=float, default=0.3,
                        help="Seconds between requests (default: 0.3)")
    parser.add_argument("--customers", type=int, default=8,
                        help="Number of unique callers (default: 8)")
    args = parser.parse_args()

    # Build agent → persona mapping
    agents = []
    for i, agent_id in enumerate(args.agents):
        if args.personas and i < len(args.personas):
            persona = args.personas[i]
        else:
            persona = detect_persona(agent_id)
        agents.append({"id": agent_id, "persona": persona, "config": SCENARIOS[persona]})

    customers = CUSTOMERS[:args.customers]

    print(f"GT8004 Multi-Agent Client")
    print(f"  Base URL:   {args.base_url}")
    print(f"  Requests:   {args.count}")
    print(f"  Interval:   {args.interval}s")
    print(f"  Customers:  {len(customers)}")
    print(f"  Agents:")
    for a in agents:
        print(f"    {a['id']} ({a['persona']})")
        for ep in a["config"]["endpoints"]:
            print(f"      {ep['path']}")
    print()

    # Per-agent stats
    agent_stats = {a["id"]: {"ok": 0, "err": 0, "total_ms": 0.0, "paths": {}} for a in agents}
    total_ok = 0
    total_err = 0

    for i in range(args.count):
        agent = random.choice(agents)
        customer = random.choice(customers)
        path, payload = pick_scenario(agent["config"])

        result = send_request(args.base_url, agent["id"], path, payload, customer)
        st = agent_stats[agent["id"]]
        st["total_ms"] += result["ms"]
        st["paths"][path] = st["paths"].get(path, 0) + 1

        if result["ok"]:
            st["ok"] += 1
            total_ok += 1
        else:
            st["err"] += 1
            total_err += 1

        total = i + 1
        pct = total / args.count * 100
        sys.stdout.write(
            f"\r  [{total}/{args.count}] {pct:5.1f}%  "
            f"{result['status']} {agent['id'][:16]:16s} {result['path']:25s} "
            f"{result['ms']:6.0f}ms  "
            f"ok={total_ok} err={total_err}"
        )
        sys.stdout.flush()

        if i < args.count - 1:
            time.sleep(args.interval * random.uniform(0.8, 1.2))

    # Summary
    total = total_ok + total_err
    print("\n")
    print("=" * 70)
    print(f"  Total: {total}  |  OK: {total_ok} ({total_ok/total*100:.1f}%)  |  Errors: {total_err} ({total_err/total*100:.1f}%)")
    print()

    for a in agents:
        st = agent_stats[a["id"]]
        count = st["ok"] + st["err"]
        if count == 0:
            continue
        avg_ms = st["total_ms"] / count
        print(f"  {a['id']} ({a['persona']})")
        print(f"    Requests: {count}  OK: {st['ok']}  Errors: {st['err']}  Avg: {avg_ms:.0f}ms")
        for path, cnt in sorted(st["paths"].items(), key=lambda x: -x[1]):
            print(f"      {path}: {cnt}")
        print()

    print("=" * 70)


if __name__ == "__main__":
    main()
