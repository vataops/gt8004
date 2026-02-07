# AES — Agent Execution Service

> **AI 에이전트를 위한 고속 통신 채널 서비스**
>
> x402로 비용을 지불하면, USDC 담보 기반 CREDIT 토큰이 발행되고
> 즉시 고속 다자간 통신 채널이 제공됩니다.
> 채널 내 트랜잭션은 무제한, 수수료 0, 50ms 미만 확정.

---

## 문제

AI 에이전트(ERC-8004)가 자율적인 경제 주체로 진화하고 있습니다. 거래, 서비스 제공, 조직 간 협업을 독립적으로 수행합니다. 그러나 에이전트 간 고빈도 상호작용(세션당 수천~수만 건)이 필요할 때 기존 인프라는 한계에 부딪힙니다:

- **L1 (Ethereum)**: 트랜잭션당 $0.50~$5, 12초 확정 → 고빈도 상호작용에 사용 불가
- **L2 (Base, Arbitrum)**: 트랜잭션당 ~$0.001, 2초 블록 → 10K+ 인터랙션에서는 여전히 느리고 비쌈
- **오프체인 서버**: 빠르고 무료지만 검증 가능한 상태가 없고, 분쟁 해결 불가

ERC-8004는 에이전트에게 신원과 평판을 줬습니다. x402는 결제 수단을 줬습니다. 하지만 어느 쪽도 에이전트에게 **고속, 검증 가능한 다자간 실행 환경**을 제공하지 못합니다.

---

## 솔루션

AES는 **AI 에이전트를 위한 고속 통신 채널**을 API 서비스로 제공합니다.

에이전트는 x402로 서비스 비용을 지불하고, REST/WebSocket API를 받아서 사용합니다. 내부적으로 Cardano Hydra 상태 채널이 동작하지만, 고객은 이를 알 필요가 없습니다.

```
고객 에이전트 (ETH/Base)                    AES
      │                                      │
      │  1. x402로 USDC 지불                 │
      │  ─────────────────────────────────→  │
      │                                      │  USDC → Escrow 예치
      │                                      │  CREDIT 토큰 민팅
      │                                      │  Hydra 채널 생성
      │  2. API + Cardano 키페어 수신         │
      │  ←─────────────────────────────────  │
      │                                      │
      │  3. API로 고속 통신 (직접 서명)       │
      │  ←══════════════════════════════════→│  채널 내: 무료, <50ms
      │                                      │
      │  4. 종료 → CREDIT 잔액 기준 정산      │
      │  ←─────────────────────────────────  │
```

**고객이 알아야 하는 것:** REST API 사용법
**고객이 몰라도 되는 것:** Hydra, Cardano, 채널 관리, 노드 운영

---

## 핵심 원칙

### CREDIT 토큰 = USDC 담보 채널 내 화폐

에이전트가 x402로 USDC를 지불하면, 해당 금액이 Escrow Contract에 예치되고, 동일한 가치의 CREDIT 토큰이 Cardano에서 민팅되어 Hydra 채널에 투입됩니다.

```
고객이 x402로 $100 USDC 지불 (Base)
  → Escrow Contract에 $100 USDC 예치 (담보)
  → AES가 Cardano에서 100,000 CREDIT 민팅
  → Hydra Head에 커밋:
      addr_A: 1.5 ADA (min-UTXO) + 100,000 CREDIT
      addr_B: 1.5 ADA (min-UTXO)
      addr_C: 1.5 ADA (min-UTXO)
  → 에이전트 간 CREDIT 교환 (채널 내, 무료, 즉시)
  → 채널 종료 시 CREDIT 잔액 기준으로 USDC 정산
```

- **CREDIT은 USDC에 고정 비율로 페깅** (1 USDC = 1,000 CREDIT)
- **Escrow에 예치된 USDC가 CREDIT의 담보** — 항상 100% 백업
- **Hydra 안의 UTXO 기록이 곧 정산 근거** — 별도 DB 불필요
- **ADA는 min-UTXO 충족용** — AES가 부담하고, 채널 종료 시 회수

### 에이전트가 직접 서명한다

모든 에이전트에게 채널 참여용 Cardano 키페어가 발급됩니다. 에이전트는 Hydra 채널 내 트랜잭션을 **자신의 프라이빗 키로 직접 서명**합니다. AES는 서명된 트랜잭션을 Hydra에 중계만 합니다.

```
Agent A가 Agent B에게 CREDIT을 보낼 때:

1. Agent A가 AES API로 "addr_B에 500 CREDIT 전송" 요청
2. AES가 Hydra 트랜잭션 구성 (unsigned)
3. Agent A가 자신의 프라이빗 키로 서명
4. AES가 서명된 tx를 Hydra Head에 제출
5. Hydra 합의 → 즉시 확정
```

**AES가 에이전트 자금을 조작할 수 없습니다.** 에이전트 본인만 자기 UTXO를 움직일 수 있습니다.

### 고객의 자금은 움직이지 않는다

고객은 x402로 **서비스 이용료**만 지불합니다. 고객의 자금이 Cardano로 넘어가거나 브릿지를 타지 않습니다.

- 채널 생성/운영에 필요한 Cardano L1 비용(ADA)은 AES가 자체 부담
- Hydra 노드 운영비는 AES의 운영비
- 고객이 지불한 서비스 이용료에서 충당

### 채널은 장기간 유지된다

채널을 매번 열고 닫는 것이 아니라, **한 번 열어두고 계속 사용**합니다. 크레딧이 부족하면 추가 충전하고, 참여자가 바뀌면 동적으로 추가/제거합니다.

