# ERC-8004 Agent Protocol Reference

Target: **Captain Dackie** (Token #1380, Base Mainnet)
Source: https://www.8004scan.io/agents/base/1380
Date: 2026-02-09

---

## 1. On-Chain Identity

| Field | Value |
|-------|-------|
| Token ID | 1380 |
| Chain | Base (8453) |
| Contract | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |
| Owner | `0xf9d1d63f362bbf1ee08ab9acb36fe74afc48d5f1` (capminal.eth) |
| Created | 2026-02-04 10:15:17 UTC (block 41705381) |
| TX | `0x17cf976a8d6e856877c0fb55d26437cce6af2d55931bf1718d3c44bae411b066` |
| Cross-chain | Ethereum Mainnet Token #9382 (same owner) |

---

## 2. AgentURI (IPFS On-Chain Metadata)

**URI**: `ipfs://bafkreid6javlu6glvcd7dx4z7phn2b5nyut5bmczm7osbffn7kyf6l7dvm`
**Gateway**: `https://ipfs.io/ipfs/bafkreid6javlu6glvcd7dx4z7phn2b5nyut5bmczm7osbffn7kyf6l7dvm`

### Request
```
GET /ipfs/bafkreid6javlu6glvcd7dx4z7phn2b5nyut5bmczm7osbffn7kyf6l7dvm HTTP/2
Host: ipfs.io
User-Agent: curl/8.7.1
Accept: */*
```

### Response Headers
```
HTTP/2 200
content-type: application/json
content-length: 3438
server: cloudflare
cf-cache-status: HIT
cache-control: public, max-age=29030400, immutable
etag: "bafkreid6javlu6glvcd7dx4z7phn2b5nyut5bmczm7osbffn7kyf6l7dvm"
access-control-allow-origin: *
x-ipfs-path: /ipfs/bafkreid6javlu6glvcd7dx4z7phn2b5nyut5bmczm7osbffn7kyf6l7dvm
x-ipfs-roots: bafkreid6javlu6glvcd7dx4z7phn2b5nyut5bmczm7osbffn7kyf6l7dvm
```

### Response Body
```json
{
  "type": "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
  "name": "Captain Dackie",
  "description": "I am Captain Dackie | A DeFAI and x402 AI Agent from Capminal | Find me here: https://app.virtuals.io/virtuals/23397 | CA: 0xbfa733702305280F066D470afDFA784fA70e2649",
  "image": "https://blob.8004scan.app/cd88d8d9643e55c6273de7642512d98cef2fa975bf8c2454d5fc19be4e2142a5.jpg",
  "active": true,
  "services": [
    {
      "name": "web",
      "endpoint": "https://app.virtuals.io/virtuals/23397"
    },
    {
      "name": "MCP",
      "endpoint": "https://www.capminal.ai/mcp",
      "version": "2025-01-15",
      "tools": [
        "execute_swap",
        "check_balance",
        "get_token_price",
        "send_transaction",
        "analyze_wallet",
        "monitor_positions"
      ],
      "prompts": ["tools", "resources", "prompts"],
      "capabilities": ["tools", "resources", "prompts"]
    },
    {
      "name": "OASF",
      "endpoint": "https://github.com/agntcy/oasf/",
      "version": "v0.8.0",
      "skills": [
        "retrieval_augmented_generation/retrieval_of_information/retrieval_of_information",
        "retrieval_augmented_generation/retrieval_of_information/search",
        "tool_interaction/tool_use_planning",
        "tool_interaction/api_integration",
        "tool_interaction/blockchain_interaction",
        "advanced_reasoning_planning/strategic_planning",
        "advanced_reasoning_planning/chain_of_thought_structuring",
        "advanced_reasoning_planning/decision_making",
        "advanced_reasoning_planning/risk_assessment",
        "data_analysis/quantitative_analysis",
        "data_analysis/market_analysis",
        "data_analysis/pattern_recognition",
        "automation/workflow_automation",
        "automation/transaction_execution"
      ],
      "domains": [
        "base_domain",
        "finance_and_business/investment_services",
        "finance_and_business/finance_and_business",
        "finance_and_business/trading",
        "finance_and_business/defi",
        "finance_and_business/crypto_assets",
        "technology/blockchain",
        "technology/smart_contracts"
      ]
    },
    {
      "name": "A2A",
      "endpoint": "https://www.capminal.ai/.well-known/agent-card.json",
      "version": "0.3.0",
      "a2aSkills": [
        "trade/swap/multisend/airdrop",
        "deploy_clanker_token/claim_reward",
        "retrieve_top_tokens",
        "technical_analysis",
        "liquidity_provision",
        "yield_farming",
        "portfolio_management",
        "price_monitoring",
        "whale_tracking",
        "gas_optimization",
        "cross_chain_bridge",
        "token_snipe",
        "limit_orders",
        "dca_automation"
      ]
    },
    {
      "name": "custom",
      "endpoint": "https://www.capminal.ai/api/x402/deploy"
    },
    {
      "name": "email",
      "endpoint": "dackie@capminal.ai"
    }
  ],
  "updatedAt": 1738454400,
  "external_url": "https://www.capminal.ai",
  "registrations": [
    {
      "agentId": 9382,
      "agentRegistry": "eip155:1:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432"
    },
    {
      "agentId": 1380,
      "agentRegistry": "eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432"
    }
  ],
  "supportedTrust": ["crypto-economic", "tee-attestation", "reputation"],
  "x402Support": true
}
```

### AgentURI Schema (`eip-8004#registration-v1`)

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | Schema identifier (`eip-8004#registration-v1`) |
| `name` | string | Agent display name |
| `description` | string | Agent description |
| `image` | string | Avatar/logo URL |
| `active` | boolean | Whether agent is active |
| `services[]` | array | Protocol endpoints |
| `services[].name` | string | Protocol name (`MCP`, `A2A`, `OASF`, `web`, `custom`, `email`) |
| `services[].endpoint` | string | Protocol endpoint URL |
| `services[].version` | string | Protocol version |
| `services[].tools` | string[] | MCP tool names |
| `services[].capabilities` | string[] | MCP capabilities |
| `services[].skills` | string[] | OASF skill taxonomy paths |
| `services[].domains` | string[] | OASF domain taxonomy |
| `services[].a2aSkills` | string[] | A2A skill identifiers |
| `registrations[]` | array | Cross-chain registrations |
| `registrations[].agentId` | number | Token ID on that chain |
| `registrations[].agentRegistry` | string | CAIP-10 registry address |
| `supportedTrust` | string[] | Trust models supported |
| `x402Support` | boolean | x402 payment support |
| `updatedAt` | number | Unix timestamp of last update |
| `external_url` | string | Agent's website |

---

## 3. A2A Agent Card (`/.well-known/agent-card.json`)

### Request
```
GET /.well-known/agent-card.json HTTP/2
Host: www.capminal.ai
User-Agent: curl/8.7.1
Accept: */*
```

### Response Headers
```
HTTP/2 200
content-type: application/json; charset=utf-8
content-length: 7183
access-control-allow-origin: *
cache-control: no-cache, no-store, must-revalidate, proxy-revalidate, max-age=0
server: Vercel
x-vercel-cache: HIT
x-matched-path: /.well-known/agent-card.json
strict-transport-security: max-age=63072000
x-content-type-options: nosniff
```

### Response Body
```json
{
  "name": "Captain Dackie",
  "description": "Captain Dackie is a DeFAI AI Agent powered by Capminal, specializing in DeFi operations on Base network. Execute token swaps, airdrops, multi-send transactions, Clanker token deployment, yield farming, and technical analysis with real-time market intelligence.",
  "url": "https://www.capminal.ai/a2a",
  "version": "1.0.0",
  "documentationUrl": "https://capminal.gitbook.io/docs",
  "protocolVersions": ["0.3"],
  "provider": {
    "organization": "Capminal",
    "url": "https://www.capminal.ai",
    "supportEmail": "dackie@capminal.ai"
  },
  "capabilities": {
    "streaming": true,
    "pushNotifications": true,
    "stateTransitionHistory": true,
    "multiTurn": true
  },
  "securitySchemes": {
    "bearer": {
      "type": "http",
      "scheme": "bearer",
      "bearerFormat": "JWT"
    },
    "x402": {
      "type": "apiKey",
      "in": "header",
      "name": "X-402-Payment"
    }
  },
  "security": [
    { "bearer": [] },
    { "x402": [] }
  ],
  "defaultInputModes": ["text/plain", "application/json"],
  "defaultOutputModes": ["text/plain", "application/json"],
  "skills": [
    {
      "id": "swap",
      "name": "Token Swap",
      "description": "Execute token swaps on DEXs with optimal routing and slippage protection",
      "tags": ["defi", "trading", "swap"],
      "inputModes": ["application/json"],
      "outputModes": ["application/json"],
      "examples": ["Swap 1 ETH for USDC", "Exchange 100 USDC to DACKIE with 0.5% slippage"]
    },
    {
      "id": "multisend",
      "name": "Multi-Send",
      "description": "Send tokens to multiple addresses in a single transaction for gas efficiency",
      "tags": ["transfer", "batch", "airdrop"],
      "inputModes": ["application/json"],
      "outputModes": ["application/json"],
      "examples": ["Send 10 USDC to 5 different wallets", "Batch transfer tokens to team members"]
    },
    {
      "id": "airdrop",
      "name": "Airdrop Tokens",
      "description": "Distribute tokens to a list of recipients efficiently",
      "tags": ["airdrop", "distribution", "transfer"],
      "inputModes": ["application/json"],
      "outputModes": ["application/json"],
      "examples": ["Airdrop 1000 tokens to holders", "Distribute rewards to community"]
    },
    {
      "id": "deploy-clanker-token",
      "name": "Deploy Clanker Token",
      "description": "Deploy new tokens using Clanker protocol on Base network",
      "tags": ["deployment", "token", "clanker"],
      "inputModes": ["application/json"],
      "outputModes": ["application/json"],
      "examples": ["Deploy a new meme token with 1B supply", "Create token with custom tokenomics"]
    },
    {
      "id": "claim-reward",
      "name": "Claim Rewards",
      "description": "Claim pending rewards from DeFi protocols and staking positions",
      "tags": ["rewards", "claim", "yield"],
      "inputModes": ["application/json"],
      "outputModes": ["application/json"],
      "examples": ["Claim my staking rewards", "Harvest yield from LP positions"]
    },
    {
      "id": "retrieve-top-tokens",
      "name": "Retrieve Top Tokens",
      "description": "Get real-time data on trending and top-performing tokens",
      "tags": ["analytics", "market-data", "research"],
      "inputModes": ["application/json"],
      "outputModes": ["application/json"],
      "examples": ["Show me top gainers today", "What are the trending tokens on Base?"]
    },
    {
      "id": "technical-analysis",
      "name": "Technical Analysis",
      "description": "Perform technical analysis on tokens including price patterns, indicators, and signals",
      "tags": ["analysis", "trading", "charts"],
      "inputModes": ["application/json"],
      "outputModes": ["application/json"],
      "examples": ["Analyze ETH price action", "What's the RSI for DACKIE?"]
    },
    {
      "id": "liquidity-provision",
      "name": "Liquidity Provision",
      "description": "Add or remove liquidity from DEX pools with optimal range positioning",
      "tags": ["defi", "liquidity", "amm"],
      "inputModes": ["application/json"],
      "outputModes": ["application/json"],
      "examples": ["Add liquidity to ETH/USDC pool", "Remove my LP position"]
    },
    {
      "id": "yield-farming",
      "name": "Yield Farming",
      "description": "Find and enter yield farming opportunities with risk assessment",
      "tags": ["defi", "yield", "farming"],
      "inputModes": ["application/json"],
      "outputModes": ["application/json"],
      "examples": ["Find best yield farms on Base", "Stake my LP tokens for rewards"]
    },
    {
      "id": "portfolio-management",
      "name": "Portfolio Management",
      "description": "Track and manage your DeFi portfolio across protocols",
      "tags": ["portfolio", "tracking", "management"],
      "inputModes": ["application/json"],
      "outputModes": ["application/json"],
      "examples": ["Show my portfolio value", "What's my asset allocation?"]
    },
    {
      "id": "whale-tracking",
      "name": "Whale Tracking",
      "description": "Monitor large wallet movements and whale activity",
      "tags": ["analytics", "whales", "monitoring"],
      "inputModes": ["application/json"],
      "outputModes": ["application/json"],
      "examples": ["Track whale movements for DACKIE", "Alert me on large transfers"]
    },
    {
      "id": "limit-orders",
      "name": "Limit Orders",
      "description": "Place limit orders that execute automatically when price targets are hit",
      "tags": ["trading", "orders", "automation"],
      "inputModes": ["application/json"],
      "outputModes": ["application/json"],
      "examples": ["Buy ETH when it drops to $3000", "Sell DACKIE at $0.10"]
    },
    {
      "id": "dca-automation",
      "name": "DCA Automation",
      "description": "Set up dollar-cost averaging strategies for automated recurring purchases",
      "tags": ["automation", "dca", "investment"],
      "inputModes": ["application/json"],
      "outputModes": ["application/json"],
      "examples": ["DCA $100 into ETH weekly", "Set up daily DACKIE purchases"]
    },
    {
      "id": "cross-chain-bridge",
      "name": "Cross-Chain Bridge",
      "description": "Bridge assets between different blockchain networks securely",
      "tags": ["bridge", "cross-chain", "transfer"],
      "inputModes": ["application/json"],
      "outputModes": ["application/json"],
      "examples": ["Bridge ETH from Ethereum to Base", "Move USDC to Arbitrum"]
    }
  ],
  "supportsX402": true,
  "erc8004": {
    "agentRegistry": "eip155:8453:0x8004Fa643dFf6Bf08F78733b06F1f5f040cA47c0",
    "tokenAddress": "0xbfa733702305280F066D470afDFA784fA70e2649",
    "virtualsUrl": "https://app.virtuals.io/virtuals/23397"
  }
}
```

### A2A Agent Card Schema (v0.3)

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Agent name |
| `description` | string | Full description |
| `url` | string | A2A JSON-RPC endpoint |
| `version` | string | Agent version |
| `documentationUrl` | string | Docs link |
| `protocolVersions` | string[] | Supported A2A versions |
| `provider.organization` | string | Provider org name |
| `provider.url` | string | Provider website |
| `provider.supportEmail` | string | Support contact |
| `capabilities.streaming` | boolean | Supports SSE streaming |
| `capabilities.pushNotifications` | boolean | Push notifications |
| `capabilities.stateTransitionHistory` | boolean | Task state history |
| `capabilities.multiTurn` | boolean | Multi-turn conversations |
| `securitySchemes` | object | Auth methods (bearer JWT, x402) |
| `security` | array | Required security schemes |
| `defaultInputModes` | string[] | Accepted input MIME types |
| `defaultOutputModes` | string[] | Output MIME types |
| `skills[]` | array | Agent capabilities |
| `skills[].id` | string | Skill identifier |
| `skills[].name` | string | Display name |
| `skills[].description` | string | What the skill does |
| `skills[].tags` | string[] | Categorization tags |
| `skills[].examples` | string[] | Example prompts |
| `supportsX402` | boolean | x402 payment protocol |
| `erc8004` | object | On-chain identity reference |

---

## 4. MCP Endpoint

**URL**: `https://www.capminal.ai/mcp`
**Protocol Version**: `2025-01-15`

### Request (JSON-RPC initialize)
```
POST /mcp HTTP/2
Host: www.capminal.ai
Content-Type: application/json
Accept: text/event-stream

{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2025-06-18",
    "capabilities": {},
    "clientInfo": {
      "name": "gt8004-test",
      "version": "1.0"
    }
  }
}
```

### Response
```
HTTP/2 405
content-type: text/html; charset=utf-8
server: Vercel
x-matched-path: /404
x-next-error-status: 404
```

**Note**: MCP endpoint returned 405 Method Not Allowed. Likely requires:
- Authentication (Bearer JWT or x402 payment header)
- Specific MCP transport (stdio via WebSocket, or SSE at a different path like `/mcp/sse`)
- The declared version is `2025-01-15` which may use Streamable HTTP transport

### Declared MCP Tools
| Tool | Description |
|------|-------------|
| `execute_swap` | Execute token swaps |
| `check_balance` | Check wallet balances |
| `get_token_price` | Get token prices |
| `send_transaction` | Send blockchain transactions |
| `analyze_wallet` | Analyze wallet activity |
| `monitor_positions` | Monitor DeFi positions |

---

## 5. A2A JSON-RPC Endpoint

**URL**: `https://www.capminal.ai/a2a`

### Request (tasks/send)
```
POST /a2a HTTP/2
Host: www.capminal.ai
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tasks/send",
  "params": {
    "id": "test-001",
    "message": {
      "role": "user",
      "parts": [
        {
          "type": "text",
          "text": "What is your name?"
        }
      ]
    }
  }
}
```

### Response
```
HTTP/2 405
server: Vercel
x-matched-path: /404
```

**Note**: A2A endpoint returned 405. Requires Bearer JWT or x402 payment authentication.

---

## 6. x402 Custom Endpoint

**URL**: `https://www.capminal.ai/api/x402/deploy`

### Request
```
GET /api/x402/deploy HTTP/2
Host: www.capminal.ai
```

### Response
```
HTTP/2 405
server: Vercel
content-length: 0
x-matched-path: /api/x402/deploy
```

**Note**: 405 on GET. This is a POST-only endpoint for x402-paid token deployment.

---

## 7. Protocol Flow Summary

### Discovery Flow
```
1. On-chain: ERC-8004 contract → getAgentURI(tokenId=1380)
   → returns IPFS CID

2. IPFS resolve: ipfs://bafkrei... → JSON metadata
   → contains services[] with protocol endpoints

3. A2A discovery: GET /.well-known/agent-card.json
   → full agent capabilities, skills, security schemes

4. MCP discovery: POST /mcp with initialize
   → tool list, capabilities, protocol negotiation
```

### Interaction Flow
```
┌─────────┐     ┌──────────────┐     ┌──────────────┐
│  Client  │────>│  A2A / MCP   │────>│  Agent Logic │
│          │     │  Endpoint    │     │  (Capminal)  │
└─────────┘     └──────────────┘     └──────────────┘
     │                                      │
     │  Auth: Bearer JWT or X-402-Payment   │
     │  Protocol: JSON-RPC 2.0              │
     │  Transport: HTTP/2 + SSE             │
     │                                      │
     │  A2A: tasks/send, tasks/get          │
     │  MCP: tools/list, tools/call         │
     └──────────────────────────────────────┘
```

### Authentication Methods

| Method | Header | Description |
|--------|--------|-------------|
| Bearer JWT | `Authorization: Bearer <token>` | Standard JWT auth |
| x402 Payment | `X-402-Payment: <payment_data>` | Pay-per-request via x402 protocol |

### x402 Payment Flow
```
1. Client sends request without payment
2. Agent returns 402 Payment Required + payment details
3. Client signs payment on-chain
4. Client resends request with X-402-Payment header
5. Agent verifies payment and processes request
```

---

## 8. Key Observations

1. **AgentURI is the source of truth**: On-chain `agentURI` (IPFS) contains all service endpoints. This is the canonical discovery mechanism.

2. **A2A agent-card is a superset**: The `/.well-known/agent-card.json` contains richer data (skills with examples, security schemes, capabilities) compared to the on-chain metadata.

3. **Multi-protocol support**: A single agent can expose MCP, A2A, OASF, and custom endpoints simultaneously. Each serves different client types.

4. **Cross-chain identity**: `registrations[]` in agentURI links the same agent across chains (Base #1380 = Ethereum #9382).

5. **CAIP-10 format**: Registry addresses use `eip155:{chainId}:{address}` format for cross-chain identification.

6. **Authentication gating**: Discovery endpoints (agent-card.json, IPFS metadata) are public. Execution endpoints (MCP, A2A, x402) require authentication.

7. **OASF taxonomy**: Uses hierarchical skill/domain classification (`tool_interaction/blockchain_interaction`, `finance_and_business/defi`).

8. **Trust models**: Declares supported trust mechanisms (`crypto-economic`, `tee-attestation`, `reputation`).
