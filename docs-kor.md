# AES — Agent Execution Service

> **Hydra 기반 AI 에이전트 고속 실행 채널**
> 
> ERC-8004 에이전트가 x402로 비용을 지불하고, 즉시 다자간 통신 채널을 개설합니다. 채널 내 트랜잭션은 무제한, 수수료 0.

---

## 문제

AI 에이전트(ERC-8004)가 자율적인 경제 주체로 진화하고 있습니다. 거래, 서비스 제공, 조직 간 협업을 독립적으로 수행합니다. 그러나 에이전트 간 고빈도 상호작용(세션당 수천~수만 건)이 필요할 때 기존 인프라는 한계에 부딪힙니다:

- **L1 (Ethereum)**: 트랜잭션당 $0.50~$5, 12초 확정 → 고빈도 에이전트 상호작용에 사용 불가
- **L2 (Base, Arbitrum)**: 트랜잭션당 ~$0.001, 2초 블록 → 10K+ 인터랙션에서는 여전히 느리고 비쌈
- **오프체인**: 빠르고 무료지만 검증 가능한 상태가 없고, 분쟁 해결 불가, 신뢰 부재

**빈 자리**: ERC-8004는 에이전트에게 신원과 평판을 줬습니다. x402는 에이전트에게 결제 수단을 줬습니다. 하지만 어느 쪽도 에이전트에게 **고속, 검증 가능한 다자간 실행 환경**을 제공하지 못합니다.

---

## 솔루션

AES는 **온디맨드 Hydra 상태 채널**을 서비스로 제공합니다. 에이전트는 x402로 한 번 결제하여 채널을 열고, 에스크로에 자금을 예치한 뒤, **수수료 0, 50ms 미만 확정**으로 수천 번 상호작용합니다. 완료되면 최종 상태가 온체인에 정산됩니다.

```
Agent A ──┐                              ┌── Agent A (정산 완료)
Agent B ──┤── x402 결제 → AES → Hydra ─→ ├── Agent B (정산 완료)  
Agent C ──┘    ($5)      채널    (무료)   └── Agent C (정산 완료)
                        10,000 tx               Base/ETH 위
```

**에이전트는 Hydra나 Cardano를 알 필요가 없습니다.** REST/WebSocket API로만 상호작용합니다. AES가 모든 것을 추상화합니다.

---

## 작동 방식

### 전체 플로우

```
Phase 1: 구매             Phase 2: 예치            Phase 3: 실행            Phase 4: 정산
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│                  │     │                  │     │                  │     │                  │
│  Agent → AES     │     │  에이전트들이    │     │  에이전트들이    │     │  채널 종료       │
│  x402 결제       │ ──→ │  USDC를 Escrow에 │ ──→ │  REST/WS API로   │ ──→ │  최종 잔액       │
│  ($1~$20)        │     │  예치 (Base/ETH) │     │  Hydra 내 통신   │     │  온체인 정산     │
│                  │     │                  │     │  무료, <50ms     │     │                  │
└──────────────────┘     └──────────────────┘     └──────────────────┘     └──────────────────┘
```

### Phase 1 — 채널 구매 (x402)

에이전트가 채널을 요청합니다. AES는 HTTP 402와 x402 결제 정보로 응답합니다. 에이전트가 결제하면 AES가 채널을 프로비저닝합니다.

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

### Phase 2 — 에스크로 예치

참여자들이 온체인 Escrow Contract에 USDC를 예치합니다. 모든 필수 예치가 확인되면 AES가 Hydra 채널을 활성화합니다.

- **클라이언트 에이전트** (서비스 요청자): 예산만큼 예치
- **프로바이더 에이전트** (서비스 제공자): 예치 불필요 또는 소액 스테이크
- 예치금은 스마트 컨트랙트에 보관 — AES가 직접 자금을 수탁하지 않음

### Phase 3 — 채널 실행

AES가 프로비저닝하는 것:
1. 채널 풀에서 Hydra Head 세션 할당
2. 참여자별 임시 Hydra 월렛 생성 (키는 HSM/TEE에서 관리)
3. 에스크로 예치금을 미러링하는 내부 크레딧 잔액
4. 채널용 REST API + WebSocket 엔드포인트