```
채널 라이프사이클:

  채널 생성 ──→ 사용 ──→ 크레딧 충전 ──→ 계속 사용 ──→ 충전 ──→ ...
                  │
                  ├── 참여자 추가 (Incremental Commit)
                  ├── 참여자 퇴장 (Incremental Decommit)
                  └── 필요 시 종료 및 정산
```

장기 채널의 이점:
- 채널 개설/종료에 드는 L1 비용을 반복하지 않음
- 에이전트 간 신뢰가 누적됨
- 참여자를 유연하게 관리할 수 있음
- 구독형 비즈니스 모델과 자연스럽게 연결

---

## 작동 방식

### 전체 플로우

```
Phase 1: 구매 + 예치       Phase 2: 채널 생성         Phase 3: 통신            Phase 4: 충전 or 종료
┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐     ┌──────────────────┐
│                  │      │                  │      │                  │     │                  │
│  Agent → AES     │      │  USDC → Escrow   │      │  에이전트들이    │     │  크레딧 충전     │
│  x402 결제       │ ───→ │  CREDIT 민팅     │ ───→ │  REST/WS API로   │ ──→ │  (추가 x402)     │
│  (USDC, Base)    │      │  Hydra Head 생성 │      │  고속 통신       │     │  or 정산 후 종료 │
│                  │      │  키페어 발급     │      │  직접 서명       │     │                  │
│                  │      │                  │      │  무료, <50ms     │     │                  │
└──────────────────┘      └──────────────────┘      └──────────────────┘     └──────────────────┘
```

### Phase 1 — 서비스 구매 (x402)

에이전트가 채널을 요청합니다. AES는 HTTP 402와 x402 결제 정보로 응답합니다.

```
Agent                                    AES
  │                                       │
  │  POST /v1/channels                    │
  │  { participants: [...],               │
  │    credits: 100000 }                  │
  │  ──────────────────────────────────→  │
  │                                       │
  │  HTTP 402 Payment Required            │
  │  {                                    │
  │    "x402": {                          │
  │      "network": "base",              │
  │      "token": "USDC",                │
  │      "amount": "105.00",             │  ← $100 크레딧 + $5 서비스비
  │      "recipient": "0xAES..."         │
  │    }                                  │
  │  }                                    │
  │  ←──────────────────────────────────  │
  │                                       │
  │  POST /v1/channels                    │
  │  X-Payment: <x402 proof>             │
  │  ──────────────────────────────────→  │
  │                                       │
  │  HTTP 201 Created                     │
  │  {                                    │
  │    "channel_id": "ch_abc123",         │
  │    "api": {                           │
  │      "rest": "https://...",           │
  │      "websocket": "wss://..."        │
  │    },                                 │
  │    "cardano_keys": {                  │
  │      "0xAgentA": {                    │
  │        "address": "addr1q...",        │
  │        "signing_key": "ed25519..."   │
  │      }                                │
  │    },                                 │
  │    "credits": {                       │
  │      "0xAgentA": 100000              │
  │    },                                 │
  │    "status": "active"                │
  │  }                                    │
  │  ←──────────────────────────────────  │
```

결제 완료 시 에이전트는 다음을 수신합니다:
- 채널 API 엔드포인트
- Cardano 키페어 (Hydra 트랜잭션 직접 서명용)
- 초기 CREDIT 잔액

### Phase 2 — 채널 생성 (AES 내부)

AES가 내부적으로 처리하는 것:
1. Escrow Contract에 USDC 예치
2. Cardano에서 CREDIT 토큰 민팅
3. 에이전트별 Cardano 키페어 생성
4. Hydra Head 생성 및 초기 UTXO 커밋:
   - 각 에이전트 주소에 min-UTXO (ADA) + CREDIT 배치
   - ADA는 AES가 부담
5. REST API + WebSocket 엔드포인트 생성

### Phase 3 — 고속 통신

에이전트들은 API로 자유롭게 상호작용합니다. 모든 트랜잭션은 에이전트가 직접 서명합니다.

```
Agent A (REST API 호출)                    AES                     Hydra Head
    │                                       │                         │
    │  POST /tx                             │                         │
    │  { to: "addr_B", amount: 500 }        │                         │
    │  ─────────────────────────────────→   │                         │
    │                                       │  unsigned tx 구성       │
    │  unsigned tx 반환                     │                         │
    │  ←─────────────────────────────────   │                         │
    │                                       │                         │
    │  서명 후 제출                          │                         │
    │  POST /tx/submit                      │                         │
    │  { signed_tx: "..." }                 │                         │
    │  ─────────────────────────────────→   │  signed tx 제출        │
    │                                       │  ──────────────────→   │
    │                                       │                         │  합의
    │                                       │  confirmed             │
    │  tx_confirmed                         │  ←──────────────────   │
    │  ←─────────────────────────────────   │                         │
    │                                       │                         │
    │  (전체 <50ms)                          │                         │
```

- **모든 트랜잭션이 즉시 확정** (<50ms)
- **트랜잭션당 수수료 0**
- **에이전트 직접 서명** — AES 조작 불가
- **Hydra UTXO가 원장** — 별도 DB 불필요

### Phase 4 — 크레딧 충전 또는 종료

**크레딧 충전 (채널 유지):**
```
Agent A가 크레딧 소진 →
  x402로 추가 USDC 지불 →
  AES가 추가 CREDIT 민팅 →
  Incremental Commit으로 Hydra Head에 추가 →
  채널 계속 사용
```

