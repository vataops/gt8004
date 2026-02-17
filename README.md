# GT8004

**The business intelligence platform for AI agents — monitor, analyze, and prove the real value of autonomous agents.**

GT8004 is the Stripe Dashboard for AI agents. We give agent operators the tools to understand their business, and give users the transparency to find agents that actually deliver.

---

## What is GT8004?

AI agents are becoming real businesses — serving requests, earning revenue, building reputations. But there's no infrastructure to track any of it.

**For agent operators**, GT8004 provides a full-stack analytics dashboard out of the box. SDK 5 lines, and you get request logging, customer intelligence, revenue tracking, and performance monitoring — the same operational visibility that Stripe gives to online businesses.

**For users**, GT8004 makes the agent economy transparent. Instead of trusting marketing claims, you can verify an agent's actual performance, uptime, response times, and customer satisfaction through real data — backed by on-chain identity via ERC-8004.

---

## For Agent Operators

Everything you need to run your agent as a business.

### Analytics Dashboard
Real-time visibility into requests, customers, revenue, and performance. Daily trends, tool-level breakdowns, and health scores.

### Customer Intelligence
Know who's using your agent. Track per-customer usage, spending patterns, tool preferences, and churn risk. Conversion funnel analysis from first visit to repeat user.

### Performance Monitoring
p50/p95/p99 latency tracking, error rate monitoring, uptime scoring. Health score cards with trend indicators.

### Revenue Tracking
Automatic x402 payment capture. Revenue by tool, by customer, by time period. Protocol-level breakdown (HTTP, MCP, A2A).

### SDK Integration

**Python SDK** — works with any framework. 5 lines to integrate.

MCP Server (FastMCP):
```python
from fastmcp import FastMCP
from gt8004 import GT8004Logger
from gt8004.middleware.mcp import GT8004MCPMiddleware

logger = GT8004Logger(agent_id="...", api_key="...", protocol="mcp")
logger.transport.start_auto_flush()

mcp = FastMCP("my-server")
mcp.add_middleware(GT8004MCPMiddleware(logger))
# Auto-extracts tool names from MCP tool calls
```

A2A Server (FastAPI):
```python
from fastapi import FastAPI
from gt8004 import GT8004Logger
from gt8004.middleware.fastapi import GT8004Middleware

logger = GT8004Logger(agent_id="...", api_key="...", protocol="a2a")
logger.transport.start_auto_flush()

app = FastAPI()
app.add_middleware(GT8004Middleware, logger=logger)
# Auto-extracts skill_id from A2A request bodies
```

Flask / Django:
```python
from flask import Flask
from gt8004 import GT8004Logger
from gt8004.middleware.flask import GT8004FlaskMiddleware

logger = GT8004Logger(agent_id="...", api_key="...")
logger.transport.start_auto_flush()

app = Flask(__name__)
app.wsgi_app = GT8004FlaskMiddleware(app.wsgi_app, logger)
```

| Framework | Middleware | Install |
|-----------|-----------|---------|
| FastMCP (MCP servers) | `GT8004MCPMiddleware` | `pip install gt8004-sdk[mcp]` |
| FastAPI / Starlette | `GT8004Middleware` | `pip install gt8004-sdk[fastapi]` |
| Flask / Django | `GT8004FlaskMiddleware` | `pip install gt8004-sdk` |

Zero-latency async log collection. Batch transport with circuit breaker. Protocol-aware tool name extraction (MCP, A2A). Auto-captures requests, responses, headers, x402 payments, and client info.

### On-Chain Identity
Register your agent as an ERC-8004 token. Create agents with a 7-step wizard — set metadata, choose networks, and mint directly from the dashboard. Link existing tokens to your GT8004 account for unified analytics.

---

## For Users

Transparent data to find agents that actually work.

### Agent Explorer
Browse and search registered agents by category, protocol, or capability. Compare performance metrics side by side.

### On-Chain Discovery
Discover agents directly from the blockchain. Multi-chain scanning across Ethereum, Base, and testnets. View on-chain metadata, verify ownership, and check registration status.

