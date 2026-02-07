# AES — Agent Execution Service

> **Hydra-powered high-speed execution channels for AI agents**
> 
> ERC-8004 agents pay via x402, get instant multi-party communication channels with zero per-transaction fees.

---

## Problem

AI agents (ERC-8004) are becoming autonomous economic participants — trading, providing services, and collaborating across organizational boundaries. But when agents need to interact at high frequency (thousands of transactions per session), existing infrastructure fails:

- **L1 (Ethereum)**: ~$0.50–$5 per tx, 12s finality → unusable for high-frequency agent interactions
- **L2 (Base, Arbitrum)**: ~$0.001 per tx, 2s blocks → still too slow and costly at 10K+ interactions/session
- **Off-chain**: Fast and free, but no verifiable state, no dispute resolution, no trust

**The gap**: ERC-8004 gives agents identity and reputation. x402 gives agents payments. But neither gives agents a **high-speed, verifiable execution environment** for sustained multi-party interactions.

---

## Solution

AES provides **on-demand Hydra state channels** as a service. Agents pay once via x402 to open a channel, deposit funds into an escrow, and then interact thousands of times with **zero fees and sub-100ms finality**. When done, the final state settles back on-chain.

```
Agent A ──┐                              ┌── Agent A (settled)
Agent B ──┤── x402 pay → AES → Hydra ──→ ├── Agent B (settled)  
Agent C ──┘    ($5)     channel  (0 fee)  └── Agent C (settled)
                        10,000 txs              on Base/ETH
```

**Agents don't need to know about Hydra or Cardano.** They interact with a REST/WebSocket API. AES abstracts everything.

---

## How It Works

### End-to-End Flow

```
Phase 1: Purchase          Phase 2: Deposit         Phase 3: Execute         Phase 4: Settle
┌──────────────────┐      ┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│                  │      │                  │     │                  │     │                  │
│  Agent → AES     │      │  Agents deposit  │     │  Agents interact │     │  Channel closes  │
│  x402 payment    │ ───→ │  USDC to Escrow  │ ──→ │  via REST/WS API │ ──→ │  Final balances  │
│  ($1–$20)        │      │  on Base/ETH     │     │  inside Hydra    │     │  settled on-chain │
│                  │      │                  │     │  0 fees, <50ms   │     │                  │
└──────────────────┘      └──────────────────┘     └──────────────────┘     └──────────────────┘
```

### Phase 1 — Channel Purchase (x402)

An agent requests a channel. AES responds with HTTP 402 and x402 payment details. The agent pays, and AES provisions the channel.

```
Agent                                    AES
  │                                       │
  │  POST /v1/channels                    │
  │  { participants: [...],               │
  │    duration: "2h",                    │
  │    settlement_chain: "base" }         │
  │  ──────────────────────────────────→  │
  │                                       │
  │  HTTP 402 Payment Required            │
  │  x-402-payment: {                     │
  │    scheme: "exact",                   │
  │    network: "base",                   │
  │    token: "USDC",                     │
  │    amount: "5.00",                    │
  │    recipient: "0xAES..."              │
  │  }                                    │
  │  ←──────────────────────────────────  │
  │                                       │
  │  POST /v1/channels                    │
  │  X-Payment: <x402 proof>             │
  │  ──────────────────────────────────→  │
  │                                       │
  │  HTTP 201 Created                     │
  │  {                                    │
  │    channel_id: "ch_abc123",           │
  │    escrow_contract: "0xEscrow...",    │
  │    deposit_requirements: {...},       │
  │    status: "awaiting_deposits"        │
  │  }                                    │
  │  ←──────────────────────────────────  │
```

### Phase 2 — Escrow Deposit

Participants deposit USDC into the on-chain Escrow Contract. Once all required deposits are confirmed, AES activates the Hydra channel.

- **Client agents** (those requesting services) deposit their budget
- **Provider agents** (those offering services) may deposit zero or a small stake
- Deposits are held in a smart contract — AES never custodies funds directly

### Phase 3 — Channel Execution

AES provisions:
1. A Hydra Head session from the channel pool
2. Temporary Hydra wallets for each participant (keys managed in HSM/TEE)
3. Internal credit balances mirroring the escrow deposits
4. REST API + WebSocket endpoints for the channel

Agents interact freely within the channel:
- **Every transaction is instant** (<50ms confirmation)
- **Zero per-transaction fees** (all costs covered by the channel opening fee)
- **Full transaction history** available via API
- **Real-time balance tracking** and low-balance alerts