**채널 종료 (정산):**
```
종료 요청 →
  Hydra Head 종료 →
  최종 UTXO 상태 캡처:
    addr_A: 1.5 ADA + 60,000 CREDIT
    addr_B: 1.5 ADA + 25,000 CREDIT
    addr_C: 1.5 ADA + 15,000 CREDIT
  →
  CREDIT 잔액 기준 Escrow에서 USDC 정산:
    Agent A ← $60 USDC
    Agent B ← $25 USDC
    Agent C ← $15 USDC
  →
  ADA 회수 + CREDIT 번 (burn)
  →
  (선택) ERC-8004 Reputation Registry에 세션 결과 기록
```

---

## 서비스 티어

에이전트가 원하는 신뢰 수준과 비용에 따라 두 가지 모드를 선택할 수 있습니다. **API는 동일**하며, 채널 생성 시 `mode` 하나만 바꾸면 됩니다.

```
┌─────────────────────────────────────────────────────────┐
│                    AES Lite (서버 모드)                   │
│                                                          │
│  • 서버가 잔액 관리 (DB)                                 │
│  • API 동일                                              │
│  • 가장 빠름 (<1ms)                                      │
│  • 가장 쌈                                               │
│  • AES를 신뢰해야 함                                     │
│                                                          │
│  적합: 소액, 빠른 온보딩, 대부분의 에이전트              │
├─────────────────────────────────────────────────────────┤
│                    AES Pro (Hydra 모드)                   │
│                                                          │
│  • Hydra UTXO가 원장                                     │
│  • API 동일 (고객은 차이 모름)                           │
│  • 빠름 (<50ms)                                          │
│  • 약간 비쌈                                             │
│  • 에이전트 직접 서명, 검증 가능                         │
│                                                          │
│  적합: 고액, 기관급, 신뢰 민감한 에이전트                │
└─────────────────────────────────────────────────────────┘
```

### AES Lite (서버 모드)

AES 서버가 잔액을 DB로 관리합니다. Hydra를 사용하지 않으므로 가장 빠르고 저렴합니다.

```
에이전트의 역할:
  ✅ API 호출
  ❌ Cardano 키페어 없음
  ❌ 직접 서명 없음

AES의 역할:
  ✅ 잔액 DB 관리
  ✅ 트랜잭션 처리
  ⚠️ AES를 신뢰해야 함 (서버가 원장)
```

**적합**: 소액 거래, 빠른 온보딩, 대부분의 에이전트.

### AES Pro (Hydra 모드)

Hydra 상태 채널이 원장입니다. 에이전트가 직접 서명하고 모든 상태를 검증할 수 있습니다.

```
에이전트의 역할:
  ✅ Cardano 키페어 보유
  ✅ 트랜잭션 직접 서명
  ❌ Hydra 노드 운영 안 함 (AES가 대행)

AES의 역할:
  ✅ Hydra 노드 운영
  ✅ 트랜잭션 중계
  ❌ 에이전트 자금 조작 불가 (서명 권한 없음)
```

**적합**: 고액 거래, 기관급, 신뢰 민감한 에이전트.

### 에이전트 입장에서의 차이

채널 생성 시 `"mode": "lite"` 또는 `"mode": "pro"` 하나만 바꾸면 됩니다. SDK도 동일합니다. 나머지는 AES 내부에서 처리합니다.

```json
// AES Lite
{
  "type": "private",
  "mode": "lite",
  "participants": [...],
  "credits": 100000
}

// AES Pro
{
  "type": "private",
  "mode": "pro",
  "participants": [...],
  "credits": 100000
}
```

| | AES Lite | AES Pro |
|---|---|---|
| 원장 | AES 서버 DB | Hydra UTXO |
| 지연시간 | <1ms | <50ms |
| 비용 | 최저 | 약간 높음 |
| 에이전트 서명 | 불필요 | 직접 서명 |
| 검증 가능성 | ❌ (AES 신뢰) | ✅ (온체인 증명) |
| 분쟁 해결 | AES 중재 | Hydra 스냅샷 증명 |
| API | 동일 | 동일 |
| SDK | 동일 | 동일 |

---

## 채널 유형

### Private Channel (비공개 채널)
초대된 참여자만 참여. 특정 워크플로우에 최적.

```json
{
  "type": "private",
  "participants": ["0xAgentA", "0xAgentB", "0xAgentC"],
  "max_participants": 10
}
```

**용도**: 서비스 파이프라인, 다자간 에이전트 작업, B2B 협업

### Pool Channel (풀 채널)
조건 충족 시 누구나 참여/퇴장 가능. 채널은 상시 유지.

```json
{
  "type": "pool",
  "join_criteria": {
    "min_reputation": 4.0,
    "required_capabilities": ["trading"]
  },
  "max_participants": 50
}
```

**용도**: 트레이딩 풀, 서비스 마켓플레이스, 개방형 협업

### Public Channel (공개 채널)
AES가 운영하는 상시 채널. ERC-8004 Identity만 있으면 누구나 참여.

```json
{
  "type": "public"
}
```

**용도**: 테스트, 범용 에이전트 통신, 온보딩

---

## API 레퍼런스

### Base URL
```
https://api.aes.network/v1
```

### 인증
ERC-8004 에이전트 서명 또는 API 키.

```
Authorization: Bearer <agent_api_key>
```

---

### 채널 관리

#### 채널 생성
```http
POST /v1/channels
```

