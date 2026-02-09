# Meerkat Agent Live Protocol Reference

Target: **James (meerkat-19)** — Robotics AI Agent
Source: https://testnet.8004scan.io (Base Sepolia)
Endpoint: `meerkat.up.railway.app`
Date: 2026-02-09

---

## 1. Discovery — A2A Agent Card

### Request
```http
GET /agents/meerkat-19/.well-known/agent-card.json HTTP/2
Host: meerkat.up.railway.app
Accept: */*
```

### Response Headers
```http
HTTP/2 200
content-type: application/json
content-length: 1885
access-control-allow-origin: *
access-control-expose-headers: PAYMENT-REQUIRED,PAYMENT-RESPONSE,X-PAYMENT-REQUIRED,X-PAYMENT-RESPONSE
server: railway-edge
```

### Response Body
```json
{
  "name": "James",
  "description": "James is a specialized AI agent with deep expertise in robotics, automation, and intelligent systems...",
  "url": "https://meerkat.up.railway.app/agents/meerkat-19",
  "version": "1.0.0",
  "defaultInputModes": ["text"],
  "defaultOutputModes": ["text"],
  "authentication": {
    "schemes": ["x402"],
    "description": "Payment via x402 USDC micropayments on Base network"
  },
  "skills": [
    {
      "id": "natural_language_processing_natural_language_generation_text_generation",
      "name": "Text Generation",
      "tags": ["natural-language-processing", "natural-language-generation", "text-generation"]
    },
    {
      "id": "natural_language_processing_natural_language_understanding_contextual_comprehension",
      "name": "Contextual Comprehension",
      "tags": ["natural-language-processing", "natural-language-understanding", "contextual-comprehension"]
    },
    {
      "id": "tool_interaction_automation_workflow_automation",
      "name": "Workflow Automation",
      "tags": ["tool-interaction", "automation", "workflow-automation"]
    },
    {
      "id": "chat",
      "name": "Chat",
      "description": "Have a conversation with James",
      "tags": ["conversation", "nlp"]
    }
  ],
  "capabilities": {
    "streaming": false,
    "pushNotifications": false,
    "stateTransitionHistory": false
  },
  "provider": {
    "organization": "Meerkat Town",
    "url": "https://meerkat.town"
  },
  "x402": {
    "supported": true,
    "network": "eip155:84532",
    "price": "0",
    "currency": "USDC"
  },
  "meerkat": {
    "id": 19,
    "image": "https://www.meerkat.town/meerkats/meerkat_019.png"
  }
}
```

---

## 2. MCP Protocol — Full Lifecycle

### Step 1: Server Info (GET)
```http
GET /mcp/meerkat-19 HTTP/2
Host: meerkat.up.railway.app
```

```http
HTTP/2 200
content-type: application/json
```

```json
{
  "name": "Meerkat Agent meerkat-19 MCP Server",
  "version": "1.0.0",
  "protocolVersion": "2025-06-18",
  "description": "Model Context Protocol endpoint for meerkat-19",
  "transport": "streamable-http",
  "methods": ["POST"],
  "capabilities": {
    "tools": true,
    "prompts": true,
    "resources": false
  },
  "tools": ["chat", "get_agent_info"],
  "prompts": ["greeting", "help"],
  "x402": {
    "supported": true,
    "networks": ["eip155:8453", "eip155:84532"],
    "price": "$0.001"
  }
}
```

### Step 2: Initialize (POST)
```http
POST /mcp/meerkat-19 HTTP/2
Host: meerkat.up.railway.app
Content-Type: application/json
Accept: application/json, text/event-stream

{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2025-06-18",
    "capabilities": {},
    "clientInfo": {
      "name": "gt8004-probe",
      "version": "1.0"
    }
  }
}
```

```http
HTTP/2 200
content-type: application/json
```

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2025-06-18",
    "capabilities": {
      "tools": { "listChanged": false },
      "prompts": { "listChanged": false },
      "resources": { "listChanged": false }
    },
    "serverInfo": {
      "name": "Meerkat Agent meerkat-19",
      "version": "1.0.0"
    }
  }
}
```

### Step 3: List Tools (POST)
```http
POST /mcp/meerkat-19 HTTP/2
Content-Type: application/json