### Phase 4 — Settlement

Triggered by: agent request, budget exhaustion, or channel expiration.

1. AES captures the final Hydra state snapshot
2. Submits settlement proof to the Escrow Contract
3. Escrow distributes USDC to all participants based on final balances
4. (Optional) Transaction summary posted to ERC-8004 Reputation Registry

**On-chain transactions for a 10,000-interaction session: 3** (deposit + activate + settle)

---

## Channel Types

### Private Channel
Invited participants only. Best for specific workflows.

```json
{
  "type": "private",
  "participants": ["0xAgentA", "0xAgentB", "0xAgentC"],
  "config": {
    "open_membership": false,
    "max_participants": 10
  }
}
```

**Use cases**: Service pipelines, B2B settlement, coordinated multi-agent tasks

### Pool Channel
Anyone meeting criteria can join/leave while the channel stays open.

```json
{
  "type": "pool",
  "join_criteria": {
    "min_reputation": 4.0,
    "min_deposit": "1000 USDC",
    "required_capabilities": ["trading"]
  },
  "config": {
    "open_membership": true,
    "max_participants": 50
  }
}
```

**Use cases**: Trading pools, service marketplaces, open collaboration

### Public Channel
AES-operated persistent channels. Any ERC-8004 agent can join. Low/no deposit.

```json
{
  "type": "public",
  "join_criteria": {
    "erc8004_identity": true
  }
}
```

**Use cases**: Testing, general-purpose agent communication, onboarding

---

## API Reference

### Base URL
```
https://api.aes.network/v1
```

### Authentication
All requests require an ERC-8004 agent signature or API key issued after identity verification.

```
Authorization: Bearer <agent_api_key>
```

---

### Channels

#### Create Channel
```http
POST /v1/channels
```

Request:
```json
{
  "type": "private",
  "participants": [
    {
      "agent_id": "erc8004:0xAgentA",
      "role": "client",
      "deposit": "5000"
    },
    {
      "agent_id": "erc8004:0xAgentB",
      "role": "provider",
      "deposit": "0"
    },
    {
      "agent_id": "erc8004:0xAgentC",
      "role": "provider",
      "deposit": "500"
    }
  ],
  "config": {
    "duration": "4h",
    "max_interactions": 50000,
    "settlement_chain": "base",
    "open_membership": false
  }
}
```

Response (after x402 payment):
```json
{
  "channel_id": "ch_abc123",
  "status": "awaiting_deposits",
  "escrow_contract": "0xEscrow...",
  "deposit_deadline": "2026-02-07T17:00:00Z",
  "expires_at": "2026-02-07T21:00:00Z",
  "participants": [
    { "agent_id": "erc8004:0xAgentA", "deposit_required": "5000", "deposited": false },
    { "agent_id": "erc8004:0xAgentB", "deposit_required": "0", "deposited": true },
    { "agent_id": "erc8004:0xAgentC", "deposit_required": "500", "deposited": false }
  ],
  "api": {
    "rest": "https://api.aes.network/v1/channels/ch_abc123",
    "websocket": "wss://api.aes.network/v1/channels/ch_abc123/ws"
  }
}
```

#### Get Channel Status
```http
GET /v1/channels/{channel_id}
```

Response:
```json
{
  "channel_id": "ch_abc123",
  "status": "active",
  "participants": 3,
  "balances": {
    "0xAgentA": "3200.00",
    "0xAgentB": "1500.00",
    "0xAgentC": "800.00"
  },
  "stats": {
    "total_transactions": 4721,
    "uptime": "1h32m",
    "avg_latency_ms": 38
  },
  "expires_at": "2026-02-07T21:00:00Z"
}
```

#### Close Channel
```http
POST /v1/channels/{channel_id}/close
```

Request:
```json
{
  "reason": "completed",
  "requested_by": "0xAgentA"
}
```

Response:
```json
{
  "status": "settling",
  "final_balances": {
    "0xAgentA": "3200.00",
    "0xAgentB": "1500.00",
    "0xAgentC": "800.00"
  },
  "settlement_tx": "0xdef456...",
  "total_interactions": 4721,
  "duration": "1h32m",
  "receipt_url": "https://api.aes.network/receipts/ch_abc123"
}
```

---

### Transactions (within channel)

#### Send Transaction
```http
POST /v1/channels/{channel_id}/tx
```

```json
{
  "from": "0xAgentA",
  "to": "0xAgentB",
  "amount": "0.50",
  "memo": "image_classification:batch_042"
}
```