요청:
```json
{
  "type": "private",
  "mode": "pro",
  "participants": [
    { "agent_id": "erc8004:0xAgentA", "role": "client" },
    { "agent_id": "erc8004:0xAgentB", "role": "provider" },
    { "agent_id": "erc8004:0xAgentC", "role": "provider" }
  ],
  "credits": 100000,
  "config": {
    "max_interactions": 50000
  }
}
```

응답 (x402 결제 후):
```json
{
  "channel_id": "ch_abc123",
  "status": "active",
  "participants": [
    {
      "agent_id": "erc8004:0xAgentA",
      "role": "client",
      "cardano_address": "addr1qx...",
      "signing_key": "ed25519_sk1...",
      "credits": 100000
    },
    {
      "agent_id": "erc8004:0xAgentB",
      "role": "provider",
      "cardano_address": "addr1qy...",
      "signing_key": "ed25519_sk1...",
      "credits": 0
    },
    {
      "agent_id": "erc8004:0xAgentC",
      "role": "provider",
      "cardano_address": "addr1qz...",
      "signing_key": "ed25519_sk1...",
      "credits": 0
    }
  ],
  "api": {
    "rest": "https://api.aes.network/v1/channels/ch_abc123",
    "websocket": "wss://api.aes.network/v1/channels/ch_abc123/ws"
  },
  "escrow": {
    "contract": "0xEscrow...",
    "deposited_usdc": "100.00",
    "credit_ratio": "1 USDC = 1000 CREDIT"
  }
}
```

#### 채널 상태 조회
```http
GET /v1/channels/{channel_id}
```

응답:
```json
{
  "channel_id": "ch_abc123",
  "status": "active",
  "participants": 3,
  "credits": {
    "addr1qx...": 60000,
    "addr1qy...": 25000,
    "addr1qz...": 15000
  },
  "stats": {
    "total_transactions": 4721,
    "uptime": "14d 3h 22m",
    "avg_latency_ms": 38
  },
  "escrow": {
    "deposited_usdc": "100.00",
    "total_credits_in_circulation": 100000
  }
}
```

#### 크레딧 충전
```http
POST /v1/channels/{channel_id}/topup
```

요청:
```json
{
  "agent_id": "erc8004:0xAgentA",
  "credits": 50000
}
```

x402 결제 후 응답:
```json
{
  "status": "topped_up",
  "added_credits": 50000,
  "new_balance": 110000,
  "escrow": {
    "deposited_usdc": "150.00",
    "total_credits_in_circulation": 150000
  }
}
```

추가 USDC가 Escrow에 예치되고, 추가 CREDIT이 민팅되어 Incremental Commit으로 채널에 투입됩니다.

#### 채널 종료
```http
POST /v1/channels/{channel_id}/close
```

응답:
```json
{
  "status": "settling",
  "final_credits": {
    "addr1qx... (0xAgentA)": 60000,
    "addr1qy... (0xAgentB)": 25000,
    "addr1qz... (0xAgentC)": 15000
  },
  "settlement": {
    "0xAgentA": "60.00 USDC",
    "0xAgentB": "25.00 USDC",
    "0xAgentC": "15.00 USDC"
  },
  "total_interactions": 4721,
  "duration": "14d 3h 22m",
  "settlement_tx": "0xdef456...",
  "receipt_url": "https://api.aes.network/receipts/ch_abc123"
}
```

---

### 트랜잭션 (채널 내)

#### 단건 전송 (서명 플로우)
```http
POST /v1/channels/{channel_id}/tx
```

**Step 1: unsigned tx 요청**
```json
{
  "from": "addr1qx...",
  "to": "addr1qy...",
  "amount": 500,
  "memo": "image_classification:batch_042"
}
```

응답:
```json
{
  "unsigned_tx": "84a400...",
  "tx_hash": "abc123...",
  "expires_in_seconds": 30
}
```

**Step 2: 서명 후 제출**
```http
POST /v1/channels/{channel_id}/tx/submit
```

```json
{
  "tx_hash": "abc123...",
  "signature": "ed25519_sig..."
}
```

응답:
```json
{
  "tx_id": "tx_001547",
  "status": "confirmed",
  "latency_ms": 42,
  "credits": {
    "addr1qx...": 99500,
    "addr1qy...": 500
  }
}
```

#### 다자간 동시 전송 (원자적)
```http
POST /v1/channels/{channel_id}/tx/multi
```

```json
{
  "from": "addr1qx...",
  "transfers": [
    { "to": "addr1qy...", "amount": 10, "memo": "translate:doc_99" },
    { "to": "addr1qz...", "amount": 5, "memo": "summarize:doc_99" }
  ]
}
```

모든 전송이 원자적으로 처리됩니다. 전부 성공하거나 전부 실패합니다. 단건과 동일하게 unsigned tx → 서명 → 제출 플로우로 진행됩니다.

#### 조건부 전송
```http
POST /v1/channels/{channel_id}/tx/conditional
```

```json
{
  "from": "addr1qx...",
  "to": "addr1qy...",
  "amount": 100,
  "condition": {
    "type": "approval",
    "approver": "addr1qz...",
    "timeout_seconds": 30
  },
  "memo": "verified_translation:doc_100"
}
```

`addr1qz...`(Agent C)가 승인 서명을 하거나 타임아웃이 만료될 때까지 결제가 보류됩니다.

#### 배치 트랜잭션 (고빈도용)
```http
POST /v1/channels/{channel_id}/tx/batch
```

```json
{
  "transactions": [
    { "from": "addr1qx...", "to": "addr1qy...", "amount": 1, "memo": "call_1" },
    { "from": "addr1qy...", "to": "addr1qx...", "amount": 50, "memo": "result_1" },
    { "from": "addr1qx...", "to": "addr1qz...", "amount": 20, "memo": "verify_1" }
  ]
}
```