에이전트들은 채널 내에서 자유롭게 상호작용합니다:
- **모든 트랜잭션이 즉시 확정** (<50ms)
- **트랜잭션당 수수료 0** (모든 비용은 채널 개설비에 포함)
- **전체 거래 내역** API로 조회 가능
- **실시간 잔액 추적** 및 잔액 부족 알림

### Phase 4 — 정산

트리거: 에이전트 요청 / 예산 소진 / 채널 만료

1. AES가 최종 Hydra 상태 스냅샷 캡처
2. Escrow Contract에 정산 증명 제출
3. Escrow가 최종 잔액 기준으로 USDC를 참여자들에게 분배
4. (선택) 거래 요약을 ERC-8004 Reputation Registry에 기록

**10,000건 인터랙션 세션의 온체인 트랜잭션: 3건** (예치 + 활성화 + 정산)

---

## 채널 유형

### Private Channel (비공개 채널)
초대된 참여자만 참여. 특정 워크플로우에 최적.

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

**용도**: 서비스 파이프라인, B2B 정산, 조율된 다자간 에이전트 작업

### Pool Channel (풀 채널)
조건 충족 시 누구나 참여/퇴장 가능. 채널은 상시 유지.

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

**용도**: 트레이딩 풀, 서비스 마켓플레이스, 개방형 협업

### Public Channel (공개 채널)
AES가 운영하는 상시 채널. ERC-8004 Identity만 있으면 누구나 참여. 낮은/무예치.

```json
{
  "type": "public",
  "join_criteria": {
    "erc8004_identity": true
  }
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
모든 요청에 ERC-8004 에이전트 서명 또는 신원 검증 후 발급된 API 키 필요.

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

응답 (x402 결제 후):
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

#### 채널 종료
```http
POST /v1/channels/{channel_id}/close
```

요청:
```json
{
  "reason": "completed",
  "requested_by": "0xAgentA"
}
```

응답:
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

### 트랜잭션 (채널 내)

#### 단건 전송
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

응답:
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

#### 다자간 동시 전송 (원자적)
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

모든 전송이 원자적으로 처리됩니다. 전부 성공하거나 전부 실패합니다.

#### 조건부 전송 (채널 내 에스크로)
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

`0xAgentC`가 승인하거나 타임아웃이 만료될 때까지 결제가 보류됩니다.

#### 배치 트랜잭션 (고빈도용)
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

응답:
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

### 참여자 관리 (동적 멤버십)

#### 참여자 초대
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

새 참여자는 Hydra Incremental Commit을 통해 합류합니다. 채널은 계속 유지됩니다.

#### 채널 퇴장
```http
POST /v1/channels/{channel_id}/participants/leave
```

```json
{
  "agent_id": "0xAgentB",
  "reason": "task_completed"
}
```

해당 에이전트의 잔액이 온체인으로 정산됩니다. 나머지 참여자들은 계속 채널을 사용합니다.

---

### WebSocket API (고빈도 모드)

```
wss://api.aes.network/v1/channels/{channel_id}/ws
```

#### 클라이언트 → 서버 메시지

```json
{ "action": "tx", "to": "0xAgentB", "amount": "0.001", "memo": "call_42" }
```

```json
{ "action": "subscribe", "events": ["tx_received", "balance_low", "participant_joined"] }
```

```json
{ "action": "close" }
```

#### 서버 → 클라이언트 메시지

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

## 아키텍처

```
┌─────────────────────────────────────────────────────────────────────┐
│                        에이전트 애플리케이션                          │
│           (Ethereum / Base / 모든 EVM 위의 ERC-8004 에이전트)        │
├─────────────────────────────────────────────────────────────────────┤
│                          AES Gateway                                │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────────┐ │
│  │ x402 결제    │  │ Identity     │  │ Channel Manager           │ │
│  │ 핸들러       │  │ Bridge       │  │                           │ │
│  │              │  │              │  │ • 채널 풀 관리            │ │
│  │ x402 증명    │  │ ERC-8004 ID  │  │ • 세션 할당              │ │
│  │ 수신 및 검증 │  │ 검증 +       │  │ • 자동 개설/종료          │ │
│  │              │  │ Hydra 세션키 │  │ • 스냅샷 스케줄링         │ │
│  │              │  │ 매핑         │  │ • 동적 멤버십 관리        │ │
│  └──────────────┘  └──────────────┘  └───────────────────────────┘ │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────────┐ │
│  │ REST API     │  │ WebSocket    │  │ Settlement Engine         │ │
│  │ 서버         │  │ 서버         │  │                           │ │
│  │              │  │              │  │ • Hydra 스냅샷 → 증명     │ │
│  │ 채널, 트랜잭 │  │ 고빈도용     │  │ • Escrow 정산 호출        │ │
│  │ 션 CRUD      │  │ 실시간 스트  │  │ • 평판 리포팅             │ │
│  │              │  │ 리밍         │  │ • 멀티체인 지원           │ │
│  └──────────────┘  └──────────────┘  └───────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────┤
│                       Hydra Channel Pool                            │
│                                                                     │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐      │
│  │ Head #1   │  │ Head #2   │  │ Head #3   │  │ Head #N   │      │
│  │ 범용      │  │ 트레이딩  │  │ 컴퓨트    │  │ 온디맨드  │      │
│  └───────────┘  └───────────┘  └───────────┘  └───────────┘      │
│                                                                     │
│  • 50ms 미만 확정    • 트랜잭션당 수수료 0                          │
│  • Isomorphic 스크립트 • Incremental Commit/Decommit               │
├─────────────────────────────────────────────────────────────────────┤
│                        Cardano L1                                   │
│              Hydra 앵커 체인 / 분쟁 해결                             │
├─────────────────────────────────────────────────────────────────────┤
│                    정산 체인 (EVM)                                   │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │                    Escrow Contract                             │ │
│  │                                                               │ │
│  │  • 다자간 예치/인출                                            │ │
│  │  • Hydra 상태 증명 기반 정산                                   │ │
│  │  • 타임아웃 보호 + 비상 인출                                   │ │
│  │  • 개별 참여자 퇴장 (부분 정산)                                │ │
│  │                                                               │ │
│  │  배포 대상: Base, Ethereum, Arbitrum (추후)                    │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  ERC-8004 연동                                                │ │
│  │  • 채널 생성 시 신원 검증                                      │ │
│  │  • 풀 채널 평판 점수 기반 접근 제어                             │ │
│  │  • 세션 종료 후 평판 업데이트                                   │ │
│  └───────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Escrow Contract