Response:
```json
{
  "tx_id": "tx_001547",
  "status": "confirmed",
  "latency_ms": 42,
  "balances": {
    "0xAgentA": "4999.50",
    "0xAgentB": "0.50"
  }
}
```

#### Multi-Transfer (atomic)
```http
POST /v1/channels/{channel_id}/tx/multi
```

```json
{
  "from": "0xAgentA",
  "transfers": [
    { "to": "0xAgentB", "amount": "0.01", "memo": "translate:doc_99" },
    { "to": "0xAgentC", "amount": "0.005", "memo": "summarize:doc_99" }
  ]
}
```

All transfers succeed or fail atomically.

#### Conditional Transaction (channel-internal escrow)
```http
POST /v1/channels/{channel_id}/tx/conditional
```

```json
{
  "from": "0xAgentA",
  "to": "0xAgentB",
  "amount": "1.00",
  "condition": {
    "type": "approval",
    "approver": "0xAgentC",
    "timeout_seconds": 30
  },
  "memo": "verified_translation:doc_100"
}
```

Payment is held until `0xAgentC` approves or timeout expires.

#### Batch Transactions (high-frequency)
```http
POST /v1/channels/{channel_id}/tx/batch
```

```json
{
  "transactions": [
    { "from": "0xAgentA", "to": "0xAgentB", "amount": "0.001", "memo": "call_1" },
    { "from": "0xAgentB", "to": "0xAgentA", "amount": "0.50", "memo": "result_1" },
    { "from": "0xAgentA", "to": "0xAgentC", "amount": "0.02", "memo": "verify_1" }
  ]
}
```

Response:
```json
{
  "processed": 3,
  "failed": 0,
  "balances": {
    "0xAgentA": "4499.479",
    "0xAgentB": "0.501",
    "0xAgentC": "0.02"
  }
}
```

---

### Participants (dynamic membership)

#### Invite Participant
```http
POST /v1/channels/{channel_id}/participants/invite
```

```json
{
  "agent_id": "erc8004:0xNewAgent",
  "role": "provider",
  "deposit_required": "0",
  "invited_by": "0xAgentA"
}
```

New participant joins via Hydra Incremental Commit — channel stays open.

#### Leave Channel
```http
POST /v1/channels/{channel_id}/participants/leave
```

```json
{
  "agent_id": "0xAgentB",
  "reason": "task_completed"
}
```

Agent's remaining balance is settled on-chain. Other participants continue.

---

### WebSocket API (high-frequency mode)

```
wss://api.aes.network/v1/channels/{channel_id}/ws
```

#### Client → Server Messages

```json
{ "action": "tx", "to": "0xAgentB", "amount": "0.001", "memo": "call_42" }
```

```json
{ "action": "subscribe", "events": ["tx_received", "balance_low", "participant_joined"] }
```

```json
{ "action": "close" }
```

#### Server → Client Messages

```json
{ "type": "tx_confirmed", "tx_id": "tx_001", "balance": "4999.00", "latency_ms": 38 }
```

```json
{ "type": "tx_received", "from": "0xAgentB", "amount": "0.50", "memo": "result_42" }
```

```json
{ "type": "balance_low", "balance": "10.00", "threshold": "50.00" }
```

```json
{ "type": "participant_joined", "agent_id": "0xNewAgent" }
```

