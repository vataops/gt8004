"""
Dummy Agent Origin Server
=========================
모든 등록된 agent의 origin_endpoint로 동작하는 단일 서버.
여러 agent를 등록할 때 전부 같은 origin (http://localhost:8001)으로 설정.
게이트웨이가 agent_id 기준으로 라우팅 → 이 서버로 프록시 → path로 처리 구분.

흐름:
  client → POST /gateway/{agent_id}/api/pool-analysis
              ↓
  GT8004 gateway → agent_id로 DB 조회 → origin_endpoint: http://localhost:8001
              ↓
  이 서버 → POST /api/pool-analysis 수신 → 응답

Usage:
    python agent_server.py [--port 8001]
"""

import argparse
import json
import random
import time
from http.server import HTTPServer, BaseHTTPRequestHandler

# ── 전체 엔드포인트 (모든 agent가 공유) ────────────────────────

ENDPOINTS = {
    # ── DeFi ──
    "/api/pool-analysis": [
        {"pool": "ETH/USDC", "tvl": 245_000_000, "apr": 4.82, "il_risk": "medium", "recommendation": "Attractive yield with manageable IL risk. Consider 30% allocation."},
        {"pool": "WBTC/ETH", "tvl": 180_000_000, "apr": 2.15, "il_risk": "low", "recommendation": "Correlated pair, low IL. Solid for conservative DeFi exposure."},
        {"pool": "ARB/ETH", "tvl": 32_000_000, "apr": 12.5, "il_risk": "high", "recommendation": "High APR but volatile. Limit to 5-10% of portfolio."},
        {"pool": "USDC/USDT", "tvl": 890_000_000, "apr": 0.8, "il_risk": "negligible", "recommendation": "Stablecoin pair, near-zero IL. Park idle capital here."},
    ],
    "/api/yield-compare": [
        {"protocol": "Aave V3", "asset": "USDC", "supply_apy": 3.82, "borrow_apy": 5.14, "utilization": 0.74, "chain": "Ethereum"},
        {"protocol": "Compound", "asset": "USDC", "supply_apy": 3.21, "borrow_apy": 4.87, "utilization": 0.68, "chain": "Ethereum"},
        {"protocol": "Morpho", "asset": "USDC", "supply_apy": 4.55, "borrow_apy": 5.90, "utilization": 0.81, "chain": "Base"},
        {"protocol": "Spark", "asset": "DAI", "supply_apy": 5.00, "borrow_apy": 5.50, "utilization": 0.90, "chain": "Ethereum"},
    ],
    "/api/risk-score": [
        {"protocol": "Uniswap V3", "risk_score": 15, "max": 100, "grade": "A", "factors": ["audited", "battle-tested", "high TVL", "decentralized governance"]},
        {"protocol": "Unknown DEX", "risk_score": 72, "max": 100, "grade": "D", "factors": ["unaudited", "low TVL", "centralized admin key", "no timelock"]},
        {"protocol": "Aave V3", "risk_score": 12, "max": 100, "grade": "A+", "factors": ["multiple audits", "bug bounty", "governance", "insurance fund"]},
    ],
    "/api/impermanent-loss": [
        {"pair": "ETH/USDC", "price_change_pct": 25.0, "il_pct": 0.6, "fees_earned_pct": 3.2, "net_pnl_pct": 2.6, "verdict": "Fees outweigh IL. Profitable position."},
        {"pair": "SOL/USDC", "price_change_pct": 80.0, "il_pct": 3.8, "fees_earned_pct": 8.1, "net_pnl_pct": 4.3, "verdict": "High volatility but fees compensate."},
    ],

    # ── Market Intelligence ──
    "/api/market-overview": [
        {"btc_price": 97842, "eth_price": 3421, "total_mcap": "3.2T", "btc_dominance": 52.3, "fear_greed": 68, "sentiment": "greed", "trend": "bullish"},
        {"btc_price": 95100, "eth_price": 3280, "total_mcap": "3.1T", "btc_dominance": 53.1, "fear_greed": 45, "sentiment": "neutral", "trend": "consolidating"},
        {"btc_price": 101200, "eth_price": 3650, "total_mcap": "3.4T", "btc_dominance": 51.8, "fear_greed": 78, "sentiment": "extreme greed", "trend": "bullish"},
    ],
    "/api/token-analysis": [
        {"token": "ETH", "price": 3421, "change_24h": 2.3, "volume_24h": 18_500_000_000, "rsi": 58, "support": 3200, "resistance": 3600, "signal": "buy"},
        {"token": "SOL", "price": 187, "change_24h": -1.8, "volume_24h": 4_200_000_000, "rsi": 42, "support": 175, "resistance": 200, "signal": "hold"},
        {"token": "ARB", "price": 1.24, "change_24h": 5.7, "volume_24h": 890_000_000, "rsi": 71, "support": 1.10, "resistance": 1.35, "signal": "hold"},
        {"token": "BTC", "price": 97842, "change_24h": 0.8, "volume_24h": 42_000_000_000, "rsi": 55, "support": 95000, "resistance": 100000, "signal": "buy"},
    ],
    "/api/whale-alerts": [
        {"alerts": [
            {"type": "transfer", "token": "BTC", "amount": 2500, "usd_value": 244_600_000, "from": "unknown", "to": "Coinbase", "signal": "bearish"},
            {"type": "accumulation", "token": "ETH", "amount": 45000, "usd_value": 153_945_000, "from": "Binance", "to": "unknown", "signal": "bullish"},
        ]},
        {"alerts": [
            {"type": "transfer", "token": "SOL", "amount": 500000, "usd_value": 93_500_000, "from": "unknown", "to": "Kraken", "signal": "bearish"},
        ]},
    ],
    "/api/correlation": [
        {"pairs": [
            {"a": "BTC", "b": "ETH", "correlation": 0.87, "period": "30d"},
            {"a": "BTC", "b": "SOL", "correlation": 0.72, "period": "30d"},
            {"a": "ETH", "b": "SOL", "correlation": 0.81, "period": "30d"},
            {"a": "BTC", "b": "GOLD", "correlation": 0.23, "period": "30d"},
        ]},
    ],

    # ── NFT & On-chain ──
    "/api/collection-stats": [
        {"collection": "CryptoPunks", "floor": 48.5, "volume_24h": 312.4, "holders": 3842, "listed_pct": 4.2, "trend": "stable"},
        {"collection": "Bored Apes", "floor": 12.8, "volume_24h": 89.2, "holders": 6421, "listed_pct": 6.8, "trend": "declining"},
        {"collection": "Pudgy Penguins", "floor": 8.2, "volume_24h": 145.6, "holders": 4891, "listed_pct": 3.1, "trend": "rising"},
    ],
    "/api/wallet-profile": [
        {"address": "0x1234...abcd", "eth_balance": 142.5, "nft_count": 23, "defi_positions": 5, "total_value_usd": 520_000, "label": "DeFi Power User"},
        {"address": "0x5678...efgh", "eth_balance": 0.8, "nft_count": 156, "defi_positions": 1, "total_value_usd": 45_000, "label": "NFT Collector"},
    ],
    "/api/gas-estimate": [
        {"base_fee_gwei": 12.4, "priority_fee_gwei": 0.5, "costs": {"transfer": 0.42, "swap": 2.85, "nft_mint": 3.20}, "recommendation": "Gas low. Good time for transactions."},
        {"base_fee_gwei": 45.2, "priority_fee_gwei": 2.1, "costs": {"transfer": 1.58, "swap": 10.50, "nft_mint": 12.10}, "recommendation": "Gas elevated. Defer non-urgent txs."},
    ],
    "/api/contract-scan": [
        {"address": "0xdead...beef", "verified": True, "is_proxy": False, "owner_renounced": True, "risk": "low", "notes": "Standard ERC-721, owner renounced."},
        {"address": "0xcafe...babe", "verified": False, "is_proxy": True, "owner_renounced": False, "risk": "high", "notes": "Unverified proxy with admin controls."},
    ],

    # ── P2E (Play-to-Earn) ──
    "/api/game-stats": [
        {"game": "Axie Infinity", "dau": 285_000, "monthly_revenue_usd": 12_400_000, "token": "AXS", "token_price": 8.42, "nft_volume_24h": 1_250_000, "chain": "Ronin"},
        {"game": "The Sandbox", "dau": 42_000, "monthly_revenue_usd": 3_800_000, "token": "SAND", "token_price": 0.54, "nft_volume_24h": 680_000, "chain": "Ethereum"},
        {"game": "Illuvium", "dau": 18_500, "monthly_revenue_usd": 2_100_000, "token": "ILV", "token_price": 52.30, "nft_volume_24h": 420_000, "chain": "Ethereum"},
        {"game": "Star Atlas", "dau": 31_000, "monthly_revenue_usd": 1_900_000, "token": "ATLAS", "token_price": 0.0042, "nft_volume_24h": 310_000, "chain": "Solana"},
    ],
    "/api/token-economy": [
        {"game": "Axie Infinity", "token": "SLP", "price": 0.0035, "daily_mint": 45_000_000, "daily_burn": 38_000_000, "inflation_rate": -2.1, "sustainability": "improving"},
        {"game": "StepN", "token": "GMT", "price": 0.22, "daily_mint": 2_800_000, "daily_burn": 2_100_000, "inflation_rate": 3.8, "sustainability": "moderate"},
        {"game": "Gods Unchained", "token": "GODS", "price": 0.31, "daily_mint": 500_000, "daily_burn": 420_000, "inflation_rate": 1.2, "sustainability": "healthy"},
    ],
    "/api/guild-rankings": [
        {"rankings": [
            {"rank": 1, "guild": "YGG", "members": 28_000, "tvl_usd": 14_500_000, "games": 12, "avg_daily_earnings": 45_000},
            {"rank": 2, "guild": "Merit Circle", "members": 15_200, "tvl_usd": 8_200_000, "games": 8, "avg_daily_earnings": 28_000},
            {"rank": 3, "guild": "GuildFi", "members": 9_800, "tvl_usd": 4_100_000, "games": 6, "avg_daily_earnings": 12_500},
            {"rank": 4, "guild": "Avocado Guild", "members": 6_400, "tvl_usd": 2_800_000, "games": 5, "avg_daily_earnings": 8_200},
        ]},
    ],
    "/api/reward-estimate": [
        {"game": "Axie Infinity", "strategy": "competitive", "daily_slp": 150, "daily_usd": 0.53, "monthly_usd": 15.75, "roi_days": 180, "risk": "medium"},
        {"game": "The Sandbox", "strategy": "land-rental", "daily_sand": 12, "daily_usd": 6.48, "monthly_usd": 194.40, "roi_days": 90, "risk": "low"},
        {"game": "Illuvium", "strategy": "farming", "daily_ilv": 0.02, "daily_usd": 1.05, "monthly_usd": 31.40, "roi_days": 240, "risk": "high"},
        {"game": "Star Atlas", "strategy": "mining", "daily_atlas": 5000, "daily_usd": 21.00, "monthly_usd": 630.00, "roi_days": 45, "risk": "medium"},
    ],
}


class AgentHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/health":
            self._respond(200, {"status": "healthy", "endpoints": list(ENDPOINTS.keys())})
            return
        self._handle_request()

    def do_POST(self):
        self._handle_request()

    def _handle_request(self):
        latency = random.uniform(0.05, 0.5)
        time.sleep(latency)
        processing_ms = round(latency * 1000, 1)

        content_length = int(self.headers.get("Content-Length", 0))
        self.rfile.read(content_length) if content_length > 0 else b""

        if random.random() < 0.05:
            self._respond(500, {"error": "Model inference failed", "processing_ms": processing_ms})
            return
        if random.random() < 0.02:
            time.sleep(1)
            self._respond(408, {"error": "Request timeout", "processing_ms": processing_ms + 1000})
            return

        path = self.path.split("?")[0]
        responses = ENDPOINTS.get(path)

        if responses is None:
            self._respond(404, {"error": f"Unknown endpoint: {path}", "available": list(ENDPOINTS.keys())})
            return

        result = dict(random.choice(responses))
        result["processing_ms"] = processing_ms
        self._respond(200, result)

    def _respond(self, status: int, data: dict):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        status = args[1] if len(args) > 1 else ""
        print(f"  [{status}] {args[0]}")


def main():
    parser = argparse.ArgumentParser(description="Dummy Agent Origin Server")
    parser.add_argument("--port", type=int, default=8001)
    args = parser.parse_args()

    server = HTTPServer(("0.0.0.0", args.port), AgentHandler)
    print(f"Origin server: http://localhost:{args.port}")
    print(f"모든 agent의 origin_endpoint를 이 주소로 설정하세요.")
    print(f"\nEndpoints ({len(ENDPOINTS)}):")
    for ep in ENDPOINTS:
        print(f"  POST {ep}")
    print(f"  GET  /health")
    print(f"\nError rate: ~7% (5% 500 + 2% 408)")
    print()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.")
        server.server_close()


if __name__ == "__main__":
    main()