### Reputation & Benchmarks
Category-based benchmarking with real performance data. Reputation scores from the ERC-8004 Reputation Registry. Feedback history and trust verification.

### Transparent Metrics
Every agent's stats are visible — response times, error rates, request volumes, customer counts. No black boxes.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  Dashboard (Next.js)                                         │
│  Agent explorer, analytics, create wizard, on-chain discovery│
└──────────────┬───────────────────────────────────────────────┘
               │
┌──────────────▼───────────────────────────────────────────────┐
│  API Gateway (Go/Gin)                                        │
│  Reverse proxy, routing, agent gateway                       │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────┐ ┌─────────────┐ ┌────────────────────────┐ │
│  │  Registry    │ │  Analytics  │ │  Discovery             │ │
│  │              │ │             │ │                        │ │
│  │  Agent CRUD  │ │  Stats      │ │  On-chain scanner      │ │
│  │  Auth        │ │  Customers  │ │  Multi-chain sync      │ │
│  │  Gateway     │ │  Revenue    │ │  Metadata indexing     │ │
│  │  ERC-8004    │ │  Performance│ │                        │ │
│  │  link        │ │  Benchmarks │ │                        │ │
│  └─────────────┘ └─────────────┘ └────────────────────────┘ │
│                                                              │
│  ┌─────────────┐                                             │
│  │  Ingest      │  ← SDK / middleware log collection         │
│  │              │                                            │
│  │  Batch write │                                            │
│  │  Rate limit  │                                            │
│  └─────────────┘                                             │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│  PostgreSQL — shared database, per-service schemas           │
├──────────────────────────────────────────────────────────────┤
│  ERC-8004 Identity Registry + Reputation Registry (on-chain) │
└──────────────────────────────────────────────────────────────┘
```

**5 independent Go microservices** — no inter-service API calls. Each service reads directly from the database or on-chain contracts. The blockchain is the single source of truth for agent identity and metadata.

---

## Documentation

| Doc | Description |
|-----|-------------|
| [services.md](docs/services.md) | All 5 microservices — routes, env vars, architecture |
| [database.md](docs/database.md) | 11 tables, schema definitions, migrations |
| [dashboard.md](docs/dashboard.md) | 14 pages, components, auth flow, hooks |
| [sdk.md](docs/sdk.md) | Go common packages + Python SDK |
| [contracts.md](docs/contracts.md) | ERC-8004 Identity & Reputation Registry ABI |
| [infra.md](docs/infra.md) | GCP Terraform infrastructure |
| [agents.md](docs/agents.md) | Python A2A companion agents |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Go 1.24, Gin, pgx, zap |
| Frontend | Next.js 16, React 19, Tailwind CSS 4, Recharts |
| Database | PostgreSQL 16 |
| Blockchain | ethers.js 6, ERC-8004, ERC-721 |
| SDK | Python ([gt8004-sdk](https://github.com/vataops/gt8004-sdk)) |
| Infrastructure | GCP Cloud Run, Cloud SQL, Terraform |
| Agents | Python, A2A protocol |

## Supported Networks

### Mainnet

| Network | Chain ID | Identity Registry | Reputation Registry |
|---------|----------|-------------------|---------------------|
| Ethereum | 1 | 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432 | 0x8004BAa17C55a88189AE136b182e5fdA19dE9b63 |
| Base | 8453 | 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432 | 0x8004BAa17C55a88189AE136b182e5fdA19dE9b63 |

### Testnet

| Network | Chain ID | Identity Registry | Reputation Registry |
|---------|----------|-------------------|---------------------|
| Base Sepolia | 84532 | 0x8004A818BFB912233c491871b3d84c89A494BD9e | 0x8004B663056A597Dffe9eCcC1965A193B7388713 |
| Ethereum Sepolia | 11155111 | 0x8004A818BFB912233c491871b3d84c89A494BD9e | — |

---

## Links

- ERC-8004: https://eips.ethereum.org/EIPS/eip-8004
- x402 Protocol: https://www.x402.org

## License

TBD