Escrow Contract는 정산 체인(Base/Ethereum)에 존재하며, 채널 운영 중 참여자 자금을 보관합니다. AES는 자금을 직접 수탁하지 않습니다.

### 핵심 함수

```solidity
interface IAESEscrow {
    // 채널에 USDC 예치
    function deposit(bytes32 channelId, uint256 amount) external;
    
    // 다자간 정산 (AES가 Hydra 증명과 함께 호출)
    function settle(
        bytes32 channelId,
        address[] calldata participants,
        uint256[] calldata amounts,
        bytes calldata hydraStateProof
    ) external;
    
    // 개별 참여자 퇴장 (채널은 유지)
    function exitParticipant(
        bytes32 channelId,
        address participant,
        uint256 amount,
        bytes calldata proof
    ) external;
    
    // 타임아웃 환불 (채널이 활성화되지 않은 경우)
    function refundTimeout(bytes32 channelId) external;
    
    // 비상 인출 (채널 만료, AES 무응답 시)
    function emergencyWithdraw(bytes32 channelId) external;
}
```

### 신뢰 모델

| 컴포넌트 | 신뢰 모델 |
|----------|-----------|
| Escrow Contract | 트러스트리스 (온체인 스마트 컨트랙트, 감사 완료) |
| AES Gateway | 세미 트러스티드 (Hydra 노드 운영) |
| Hydra 상태 | 검증 가능 (스냅샷을 Cardano L1에 커밋 가능) |
| 정산 증명 | 암호학적 (모든 Hydra Head 참여자가 서명) |

### 분쟁 해결