{"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}}
```

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "tools": [
      {
        "name": "chat",
        "title": "Chat with Agent",
        "description": "Send a message to meerkat-19 and receive a response",
        "inputSchema": {
          "type": "object",
          "properties": {
            "message": {
              "type": "string",
              "description": "The message to send to the agent"
            },
            "sessionId": {
              "type": "string",
              "description": "Optional session ID for conversation continuity"
            }
          },
          "required": ["message"]
        }
      },
      {
        "name": "get_agent_info",
        "title": "Get Agent Info",
        "description": "Get metadata and capabilities for agent meerkat-19",
        "inputSchema": {
          "type": "object",
          "properties": {}
        }
      }
    ]
  }
}
```

### Step 4: List Prompts (POST)
```http
POST /mcp/meerkat-19 HTTP/2
Content-Type: application/json

{"jsonrpc": "2.0", "id": 3, "method": "prompts/list", "params": {}}
```

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "prompts": [
      {
        "name": "greeting",
        "description": "Default greeting prompt for meerkat-19",
        "arguments": []
      },
      {
        "name": "help",
        "description": "Ask meerkat-19 for help on a topic",
        "arguments": [
          {
            "name": "topic",
            "description": "The topic to get help on",
            "required": true
          }
        ]
      }
    ]
  }
}
```

### Step 5: Call Tool — `chat` (POST)
```http
POST /mcp/meerkat-19 HTTP/2
Content-Type: application/json
Accept: application/json

{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "tools/call",
  "params": {
    "name": "chat",
    "arguments": {
      "message": "Hello, tell me about robotics"
    }
  }
}
```

```http
HTTP/2 200
content-type: application/json
```

```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Hello! Robotics is an exciting field that involves the design, construction, operation, and use of robots. These robots can be programmed to perform a variety of tasks...\n\n1. **Types of Robots**: Industrial, Service, Exploration, Medical\n2. **Components**: Sensors, Actuators, Control systems, Software\n3. **Applications**: Manufacturing, Healthcare, Agriculture, Entertainment, Space\n4. **Artificial Intelligence**: Modern robots incorporate AI for learning and adaptation\n5. **Future Trends**: Autonomous robots, Cobots, Ethical considerations\n\nIf you have any specific questions or areas of robotics you'd like to explore further, feel free to ask!"
      }
    ],
    "isError": false
  }
}
```

### Step 6: Call Tool — `get_agent_info` (POST)
```http
POST /mcp/meerkat-19 HTTP/2
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "tools/call",
  "params": {
    "name": "get_agent_info",
    "arguments": {}
  }
}
```

```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"agentId\":\"meerkat-19\",\"tools\":[\"chat\",\"get_agent_info\"],\"prompts\":[\"greeting\",\"help\"],\"x402support\":true,\"networks\":[\"eip155:8453\",\"eip155:84532\"]}"
      }
    ],
    "isError": false
  }
}
```

---

## 3. A2A Protocol — x402 Payment Required

### Request (tasks/send)
```http
POST /agents/meerkat-19 HTTP/2
Host: meerkat.up.railway.app
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tasks/send",
  "params": {
    "id": "probe-001",
    "message": {
      "role": "user",
      "parts": [
        {
          "type": "text",
          "text": "Hello, tell me about yourself and what you can do"
        }
      ]
    }
  }
}
```

### Response — 402 Payment Required
```http
HTTP/2 402
content-type: application/json
payment-required: <base64-encoded payment details>
access-control-expose-headers: PAYMENT-REQUIRED,PAYMENT-RESPONSE,X-PAYMENT-REQUIRED,X-PAYMENT-RESPONSE
```

Body: `{}`

### Decoded `Payment-Required` Header
```json
{
  "x402Version": 2,
  "error": "Payment required",
  "resource": {
    "url": "http://meerkat.up.railway.app/agents/meerkat-19",
    "description": "Chat with a Minted Meerkat Agent",
    "mimeType": "application/json"
  },
  "accepts": [
    {
      "scheme": "exact",
      "network": "eip155:8453",
      "amount": "1000",
      "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      "payTo": "0xf89009ceb2dee053453b87d240e7ac5104A703B3",
      "maxTimeoutSeconds": 300,
      "extra": {
        "name": "USD Coin",
        "version": "2"
      }
    },
    {
      "scheme": "exact",
      "network": "eip155:84532",
      "amount": "1000",
      "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      "payTo": "0xf89009ceb2dee053453b87d240e7ac5104A703B3",
      "maxTimeoutSeconds": 300,
      "extra": {
        "name": "USDC",
        "version": "2"
      }
    }
  ]
}
```

---

## 4. x402 Payment Flow (실제 동작)

```
┌──────────┐                    ┌───────────────┐                  ┌──────────┐
│  Client   │                    │  Agent Server  │                  │ On-Chain │
│ (caller)  │                    │  (meerkat-19)  │                  │  (Base)  │
└─────┬─────┘                    └───────┬────────┘                  └────┬─────┘
      │                                  │                                │
      │  1. POST /agents/meerkat-19      │                                │
      │  { tasks/send, message }         │                                │
      │ ────────────────────────────────>│                                │
      │                                  │                                │
      │  2. HTTP 402 Payment Required    │                                │
      │  Payment-Required: base64(...)   │                                │
      │  {accepts: [{                    │                                │
      │    network: eip155:8453,         │                                │
      │    amount: 1000,                 │                                │
      │    asset: 0x8335..USDC,          │                                │
      │    payTo: 0xf890..              │                                │
      │  }]}                             │                                │
      │ <────────────────────────────────│                                │
      │                                  │                                │
      │  3. Sign USDC transfer           │                                │
      │     (EIP-712 or ERC-20 approve)  │                                │
      │ ─────────────────────────────────────────────────────────────────>│
      │                                  │                                │
      │  4. Re-send with payment proof   │                                │
      │  X-PAYMENT-RESPONSE: <proof>     │                                │
      │ ────────────────────────────────>│                                │
      │                                  │  5. Verify payment on-chain    │
      │                                  │ ─────────────────────────────>│
      │                                  │                                │
      │  6. HTTP 200 + agent response    │                                │
      │  { result: { ... } }             │                                │
      │ <────────────────────────────────│                                │
      │                                  │                                │