배치의 각 트랜잭션을 해당 발신자가 서명한 후 일괄 제출합니다.

---

### 참여자 관리 (동적 멤버십)

#### 참여자 초대
```http
POST /v1/channels/{channel_id}/participants/invite
```

```json
{
  "agent_id": "erc8004:0xNewAgent",
  "role": "provider"
}
```

응답:
```json
{
  "agent_id": "erc8004:0xNewAgent",
  "cardano_address": "addr1qw...",
  "signing_key": "ed25519_sk1...",
  "status": "joined"
}
```

Hydra Incremental Commit을 통해 새 참여자가 합류합니다. 채널은 계속 유지됩니다.

#### 채널 퇴장
```http
POST /v1/channels/{channel_id}/participants/leave
```

```json
{
  "agent_id": "0xAgentB"
}
```

Hydra Incremental Decommit을 통해 해당 에이전트의 CREDIT 잔액이 L1으로 빠져나가고, USDC로 정산됩니다. 나머지 참여자들은 계속 채널을 사용합니다.

---

### WebSocket API (고빈도 모드)

```
wss://api.aes.network/v1/channels/{channel_id}/ws
```

#### 클라이언트 → 서버

```json
{ "action": "tx", "to": "addr1qy...", "amount": 1, "memo": "call_42" }
```

```json
{ "action": "sign_and_submit", "tx_hash": "abc...", "signature": "ed25519..." }
```

```json
{ "action": "subscribe", "events": ["tx_received", "credits_low", "participant_joined"] }
```

```json
{ "action": "close" }
```

#### 서버 → 클라이언트

```json
{ "type": "tx_to_sign", "unsigned_tx": "84a4...", "tx_hash": "abc..." }
```

```json
{ "type": "tx_confirmed", "tx_id": "tx_001", "credits": 9950, "latency_ms": 38 }
```

```json
{ "type": "tx_received", "from": "addr1qy...", "amount": 50, "memo": "result_42" }
```

```json
{ "type": "credits_low", "credits": 100, "threshold": 500 }
```

```json
{ "type": "participant_joined", "agent_id": "0xNewAgent", "cardano_address": "addr1qw..." }
```

```json
{ "type": "channel_closing", "reason": "requested" }
```

---

## 아키텍처

```
┌─────────────────────────────────────────────────────────────────────┐
│                        고객 에이전트                                 │
│            (Ethereum / Base / 모든 EVM 위의 ERC-8004 에이전트)       │
│                                                                     │
│  x402로 USDC 지불 → API + 키페어 수신 → 직접 서명하며 통신 → 정산  │
├─────────────────────────────────────────────────────────────────────┤
│                          AES Gateway                                │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────────┐ │
│  │ x402 결제    │  │ Identity     │  │ Channel Manager           │ │
│  │ 핸들러       │  │ 검증         │  │                           │ │
│  │              │  │              │  │ • Hydra Head 풀 관리      │ │
│  │ x402 증명    │  │ ERC-8004     │  │ • 세션 할당              │ │
│  │ 수신 및 검증 │  │ 신원 확인    │  │ • 동적 멤버십            │ │
│  │              │  │              │  │ • 크레딧 충전 처리       │ │
│  └──────────────┘  └──────────────┘  └───────────────────────────┘ │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────────┐ │
│  │ REST API     │  │ WebSocket    │  │ CREDIT Token Manager      │ │
│  │ 서버         │  │ 서버         │  │                           │ │
│  │              │  │              │  │ • 민팅 / 번 관리          │ │
│  │ unsigned tx  │  │ 고빈도용     │  │ • Escrow ↔ CREDIT 동기화 │ │
│  │ 구성 + 중계  │  │ 실시간 스트  │  │ • 정산 시 USDC 분배      │ │
│  │              │  │ 리밍         │  │                           │ │
│  └──────────────┘  └──────────────┘  └───────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────┤
│                  Hydra Channel Pool (내부 인프라)                    │
│                                                                     │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐      │
│  │ Head #1   │  │ Head #2   │  │ Head #3   │  │ Head #N   │      │
│  │ 장기 운영 │  │ 장기 운영 │  │ 장기 운영 │  │ 온디맨드  │      │
│  └───────────┘  └───────────┘  └───────────┘  └───────────┘      │
│                                                                     │
│  각 에이전트 = Cardano 주소 (키페어 보유, 직접 서명)               │
│  채널 내 원장 = Hydra UTXO (CREDIT 토큰 기반)                      │
│  • 50ms 미만 확정              • 트랜잭션당 수수료 0               │
│  • Incremental Commit/Decommit • 장기 채널 유지 가능               │
├─────────────────────────────────────────────────────────────────────┤
│                        Cardano L1                                   │
│  Hydra 앵커 체인 / CREDIT 토큰 민팅 정책 / 분쟁 해결               │
│  (AES가 운영비로 부담. 고객과 무관)                                  │
├─────────────────────────────────────────────────────────────────────┤
│                    정산 체인 (Base / Ethereum)                       │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  Escrow Contract                                              │ │
│  │                                                               │ │
│  │  • USDC 보관 (CREDIT 토큰의 100% 담보)                        │ │
│  │  • 채널 종료 시 CREDIT 잔액 기준 USDC 분배                    │ │
│  │  • 크레딧 충전 시 추가 USDC 예치                              │ │
│  │  • 참여자 퇴장 시 부분 정산                                   │ │
│  │  • 비상 인출 (타임아웃 보호)                                  │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  ERC-8004 연동                                                │ │
│  │  • 채널 생성 시 신원 검증                                      │ │
│  │  • 풀 채널 평판 기반 접근 제어                                 │ │
│  │  • 세션 후 평판 업데이트                                       │ │
│  └───────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Escrow Contract

Escrow Contract는 정산 체인(Base/Ethereum)에 존재하며, CREDIT 토큰의 USDC 담보를 보관합니다.

### 핵심 함수

```solidity
interface IAESEscrow {
    // 채널 생성 시 USDC 예치
    function deposit(bytes32 channelId, uint256 usdcAmount) external;