AES가 잘못된 정산을 제출한 경우:
1. 모든 참여자는 분쟁 기간(예: 24시간) 내에 이의 제기 가능
2. 이의 제기자가 자신의 Hydra 스냅샷 사본을 제출
3. Escrow Contract가 증명을 비교하여 유효한 상태 기준으로 정산
4. 악의적 당사자의 스테이크 슬래싱

---

## 비즈니스 모델

### 수익원

| 수익원 | 설명 | 가격 |
|--------|------|------|
| **채널 개설비** | 채널 생성 시 x402 결제 | 채널당 $1~$20 |
| **정산 수수료** | 총 정산 금액 기준 비율 | 0.03%~0.1% |
| **풀 채널 구독료** | 상시 풀 채널 월간 운영비 | $50~$500/월 |
| **채널 연장** | 활성 채널 시간 추가 | $0.50~$2/시간 |
| **프리미엄 SLA** | 전용 Hydra Head, 지연시간 보장 | $200~$2,000/월 |
| **엔터프라이즈** | 맞춤 배포, 화이트라벨, 전용 인프라 | 별도 협의 |

### 비용 비교

10,000건 에이전트 간 인터랙션 세션 기준:

| 실행 환경 | 비용 | 지연시간 | 온체인 트랜잭션 |
|-----------|------|---------|----------------|
| Ethereum L1 | ~$5,000~$50,000 | 12초/tx | 10,000건 |
| Base L2 | ~$10 | 2초/tx | 10,000건 |
| **AES (Hydra)** | **~$5~$15** | **<50ms/tx** | **3건** |

고빈도에서 AES는 **L1 대비 1,000배 저렴**하고, **모든 L2보다 빠릅니다**.

### 단위 경제학

```
채널 1건 (10K 인터랙션, $10K 거래량) 기준:

수익:
  채널 개설비:        $5.00
  정산 수수료:        $5.00  ($10K의 0.05%)
  합계:              $10.00

비용:
  Hydra 노드 컴퓨트:  $1.50  (채널 간 공유)
  Cardano L1 tx:      $0.20  (앵커/종료)
  Base 정산 tx:       $0.05
  인프라:             $1.00  (분할 상각)
  합계:              $2.75

매출총이익률:         ~72%
```

---

## 사용 사례

### 1. AI 서비스 파이프라인
오케스트레이터 에이전트가 복잡한 작업을 위해 전문 에이전트들을 고용합니다.

```
Client Agent (의뢰자)
  ├→ Translator Agent    ($0.01/건)
  ├→ Summarizer Agent    ($0.005/건)
  ├→ Fact-Checker Agent  ($0.02/건)
  └→ Formatter Agent     ($0.003/건)

1,000개 문서를 하나의 채널 세션에서 처리.
AES 경유 총비용:  채널 $5 + 서비스 $38 = $43
Base 직접:       서비스 $38 + 가스 $4 (4,000 tx) = $42
ETH L1 직접:     서비스 $38 + 가스 $2,000+ = $2,038+

결론: 저량에서는 L2와 비슷, 대량에서는 AES가 압도적으로 저렴
```

### 2. 고빈도 트레이딩 봇
여러 트레이딩 봇이 풀 채널에서 상호작용합니다.

```
Pool Channel: "Trading Arena"
  ├── Market Maker Bot A
  ├── Market Maker Bot B  
  ├── Arbitrage Bot C
  ├── Trend Follower Bot D
  └── Liquidity Provider Bot E

24시간 운영: ~500K 인터랙션
L2 사용 시: 가스비 $500
AES 사용 시: 구독 $50 + 정산 수수료 $150 = $200
```

### 3. 분산 컴퓨팅 마켓플레이스
오케스트레이터가 ML 학습을 GPU 에이전트들에게 분배합니다.

```
Orchestrator Agent
  ├→ GPU Agent 1: 배치 1~100     ($0.10/배치)
  ├→ GPU Agent 2: 배치 101~200   ($0.10/배치)
  ├→ GPU Agent 3: 배치 201~300   ($0.10/배치)
  └→ Validator Agent: 결과 검증   ($0.05/건)

건별 마이크로페이먼트로 즉시 정산.
```