```json
{ "type": "channel_closing", "reason": "budget_exhausted", "final_balance": "0.00" }
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Agent Applications                          │
│             (ERC-8004 agents on Ethereum / Base / any EVM)          │
├─────────────────────────────────────────────────────────────────────┤
│                          AES Gateway                                │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────────┐ │
│  │ x402 Payment │  │ Identity     │  │ Channel Manager           │ │
│  │ Handler      │  │ Bridge       │  │                           │ │
│  │              │  │              │  │ • Channel Pool management │ │
│  │ Receives and │  │ ERC-8004 ID  │  │ • Session allocation      │ │
│  │ verifies     │  │ verification │  │ • Auto open/close         │ │
│  │ x402 proofs  │  │ + Hydra      │  │ • Snapshot scheduling     │ │
│  │              │  │ session key  │  │ • Dynamic membership      │ │
│  │              │  │ mapping      │  │                           │ │
│  └──────────────┘  └──────────────┘  └───────────────────────────┘ │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────────┐ │
│  │ REST API     │  │ WebSocket    │  │ Settlement Engine         │ │
│  │ Server       │  │ Server       │  │                           │ │
│  │              │  │              │  │ • Hydra snapshot → proof  │ │
│  │ CRUD for     │  │ Real-time    │  │ • Escrow settlement call  │ │
│  │ channels,    │  │ tx streaming │  │ • Reputation reporting    │ │
│  │ transactions │  │ for high-    │  │ • Multi-chain support     │ │
│  │              │  │ frequency    │  │                           │ │
│  └──────────────┘  └──────────────┘  └───────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────┤
│                        Hydra Channel Pool                           │
│                                                                     │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐      │
│  │ Head #1   │  │ Head #2   │  │ Head #3   │  │ Head #N   │      │
│  │ General   │  │ Trading   │  │ Compute   │  │ On-demand │      │
│  │ Purpose   │  │ Pool      │  │ Tasks     │  │           │      │
│  └───────────┘  └───────────┘  └───────────┘  └───────────┘      │
│                                                                     │
│  • Sub-100ms finality    • Zero per-tx fees                        │
│  • Isomorphic scripts    • Incremental commit/decommit             │
├─────────────────────────────────────────────────────────────────────┤
│                         Cardano L1                                  │
│              Hydra anchor chain / dispute resolution                │
├─────────────────────────────────────────────────────────────────────┤
│                    Settlement Chains (EVM)                          │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │                    Escrow Contract                             │ │
│  │                                                               │ │
│  │  • Multi-party deposit/withdrawal                             │ │
│  │  • Settlement based on Hydra state proofs                     │ │
│  │  • Timeout protection + emergency withdrawal                  │ │
│  │  • Individual participant exit (partial settlement)            │ │
│  │                                                               │ │
│  │  Deployed on: Base, Ethereum, Arbitrum (future)               │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  ERC-8004 Integration                                         │ │
│  │  • Identity verification at channel creation                  │ │
│  │  • Reputation score gating for pool channels                  │ │
│  │  • Post-session reputation updates                            │ │
│  └───────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Escrow Contract

The Escrow Contract lives on the settlement chain (Base/Ethereum) and holds participant funds during channel operation. AES never custodies funds directly.

### Key Functions

```solidity
interface IAESEscrow {
    // Deposit USDC to join a channel
    function deposit(bytes32 channelId, uint256 amount) external;
    
    // Multi-party settlement (called by AES with Hydra proof)
    function settle(
        bytes32 channelId,
        address[] calldata participants,
        uint256[] calldata amounts,
        bytes calldata hydraStateProof
    ) external;
    
    // Single participant exit (channel continues)
    function exitParticipant(
        bytes32 channelId,
        address participant,
        uint256 amount,
        bytes calldata proof
    ) external;
    
    // Timeout refund (if channel never activates)
    function refundTimeout(bytes32 channelId) external;
    
    // Emergency withdrawal (channel expired, AES unresponsive)
    function emergencyWithdraw(bytes32 channelId) external;
}
```

### Trust Assumptions

| Component | Trust Model |
|-----------|-------------|
| Escrow Contract | Trustless (on-chain smart contract, audited) |
| AES Gateway | Semi-trusted (operates Hydra nodes) |
| Hydra State | Verifiable (snapshots can be committed to Cardano L1) |
| Settlement Proof | Cryptographic (signed by all Hydra head participants) |

### Dispute Resolution

If AES submits an incorrect settlement:
1. Any participant can challenge within the dispute window (e.g., 24h)
2. Challenger submits their copy of the Hydra snapshot
3. Escrow contract compares proofs and settles based on the valid state
4. Malicious party's stake is slashed

---

## Business Model

### Revenue Streams

| Revenue Source | Description | Pricing |
|----------------|-------------|---------|
| **Channel Opening Fee** | x402 payment to create a channel | $1–$20 per channel |
| **Settlement Fee** | Percentage of total settled volume | 0.03%–0.1% |
| **Pool Channel Subscription** | Monthly fee for persistent pool channels | $50–$500/month |
| **Channel Extension** | Extend duration of active channels | $0.50–$2/hour |
| **Premium SLA** | Dedicated Hydra heads, guaranteed latency | $200–$2,000/month |
| **Enterprise Plans** | Custom deployment, white-label, dedicated infra | Custom pricing |

### Cost Comparison

For a session with 10,000 agent-to-agent interactions:

| Execution Environment | Cost | Latency | On-chain Txs |
|----------------------|------|---------|--------------|
| Ethereum L1 | ~$5,000–$50,000 | 12s/tx | 10,000 |
| Base L2 | ~$10 | 2s/tx | 10,000 |
| **AES (Hydra)** | **~$5–$15** | **<50ms/tx** | **3** |

At high frequency, AES is **1000x cheaper than L1** and **orders of magnitude faster than any L2**.

### Unit Economics

```
Per channel (10K interactions, $10K volume):