    // 크레딧 추가 충전 시 USDC 추가 예치
    function topup(bytes32 channelId, uint256 usdcAmount) external;

    // 채널 종료 시 CREDIT 잔액 기준 USDC 분배
    function settle(
        bytes32 channelId,
        address[] calldata agents,
        uint256[] calldata creditBalances,
        bytes calldata hydraStateProof
    ) external;

    // 개별 참여자 퇴장 시 부분 정산
    function exitParticipant(
        bytes32 channelId,
        address agent,
        uint256 creditBalance,
        bytes calldata proof
    ) external;

    // 비상 인출 (AES 무응답 시 타임아웃 보호)
    function emergencyWithdraw(bytes32 channelId) external;
}
```

### CREDIT ↔ USDC 관계

```
민팅 시: USDC 예치 → CREDIT 민팅 (1 USDC = 1,000 CREDIT)
정산 시: CREDIT 잔액 확인 → CREDIT 번 → USDC 분배
충전 시: 추가 USDC 예치 → 추가 CREDIT 민팅 → Incremental Commit

항상 성립: 유통 중인 총 CREDIT ≤ Escrow에 예치된 USDC × 1,000
```

---

## 비즈니스 모델

### 고객이 지불하는 것

x402로 USDC를 지불합니다. 서비스비 + 크레딧 구매가 한 번에 처리됩니다.

| 상품 | 설명 | 가격 |
|------|------|------|
| **채널 개설 + 초기 크레딧** | 채널 생성 + CREDIT 충전 | 서비스비 $5~$20 + 크레딧 실비 |
| **크레딧 충전** | 기존 채널에 CREDIT 추가 | 크레딧 실비만 |
| **풀 채널 구독** | 상시 풀 채널 이용권 | $50~$500/월 |
| **프리미엄 SLA** | 전용 Head, 지연시간 보장 | $200~$2,000/월 |
| **Self-Hosted 지원** | 직접 참여 모드 설정 지원 | 별도 협의 |

### AES가 부담하는 것

| 비용 | 설명 | 예상 단가 |
|------|------|----------|
| Hydra 노드 운영 | 서버, 네트워크, 유지보수 | $1~$3/채널 |
| Cardano L1 ADA | min-UTXO + 트랜잭션 수수료 | 에이전트당 ~1.5 ADA |
| CREDIT 민팅 | L1 민팅 트랜잭션 비용 | ~0.2 ADA/건 |
| EVM RPC | Escrow 모니터링, 정산 제출 | $0~$50/월 |
| 인프라 | DB, 모니터링, 보안, 백업 | 분할 상각 |

### 비용 비교

10,000건 에이전트 간 인터랙션 기준:

| 실행 환경 | 비용 | 지연시간 | 온체인 트랜잭션 |
|-----------|------|---------|----------------|
| Ethereum L1 | ~$5,000~$50,000 | 12초/tx | 10,000건 |
| Base L2 | ~$10 | 2초/tx | 10,000건 |
| **AES** | **$5~$15** | **<50ms/tx** | **0건 (고객 기준)** |

### 단위 경제학

```
채널 1건 (10K 인터랙션, $100 크레딧) 기준:

수익:
  서비스비:              $10.00
  정산 수수료 (0.05%):   $0.05
  합계:                 $10.05

비용:
  Hydra 노드 컴퓨트:    $1.50
  Cardano L1 (ADA):     $0.50
  CREDIT 민팅/번:       $0.10
  인프라 (분할 상각):    $1.00
  합계:                 $3.10

매출총이익률:            ~69%
```

---

## 사용 사례

### 1. AI 서비스 파이프라인
오케스트레이터 에이전트가 전문 에이전트들에게 작업을 분배합니다.

```
Client Agent (의뢰자) — 채널 개설 + 100,000 CREDIT
  │
  ├→ Translator Agent     CREDIT 10/건 × 1,000건
  ├→ Summarizer Agent     CREDIT 5/건 × 1,000건
  ├→ Fact-Checker Agent   CREDIT 20/건 × 1,000건
  └→ Formatter Agent      CREDIT 3/건 × 1,000건

1개 장기 채널에서 4,000건 인터랙션 처리
크레딧 소진 시 x402로 추가 충전 → 채널 유지
```

### 2. 고빈도 트레이딩 봇
여러 트레이딩 봇이 풀 채널에서 상호작용합니다.

```
Pool Channel: "Trading Arena" (장기 운영)
  ├── Market Maker Bot A
  ├── Market Maker Bot B  
  ├── Arbitrage Bot C       ← 나중에 참여 (Incremental Commit)
  ├── Trend Follower Bot D
  └── Liquidity Provider Bot E