### 4. 다자간 에이전트 협상
에이전트들이 조건을 협상하고, 제안을 교환하며, 합의에 도달합니다.

```
Buyer Agent ←→ Seller Agent ←→ Escrow Agent ←→ Inspector Agent

수백 건의 제안/역제안 교환.
조건부 결제: Inspector가 승인 → Escrow가 자금 해제.
모든 결제가 단일 채널 세션 내에서 처리.
```

---

## 연동 가이드

### ERC-8004 에이전트 개발자용

```javascript
import { AESClient } from '@aes-network/sdk';

// ERC-8004 크리덴셜로 초기화
const aes = new AESClient({
  agentId: 'erc8004:0xYourAgent',
  privateKey: process.env.AGENT_PRIVATE_KEY,
  network: 'base'
});

// 1. 채널 생성
const channel = await aes.createChannel({
  type: 'private',
  participants: [
    { agentId: 'erc8004:0xPartnerAgent', role: 'provider', deposit: '0' }
  ],
  duration: '2h',
  deposit: '1000'  // USDC 예치금
});
// x402 결제는 SDK가 자동 처리

// 2. 활성화 대기
await channel.waitForActivation();

// 3. 트랜잭션 전송
const result = await channel.send({
  to: '0xPartnerAgent',
  amount: '0.50',
  memo: 'classify:image_001'
});
console.log(result.balance);  // 남은 잔액

// 4. 트랜잭션 수신 (콜백)
channel.onReceive((tx) => {
  console.log(`${tx.from}에서 ${tx.amount} 수신: ${tx.memo}`);
});

// 5. 완료 시 종료
const settlement = await channel.close();
console.log(settlement.final_balances);
// USDC가 Base 위 지갑으로 반환됨
```

### WebSocket (고빈도)

```javascript
const ws = await channel.connectWebSocket();

// 트랜잭션 스트리밍
ws.send({ action: 'tx', to: '0xPartner', amount: '0.001', memo: 'ping' });

ws.on('tx_received', (tx) => {
  // 실시간 처리 및 응답
  ws.send({ action: 'tx', to: tx.from, amount: '0.001', memo: 'pong' });
});

ws.on('balance_low', (data) => {
  console.log(`잔액 부족: ${data.balance}`);
  ws.send({ action: 'close' });
});
```

---

## ERC-8004 연동

### 신원 검증
에이전트가 채널을 생성하거나 참여할 때 AES가 온체인에서 ERC-8004 신원을 검증합니다:

```
에이전트가 챌린지 서명 → AES가 서명 검증 → 
AES가 ERC-8004 Identity Registry 조회 → 
agent_id, capabilities, 평판 점수 확인
```

### 평판 기반 접근 제어
풀 채널에서 최소 평판 점수를 요구할 수 있습니다:

```json
{
  "join_criteria": {
    "min_reputation": 4.0,
    "min_completed_sessions": 10,
    "required_capabilities": ["trading", "market_making"]
  }
}
```

### 세션 후 평판 리포팅
채널 정산 후 AES가 세션 결과를 ERC-8004 Reputation Registry에 보고합니다:

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

다른 에이전트들이 특정 상대와 채널에 참여할지 결정할 때 이 검증 가능한 이력을 활용할 수 있습니다.

---

## x402 결제 연동

AES는 모든 서비스 결제에 x402 프로토콜을 구현합니다:

### 지원되는 결제 플로우

| 액션 | 결제 유형 | 일반적 금액 |
|------|----------|------------|
| 채널 생성 | 1회성 x402 | $1~$20 |
| 채널 연장 | 1회성 x402 | $0.50~$2/시간 |
| 풀 채널 참여 | 반복 x402 | $50~$500/월 |
| 프리미엄 기능 | 1회성 x402 | 가변 |

### x402 응답 형식

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

## 로드맵

### Phase 1 — MVP (1:1 채널)
- [ ] Base Sepolia에 Escrow Contract 배포
- [ ] x402 결제 핸들러 구현
- [ ] Hydra 채널 프로비저닝 (단일 Head)
- [ ] 채널 라이프사이클 + 트랜잭션 REST API
- [ ] 기본 정산 플로우
- [ ] ERC-8004 신원 검증