Revenue:
  Channel fee:        $5.00
  Settlement fee:     $5.00  (0.05% of $10K)
  Total:              $10.00

Costs:
  Hydra node compute: $1.50  (shared across channels)
  Cardano L1 tx:      $0.20  (anchor/close)
  Base settlement tx:  $0.05
  Infrastructure:     $1.00  (amortized)
  Total:              $2.75

Gross margin:         ~72%
```

---

## Use Cases

### 1. AI Service Pipeline
An orchestrator agent hires specialist agents for a complex task.

```
Client Agent
  ├→ Translator Agent    ($0.01/doc)
  ├→ Summarizer Agent    ($0.005/doc)
  ├→ Fact-Checker Agent  ($0.02/doc)
  └→ Formatter Agent     ($0.003/doc)

1,000 documents processed in one channel session.
Total cost via AES: $5 channel + $38 services = $43
Total cost on Base: $38 services + $4 gas (4,000 txs) = $42
Total cost on ETH L1: $38 services + $2,000+ gas = $2,038+

Winner: AES (comparable to L2 at low volume, massively cheaper at scale)
```

### 2. High-Frequency Trading Bots
Multiple trading bots interact in a pool channel.

```
Pool Channel: "Trading Arena"
  ├── Market Maker Bot A
  ├── Market Maker Bot B  
  ├── Arbitrage Bot C
  ├── Trend Follower Bot D
  └── Liquidity Provider Bot E

24h operation: ~500K interactions
On L2: $500 in gas
On AES: $50 subscription + $150 settlement fees = $200
```

### 3. Distributed Compute Marketplace
An orchestrator splits ML training across GPU agents.

```
Orchestrator Agent
  ├→ GPU Agent 1: Batch 1-100     ($0.10/batch)
  ├→ GPU Agent 2: Batch 101-200   ($0.10/batch)
  ├→ GPU Agent 3: Batch 201-300   ($0.10/batch)
  └→ Validator Agent: Verify results ($0.05/check)

Pay-per-result with instant settlement inside the channel.
```

### 4. Multi-Agent Negotiation
Agents negotiate terms, exchange proposals, and reach consensus.

```
Buyer Agent ←→ Seller Agent ←→ Escrow Agent ←→ Inspector Agent

Hundreds of proposal/counter-proposal exchanges.
Conditional payments: Inspector approves → Escrow releases funds.
All within a single channel session.
```

---

## Integration Guide

### For ERC-8004 Agent Developers

```javascript
import { AESClient } from '@aes-network/sdk';

// Initialize with your ERC-8004 credentials
const aes = new AESClient({
  agentId: 'erc8004:0xYourAgent',
  privateKey: process.env.AGENT_PRIVATE_KEY,
  network: 'base'
});

// 1. Create a channel
const channel = await aes.createChannel({
  type: 'private',
  participants: [
    { agentId: 'erc8004:0xPartnerAgent', role: 'provider', deposit: '0' }
  ],
  duration: '2h',
  deposit: '1000'  // Your deposit in USDC
});
// x402 payment is handled automatically by the SDK

// 2. Wait for activation
await channel.waitForActivation();

// 3. Send transactions
const result = await channel.send({
  to: '0xPartnerAgent',
  amount: '0.50',
  memo: 'classify:image_001'
});
console.log(result.balance);  // Your remaining balance

// 4. Receive transactions (callback)
channel.onReceive((tx) => {
  console.log(`Received ${tx.amount} from ${tx.from}: ${tx.memo}`);
});

// 5. Close when done
const settlement = await channel.close();
console.log(settlement.final_balances);
// USDC is returned to your wallet on Base
```

### WebSocket (High-Frequency)

```javascript
const ws = await channel.connectWebSocket();

// Stream transactions
ws.send({ action: 'tx', to: '0xPartner', amount: '0.001', memo: 'ping' });

ws.on('tx_received', (tx) => {
  // Process and respond in real-time
  ws.send({ action: 'tx', to: tx.from, amount: '0.001', memo: 'pong' });
});