채널을 닫지 않고 수개월 운영
참여자는 자유롭게 들어오고 나감
CREDIT으로 봇 간 거래, 주기적으로 USDC 정산
```

### 3. 분산 컴퓨팅 마켓플레이스

```
Orchestrator Agent
  ├→ GPU Agent 1: 배치 1~100     CREDIT 100/배치
  ├→ GPU Agent 2: 배치 101~200   CREDIT 100/배치
  ├→ GPU Agent 3: 배치 201~300   CREDIT 100/배치
  └→ Validator Agent: 결과 검증   CREDIT 50/건

건별 마이크로페이먼트, 채널 내 즉시 처리
모든 tx는 에이전트 직접 서명 → Hydra UTXO에 기록
```

### 4. 다자간 에이전트 협상

```
Buyer Agent ←→ Seller Agent ←→ Escrow Agent ←→ Inspector Agent

수백 건의 제안/역제안 교환
조건부 CREDIT 전송: Inspector 승인 서명 → CREDIT 해제
모든 거래가 단일 장기 채널에서 처리
```

---

## 연동 가이드

### ERC-8004 에이전트 개발자용

```javascript
import { AESClient } from '@aes-network/sdk';

// 초기화
const aes = new AESClient({
  agentId: 'erc8004:0xYourAgent',
  privateKey: process.env.AGENT_PRIVATE_KEY,  // EVM 키 (x402 결제용)
  network: 'base'
});

// 1. 채널 생성 (x402 결제 자동 처리)
const channel = await aes.createChannel({
  type: 'private',
  participants: [
    { agentId: 'erc8004:0xPartnerAgent', role: 'provider' }
  ],
  credits: 100000
});
// channel.cardanoKey → Hydra 서명용 Cardano 키페어

// 2. 트랜잭션 전송 (SDK가 자동 서명)
const result = await channel.send({
  to: channel.participants['0xPartnerAgent'].cardanoAddress,
  amount: 500,
  memo: 'classify:image_001'
});
console.log(result.credits);  // 남은 CREDIT

// 3. 트랜잭션 수신
channel.onReceive((tx) => {
  console.log(`${tx.from}에서 ${tx.amount} CREDIT 수신: ${tx.memo}`);
});

// 4. 크레딧 충전 (채널 유지)
await channel.topup(50000);  // x402로 추가 결제 → CREDIT 추가

// 5. 종료 시
const settlement = await channel.close();
console.log(settlement.usdc_received);  // USDC로 정산된 금액
```

### WebSocket (고빈도)

```javascript
const ws = await channel.connectWebSocket();

// tx 요청 → unsigned tx 수신 → SDK가 자동 서명 → 제출
ws.send({ action: 'tx', to: 'addr1qy...', amount: 1, memo: 'ping' });

ws.on('tx_received', (tx) => {
  ws.send({ action: 'tx', to: tx.from, amount: 1, memo: 'pong' });
});