### Phase 2 — 다자간 채널
- [ ] 다자간 채널 지원 (3~10명 참여자)
- [ ] 원자적 다자간 전송 (multi-transfer)
- [ ] 동적 참여자 관리 (Incremental Commit/Decommit)
- [ ] 조건부 트랜잭션 (채널 내 에스크로)
- [ ] 고빈도 모드 WebSocket API

### Phase 3 — 풀 채널
- [ ] 상시 풀 채널 인프라
- [ ] 평판 기반 접근 제어
- [ ] Hydra Head 풀 오토스케일링
- [ ] 세션 후 ERC-8004 평판 리포팅

### Phase 4 — 프로덕션
- [ ] Escrow Contract 감사
- [ ] TEE 기반 Hydra 노드 운영
- [ ] 멀티체인 정산 (Base + Ethereum + Arbitrum)
- [ ] SDK 릴리스 (TypeScript, Python)
- [ ] 분쟁 해결 시스템
- [ ] 공개 채널 런칭

---

## 보안 고려사항

### 신뢰 모델
AES는 채널 관리를 위한 **세미 트러스티드 중개자**로 운영됩니다. 자금은 온체인 에스크로 컨트랙트에 의해 보호되며, AES 자체에 의해 보호되지 않습니다.

### 공격 벡터 및 완화

| 공격 | 완화 방법 |
|------|----------|
| AES가 허위 정산 제출 | 온체인 분쟁 기간 + Hydra 상태 증명 |
| AES가 채널 중 오프라인 | 타임아웃 후 비상 인출 |
| 에이전트 사칭 | ERC-8004 신원 검증 + 챌린지-리스폰스 |
| 리플레이 공격 | 채널 내 논스 기반 트랜잭션 순서 보장 |
| 정산 프론트러닝 | 모든 참여자가 서명한 Hydra 스냅샷 |

### 키 관리
- Hydra 세션용 에이전트 키는 채널별로 생성
- 키는 HSM/TEE에 저장 — AES 애플리케이션 레이어에 노출되지 않음
- 채널 키는 임시적이며 정산 후 파기

---

## 기술 스택

| 컴포넌트 | 기술 |
|----------|------|
| AES Gateway | Node.js / Rust |
| Hydra 노드 | Cardano Hydra (Haskell) |
| Escrow Contract | Solidity (EVM) |
| Hydra 스크립트 | Aiken (Cardano) |
| API 레이어 | REST + WebSocket |
| 키 관리 | HSM / TEE (AWS Nitro Enclaves 등) |
| 모니터링 | Prometheus + Grafana |
| 신원 | ERC-8004 (Ethereum) |
| 결제 | x402 Protocol |

---

## 경쟁 우위: 왜 Hydra인가?

### vs. L2에서 직접 실행 (Base, Arbitrum)
- L2도 블록 생성 주기가 있음 (Base 2초). 에이전트 간 초당 수백 건 상호작용에는 여전히 느림
- Hydra는 참여자 간 합의 즉시 확정 (sub-second finality)
- L2는 트랜잭션마다 가스비 발생. Hydra는 채널 내 0

### vs. Ethereum State Channels (Raiden 등)
- 이더리움 State Channel 프로젝트들은 사실상 실패
- Hydra는 isomorphic — L1 스크립트를 그대로 실행 가능하여 더 유연

### vs. 순수 오프체인 처리
- 오프체인은 분쟁 해결 메커니즘이 없음
- Hydra는 채널 내 모든 상태를 L1에 커밋 가능 → 검증 가능한 실행

### 핵심 포지셔닝
> "ERC-8004가 에이전트에게 여권을 줬다면, AES는 에이전트에게 초고속 실행 환경을 준다.
> 신원은 이더리움에서, 실행은 Hydra에서, 정산은 어디서든."

---

## 라이선스

TBD

---

## 링크

- ERC-8004 Specification: https://eips.ethereum.org/EIPS/eip-8004
- x402 Protocol: https://www.x402.org
- Cardano Hydra: https://hydra.family
- 문의: TBD