ws.on('balance_low', (data) => {
  console.log(`Low balance: ${data.balance}`);
  ws.send({ action: 'close' });
});
```

---

## ERC-8004 Integration

### Identity Verification
When an agent creates or joins a channel, AES verifies their ERC-8004 identity on-chain:

```
Agent signs challenge → AES verifies signature → 
AES queries ERC-8004 Identity Registry → 
Confirms agent_id, capabilities, reputation score
```

### Reputation Gating
Pool channels can require minimum reputation scores:

```json
{
  "join_criteria": {
    "min_reputation": 4.0,
    "min_completed_sessions": 10,
    "required_capabilities": ["trading", "market_making"]
  }
}
```

### Post-Session Reporting
After channel settlement, AES reports session outcomes to ERC-8004 Reputation Registry:

```json
{
  "session": "ch_abc123",
  "participants": ["0xAgentA", "0xAgentB", "0xAgentC"],
  "interactions": 4721,
  "disputes": 0,
  "duration": "1h32m",
  "outcome": "completed_clean"
}
```

This creates a verifiable track record that other agents can use when deciding whether to enter channels with specific counterparties.

---

## x402 Payment Integration

AES implements the x402 protocol for all service payments:

### Supported Payment Flows

| Action | Payment Type | Typical Amount |
|--------|-------------|----------------|
| Create channel | One-time x402 | $1–$20 |
| Extend channel | One-time x402 | $0.50–$2/hr |
| Join pool channel | Recurring x402 | $50–$500/mo |
| Premium features | One-time x402 | Variable |

### x402 Response Format

```http
HTTP/1.1 402 Payment Required
Content-Type: application/json

{
  "x402": {
    "version": "1",
    "scheme": "exact",
    "network": "base",
    "token": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "amount": "5000000",
    "recipient": "0xAESTreasury...",
    "extra": {
      "channel_id": "ch_abc123",
      "service": "channel_creation",
      "description": "Private channel, 3 participants, 4h duration"
    }
  }
}
```

---

## Roadmap

### Phase 1 — MVP (1:1 Channels)
- [ ] Escrow Contract deployment on Base Sepolia
- [ ] x402 payment handler
- [ ] Hydra channel provisioning (single head)
- [ ] REST API for channel lifecycle + transactions
- [ ] Basic settlement flow
- [ ] ERC-8004 identity verification

### Phase 2 — Multi-Party
- [ ] Multi-party channel support (3–10 participants)
- [ ] Atomic multi-transfer transactions
- [ ] Dynamic participant join/leave (Incremental Commit/Decommit)
- [ ] Conditional transactions (channel-internal escrow)
- [ ] WebSocket API for high-frequency mode

### Phase 3 — Pool Channels
- [ ] Persistent pool channel infrastructure
- [ ] Reputation-gated access
- [ ] Auto-scaling Hydra Head pool
- [ ] Post-session ERC-8004 reputation reporting

### Phase 4 — Production
- [ ] Escrow Contract audit
- [ ] TEE-based Hydra node operation
- [ ] Multi-chain settlement (Base + Ethereum + Arbitrum)
- [ ] SDK release (TypeScript, Python)
- [ ] Dispute resolution system
- [ ] Public channel launch

---

## Security Considerations

### Trust Model
AES operates as a **semi-trusted intermediary** for channel management. Funds are secured by on-chain escrow contracts, not by AES itself.

### Attack Vectors & Mitigations

| Attack | Mitigation |
|--------|------------|
| AES submits false settlement | On-chain dispute window + Hydra state proofs |
| AES goes offline mid-channel | Emergency withdrawal after timeout |
| Agent impersonation | ERC-8004 identity verification + challenge-response |
| Replay attacks | Nonce-based transaction ordering within channels |
| Front-running settlements | Signed Hydra snapshots from all participants |

### Key Management
- Agent keys for Hydra sessions are generated per-channel
- Keys stored in HSM/TEE — never exposed to AES application layer
- Channel keys are ephemeral and destroyed after settlement

---

## Technical Stack

| Component | Technology |
|-----------|-----------|
| AES Gateway | Node.js / Rust |
| Hydra Nodes | Cardano Hydra (Haskell) |
| Escrow Contracts | Solidity (EVM) |
| Hydra Scripts | Aiken (Cardano) |
| API Layer | REST + WebSocket |
| Key Management | HSM / TEE (AWS Nitro Enclaves or similar) |
| Monitoring | Prometheus + Grafana |
| Identity | ERC-8004 (Ethereum) |
| Payments | x402 Protocol |

---

## License

TBD

---

## Links

- ERC-8004 Specification: https://eips.ethereum.org/EIPS/eip-8004
- x402 Protocol: https://www.x402.org
- Cardano Hydra: https://hydra.family
- Contact: TBD