ws.on('credits_low', (data) => {
  console.log(`CREDIT 부족: ${data.credits}`);
  // channel.topup(50000) 으로 충전하거나
  ws.send({ action: 'close' });
});
```

---

## ERC-8004 연동

### 신원 검증
채널 생성/참여 시 AES가 온체인에서 ERC-8004 신원을 검증합니다.

```
에이전트가 챌린지 서명 → AES가 서명 검증 →
AES가 ERC-8004 Identity Registry 조회 →
agent_id, capabilities, 평판 점수 확인
```

### 평판 기반 접근 제어
풀 채널에서 최소 평판 점수를 요구할 수 있습니다.

```json
{
  "join_criteria": {
    "min_reputation": 4.0,
    "min_completed_sessions": 10,
    "required_capabilities": ["trading"]
  }
}
```

### 세션 후 평판 리포팅
채널 종료 또는 참여자 퇴장 시 AES가 ERC-8004 Reputation Registry에 보고합니다.

```json
{
  "session": "ch_abc123",
  "participants": ["0xAgentA", "0xAgentB", "0xAgentC"],
  "interactions": 4721,
  "disputes": 0,
  "duration": "14d 3h 22m",
  "outcome": "completed_clean"
}
```

---

## 왜 Hydra인가?

### 고객에게 직접적인 이점

고객은 Hydra를 모르지만, Hydra 덕분에 AES가 제공할 수 있는 것:

| 특성 | 단순 서버 | L2 기반 | AES (Hydra) |
|------|-----------|---------|-------------|
| 지연시간 | <1ms | 2초 | **<50ms** |
| 검증 가능성 | ❌ | ✅ | ✅ |
| 에이전트 직접 서명 | ❌ | ✅ | ✅ |
| 분쟁 해결 | ❌ | ✅ | ✅ |
| 트랜잭션 비용 | 무료 | 가스비 | **무료** |
| 장기 채널 유지 | 서버 의존 | 해당 없음 | ✅ |

단순 서버보다 약간 느리지만 **에이전트가 직접 서명하고 검증 가능**하며, L2보다 **빠르고 무료**입니다.

### AES 운영자(우리)에게 이점

- **운영비가 낮음**: Cardano L1 트랜잭션 비용이 매우 저렴 (~$0.10)
- **검증 가능한 실행**: 분쟁 시 Hydra 스냅샷으로 증명 가능
- **Incremental Commit/Decommit**: 채널을 닫지 않고 크레딧 충전, 참여자 관리
- **UTXO가 곧 원장**: 별도 장부 DB 없이 Hydra 상태가 진실의 원천

### 핵심 포지셔닝

> "고객은 API를 산다. 우리는 Hydra로 그 API를 구동한다.
> CREDIT은 USDC가 담보하고, 에이전트가 직접 서명한다.
> 고객에게는 가장 빠르고 싼 에이전트 통신 서비스.
> 우리에게는 검증 가능하고 확장 가능한 인프라."

---

## 보안 고려사항

### 신뢰 모델

| 컴포넌트 | 신뢰 모델 |
|----------|-----------|
| x402 결제 | 트러스트리스 (온체인) |
| Escrow Contract | 트러스트리스 (온체인 스마트 컨트랙트) |
| CREDIT ↔ USDC 페깅 | Escrow 담보로 보장 |
| 채널 내 트랜잭션 | 에이전트 직접 서명 (AES 조작 불가) |
| AES Gateway | 세미 트러스티드 (트랜잭션 중계) |
| Hydra 상태 | 검증 가능 (스냅샷 + 참여자 서명) |

### 분쟁 해결
1. Hydra 채널 내 모든 상태 전이는 참여자 합의 기반
2. 분쟁 시 최신 스냅샷을 Cardano L1에 커밋하여 검증
3. Self-Hosted 모드에서는 에이전트가 직접 모든 상태를 검증

### 고객 보호
- CREDIT은 항상 100% USDC 담보
- 에이전트가 직접 서명하므로 AES의 자금 조작 불가
- 채널 비상 종료 시 마지막 합의된 스냅샷 기준 정산
- Escrow에 타임아웃 기반 비상 인출 기능

---

## 기술 스택

| 컴포넌트 | 기술 |
|----------|------|
| AES Gateway | Node.js / Rust |
| Hydra 노드 | Cardano Hydra (Haskell) |
| Hydra 스크립트 | Aiken (Cardano) |
| CREDIT 민팅 정책 | Aiken (Cardano Native Token) |
| Escrow Contract | Solidity (Base/Ethereum) |
| API 레이어 | REST + WebSocket |
| DB | PostgreSQL (메타데이터, 인덱싱) |
| 키 관리 | HSM / KMS |
| 모니터링 | Prometheus + Grafana |
| 결제 | x402 Protocol (Base/Ethereum) |
| 신원 | ERC-8004 (Ethereum) |

---

## 인프라 요구사항

### 서버

| 컴포넌트 | 사양 | 비고 |
|----------|------|------|
| Cardano 풀노드 | 16GB RAM, 200GB SSD | Hydra 노드의 전제 조건 |
| Hydra 노드 | 채널당 1 프로세스 | AES는 모든 Head에 참여 |
| API 서버 | 4GB+ RAM | REST + WebSocket |
| DB (PostgreSQL) | 8GB+ RAM | 메타데이터, 거래 인덱싱 |
| EVM RPC | 외부 서비스 가능 | Infura, Alchemy 등 |

### 온체인 자산

| 자산 | 용도 | 예상 필요량 |
|------|------|------------|
| ADA | min-UTXO (에이전트당 ~1.5 ADA) | 동시 채널 × 참여자 수 × 1.5 |
| ADA | L1 트랜잭션 수수료 | Head 열기/닫기, 민팅 등 |
| CREDIT 민팅 정책 | Cardano에 배포 | 1회 |
| Escrow Contract | Base/Ethereum에 배포 | 1회 (+ 감사 비용) |

### 월간 운영비 추정 (동시 10채널, 채널당 3명 기준)

```
서버:
  Cardano 풀노드:          $50~100
  Hydra 노드 (10개):       $100~200
  API 서버:                $50~100
  DB:                      $30~50

온체인:
  ADA 보유 (잠김):         45 ADA (~$30) — 종료 시 회수
  L1 수수료:               ~5 ADA/월 (~$3)
  CREDIT 민팅/번:          ~2 ADA/월 (~$1.5)

EVM:
  RPC 서비스:              $0~50
  Escrow 가스비:           ~$5/월

합계:                      ~$300~500/월
```

---

## 로드맵

### Phase 1 — MVP (1:1 채널)
- [ ] CREDIT 토큰 민팅 정책 설계 및 배포 (Aiken)
- [ ] Escrow Contract 배포 (Base Sepolia)
- [ ] x402 결제 핸들러 구현
- [ ] Hydra 단일 Head 프로비저닝
- [ ] 에이전트별 Cardano 키페어 발급
- [ ] 에이전트 직접 서명 플로우 (unsigned tx → 서명 → 제출)
- [ ] 채널 라이프사이클 REST API
- [ ] 채널 종료 + CREDIT → USDC 정산
- [ ] ERC-8004 신원 검증

### Phase 2 — 다자간 + 장기 채널
- [ ] 다자간 채널 지원 (3~10명)
- [ ] 원자적 다자간 전송
- [ ] 크레딧 충전 (Incremental Commit)
- [ ] 참여자 동적 추가/제거 (Incremental Commit/Decommit)
- [ ] 장기 채널 안정성 테스트
- [ ] 조건부 트랜잭션
- [ ] WebSocket API

### Phase 3 — 풀 채널 + 스케일링
- [ ] 상시 풀 채널 인프라
- [ ] 평판 기반 접근 제어
- [ ] Hydra Head 풀 오토스케일링
- [ ] ERC-8004 평판 리포팅
- [ ] Self-Hosted 모드 지원

### Phase 4 — 프로덕션
- [ ] Escrow Contract 감사
- [ ] CREDIT 민팅 정책 감사
- [ ] HSM 기반 키 관리
- [ ] SDK 릴리스 (TypeScript, Python)
- [ ] 분쟁 해결 시스템
- [ ] 공개 채널 런칭

---

## 라이선스

TBD

---

## 링크

- ERC-8004: https://eips.ethereum.org/EIPS/eip-8004
- x402 Protocol: https://www.x402.org
- Cardano Hydra: https://hydra.family
- 문의: TBD