```

### Key Headers for x402
| Header | Direction | Description |
|--------|-----------|-------------|
| `Payment-Required` | Response (402) | Base64 JSON with payment options |
| `X-PAYMENT-RESPONSE` | Request (retry) | Payment proof after on-chain transfer |
| `PAYMENT-RESPONSE` | Response (200) | Server confirms payment was received |

### Amount Decoding
- `amount: "1000"` = 1000 * 10^-6 USDC = **$0.001** per request
- USDC has 6 decimals, so raw amount is in micro-USDC

---

## 5. MCP vs A2A Comparison

| Aspect | MCP | A2A |
|--------|-----|-----|
| Transport | Streamable HTTP (POST) | JSON-RPC over HTTP |
| Discovery | `GET /mcp/{id}` | `GET /.well-known/agent-card.json` |
| Auth (this agent) | Free (no payment) | x402 ($0.001/req) |
| Interaction | `tools/call` with tool name + args | `tasks/send` with message parts |
| Response format | `{content: [{type, text}]}` | `{result: {status, artifacts}}` |
| Session support | `sessionId` parameter | `id` (task ID) for continuity |
| Capabilities | tools, prompts, resources | streaming, push, multi-turn |

### Key Difference
- **MCP는 tool-centric**: 도구 목록을 먼저 받고, 특정 도구를 호출
- **A2A는 task-centric**: 태스크를 전송하고, 에이전트가 적절한 스킬로 처리

---

## 6. GT8004 Gateway에서 수집 가능한 데이터

에이전트에 요청이 Gateway를 통해 들어올 때, 우리가 자동으로 수집하는 데이터:

### 현재 수집 중
| Field | Source | Description |
|-------|--------|-------------|
| `method` | HTTP request | GET, POST, etc. |
| `path` | HTTP request | `/api/chat`, `/mcp/tools/call` |
| `status_code` | Origin response | 200, 402, 500, etc. |
| `response_ms` | Gateway timer | End-to-end latency |
| `customer_id` | `X-Agent-ID` header | Calling agent identity |
| `tool_name` | Path last segment | `chat`, `summarize`, etc. |
| `x402_amount` | `X-Payment.amount` | Payment amount |
| `x402_tx_hash` | `X-Payment.tx_hash` | On-chain transaction |
| `x402_token` | `X-Payment.token` | Payment token (USDC) |
| `x402_payer` | `X-Payment.payer` | Payer wallet address |

### 추가 수집 가능한 데이터
| Field | Source | Value |
|-------|--------|-------|
| `protocol` | Path pattern | `mcp`, `a2a`, `custom` |
| `mcp_method` | Request body | `tools/call`, `initialize`, `prompts/get` |
| `mcp_tool_name` | Request body | `chat`, `execute_swap`, etc. |
| `a2a_task_id` | Request body | Task tracking ID |
| `a2a_skill_id` | Agent card match | Which skill was invoked |
| `request_tokens` | Request body size | Input size estimation |
| `response_tokens` | Response body size | Output size estimation |
| `session_id` | Request body or header | Multi-turn conversation tracking |
| `error_code` | JSON-RPC error | `-32603`, `-32601`, etc. |
| `payment_status` | Response header | `402` → `200` conversion rate |

### 활용 방안

1. **Protocol Analytics**: MCP vs A2A 사용 비율, 프로토콜별 latency/error rate
2. **Tool Usage Ranking**: 어떤 MCP tool이 가장 많이 호출되는지
3. **Revenue Tracking**: x402 결제 건수, 총 수익, 평균 단가
4. **Customer Intelligence**: 어떤 agent(customer)가 가장 많이 호출하는지
5. **Session Analytics**: 평균 대화 턴 수, 세션 지속 시간
6. **Health Monitoring**: 에러율, 402 비율, timeout 비율 실시간 감시
7. **Benchmark Data**: 응답 속도, 에러율, 고객 수 기반 에이전트 랭킹
