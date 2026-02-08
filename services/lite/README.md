# AEL Lite

DB 기반 경량 에이전트 결제 채널 서비스. Hydra 없이 PostgreSQL을 원장으로 사용하여 <1ms 지연시간으로 에이전트 간 CREDIT 전송을 처리한다.

## 아키텍처

```
┌──────────────┐    x402/USDC     ┌──────────────┐     settle      ┌──────────────┐
│   AI Agent   │ ───────────────→ │   AEL Lite   │ ──────────────→ │  Base Sepolia │
│  (ERC-8004)  │ ←── CREDIT TX ── │   (Go/Gin)   │                │  (Escrow.sol) │
└──────────────┘    <1ms          └──────┬───────┘                └──────────────┘
                                         │
                                         ▼
                                  ┌──────────────┐
                                  │  PostgreSQL   │  ← 잔액 원장
                                  │  (ledger)     │
                                  └──────────────┘
                                         ▲
                                         │
                                  ┌──────────────┐
                                  │  Dashboard    │  ← 모니터링
                                  │  (Next.js)    │
                                  └──────────────┘
```

**핵심 특징:**
- DB가 원장: `credit_balances` 테이블에서 잔액을 원자적으로 관리
- 에이전트 서명 불필요: 서버가 잔액 차감/가산을 직접 처리
- 1 USDC = 1,000 CREDIT 비율로 크레딧 발행
- x402 프로토콜로 USDC 결제 → Escrow 예치 → CREDIT 발행

## 디렉토리 구조

```
lite/
├── backend/                        # Go 백엔드 (module: github.com/AEL/ael-lite)
│   ├── cmd/aeld/main.go           # 엔트리포인트
│   ├── Dockerfile                 # 멀티스테이지 빌드 (~15MB)
│   └── internal/
│       ├── config/                # Viper 환경 설정
│       ├── server/                # Gin 라우터 + HTTP 서버
│       ├── handler/               # HTTP 핸들러 (channel, auth, tx, admin)
│       ├── channel/               # Engine 인터페이스 + LiteEngine 구현
│       ├── x402/                  # x402 결제 검증 미들웨어
│       ├── identity/              # ERC-8004 챌린지-응답 인증
│       ├── evm/                   # Escrow 컨트랙트 Go 바인딩
│       ├── settlement/            # 정산 오케스트레이터
│       ├── ws/                    # WebSocket 실시간 이벤트 허브
│       ├── store/                 # PostgreSQL 쿼리 + 마이그레이션
│       └── metrics/               # Prometheus 메트릭
│
├── dashboard/                     # Next.js 모니터링 대시보드
│   ├── Dockerfile
│   └── src/
│       ├── app/                   # App Router 페이지
│       │   ├── page.tsx           # 시스템 개요
│       │   ├── channels/          # 채널 목록 + 상세 (잔액 포함)
│       │   ├── agents/            # 에이전트 목록 + 상세
│       │   ├── escrow/            # Escrow 상태 + CREDIT/USDC 비율
│       │   └── transactions/      # 실시간 TX 피드 (WebSocket)
│       └── lib/
│           ├── api.ts             # Admin API 클라이언트 + 타입
│           └── hooks.ts           # 폴링 + WebSocket 훅
│
├── docker-compose.yml             # PostgreSQL + backend + dashboard
├── Makefile
└── .env.example
```

## 기술 스택

| 구성요소 | 기술 |
|----------|------|
| 백엔드 | Go 1.24, Gin, pgx/v5 |
| 데이터베이스 | PostgreSQL 16 |
| 대시보드 | Next.js, TypeScript, Tailwind CSS |
| 결제 | x402 프로토콜 (USDC on Base) |
| 인증 | ERC-8004 (ECDSA 챌린지-응답) |
| 에스크로 | Solidity (Base Sepolia) |
| 메트릭 | Prometheus |
| 실시간 | WebSocket (gorilla/websocket) |

## 빠른 시작

### Docker Compose

```bash
cp .env.example .env
# .env 파일에서 필요한 값 설정

make docker-up       # PostgreSQL + backend + dashboard 기동
make docker-logs     # 로그 확인
```

- API: http://localhost:8080
- Dashboard: http://localhost:3000
- Metrics: http://localhost:8081/metrics

### 로컬 개발

```bash
# 백엔드
cd backend
go mod download
go build -o bin/aeld ./cmd/aeld
./bin/aeld

# 대시보드
cd dashboard
npm install
npm run dev
```

### DB 마이그레이션

```bash
make migrate    # psql로 모든 마이그레이션 실행
```

### 테스트

```bash
make test            # Go 테스트
make dashboard-build # Next.js 빌드 검증
make test-all        # Go + Forge 전체
```

## API 엔드포인트

### Public API (에이전트용)

| Method | Path | 설명 | 인증 |
|--------|------|------|------|
| `POST` | `/v1/auth/challenge` | 인증 챌린지 생성 | - |
| `POST` | `/v1/auth/verify` | 서명 검증 → EVM 주소 확인 | - |
| `POST` | `/v1/channels` | 채널 생성 | x402 |
| `GET` | `/v1/channels/:id` | 채널 조회 (잔액 포함) | - |
| `POST` | `/v1/channels/:id/topup` | 크레딧 충전 | x402 |
| `POST` | `/v1/channels/:id/tx` | CREDIT 전송 (즉시 확정) | - |
| `POST` | `/v1/channels/:id/close` | 채널 종료 + 정산 | - |
| `GET` | `/v1/channels/:id/ws` | WebSocket (실시간 TX) | - |

### Admin API (대시보드용)

모든 Admin 엔드포인트는 `X-Admin-Key` 헤더가 필요하다.

| Method | Path | 설명 |
|--------|------|------|
| `GET` | `/v1/admin/overview` | 시스템 통계 |
| `GET` | `/v1/admin/channels` | 채널 목록 |
| `GET` | `/v1/admin/channels/:id` | 채널 상세 |
| `GET` | `/v1/admin/channels/:id/transactions` | TX 히스토리 |
| `GET` | `/v1/admin/agents` | 에이전트 목록 |
| `GET` | `/v1/admin/agents/:id` | 에이전트 상세 |
| `GET` | `/v1/admin/escrow` | Escrow 상태 |
| `GET` | `/v1/admin/events` | 이벤트 목록 |
| `GET` | `/v1/admin/events/ws` | 실시간 이벤트 WebSocket |

### Health

| Method | Path | 설명 |
|--------|------|------|
| `GET` | `/healthz` | Liveness |
| `GET` | `/readyz` | Readiness (DB ping) |

## 채널 라이프사이클

```
1. 채널 생성 (POST /v1/channels)
   Agent → x402 USDC 결제 → AEL가 Escrow.deposit() 호출 → DB에 채널 + 잔액 생성
   └─ 1 USDC = 1,000 CREDIT 비율로 참여자에게 균등 분배

2. CREDIT 전송 (POST /v1/channels/:id/tx)
   { "from": "alice", "to": "bob", "amount": 500, "memo": "inference fee" }
   └─ DB 트랜잭션으로 원자적 차감/가산, <1ms, 즉시 confirmed

3. 크레딧 충전 (POST /v1/channels/:id/topup)
   Agent → x402 추가 결제 → Escrow.topup() → 잔액 증가

4. 채널 종료 (POST /v1/channels/:id/close)
   └─ 최종 잔액 기준 USDC 분배 계산 → Escrow.settle() 호출
   └─ 채널 상태: active → settled
```

## 환경 변수

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `PORT` | API 서버 포트 | `8080` |
| `METRICS_PORT` | Prometheus 메트릭 포트 | `8081` |
| `LOG_LEVEL` | 로그 레벨 (debug/info) | `debug` |
| `DATABASE_URL` | PostgreSQL 연결 문자열 | - |
| `EVM_RPC_URL` | Base Sepolia RPC | `https://sepolia.base.org` |
| `ESCROW_CONTRACT_ADDRESS` | Escrow 컨트랙트 주소 | - |
| `AEL_OPERATOR_EVM_KEY` | 오퍼레이터 EVM 개인키 | - |
| `X402_FACILITATOR_URL` | x402 검증 서버 | `https://x402.org/facilitator` |
| `AEL_PAYMENT_RECIPIENT` | 결제 수신 주소 | - |
| `IDENTITY_REGISTRY_ADDRESS` | ERC-8004 레지스트리 | - |
| `IDENTITY_REGISTRY_RPC` | 레지스트리 RPC | `https://eth.llamarpc.com` |
| `ADMIN_API_KEY` | Admin 대시보드 API 키 | - |

설정되지 않은 외부 서비스(Escrow, x402, ERC-8004)는 자동으로 비활성화된다 (dev 모드).

## 데이터베이스 스키마

### channels
채널 메타데이터. `mode = 'lite'`로 고정.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `channel_id` | VARCHAR(64) | 고유 채널 ID (ch_xxxx) |
| `mode` | VARCHAR(8) | `lite` |
| `status` | VARCHAR(16) | pending → active → settled |
| `total_usdc_deposited` | NUMERIC(20,6) | 예치된 USDC 총액 |
| `total_credits_minted` | BIGINT | 발행된 CREDIT 총량 |
| `total_transactions` | BIGINT | 처리된 TX 수 |
| `avg_latency_ms` | REAL | 평균 TX 레이턴시 |

### credit_balances (Lite 전용 — DB가 원장)
채널 내 에이전트별 CREDIT 잔액. `CHECK (balance >= 0)`으로 과잉인출 방지.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `channel_id` | UUID FK | 채널 |
| `agent_id` | UUID FK | 에이전트 |
| `balance` | BIGINT | 현재 잔액 (>= 0) |

### agents
에이전트 등록 정보 + ERC-8004 신원.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `agent_id` | VARCHAR(128) | 에이전트 식별자 |
| `evm_address` | VARCHAR(42) | 인증된 EVM 주소 |
| `reputation_score` | REAL | ERC-8004 평판 점수 |
| `verified_at` | TIMESTAMPTZ | 최근 인증 시점 |

### transaction_log
TX 이벤트 기록 (감사/대시보드용).

### events
시스템 이벤트 스트림 (`channel_created`, `tx_confirmed`, `credits_topped_up`, `channel_settled`).

## WebSocket 이벤트

채널별 구독 (`/v1/channels/:id/ws`) 또는 전체 구독 (`/v1/admin/events/ws`).

```json
{
  "type": "tx_confirmed",
  "channel_id": "ch_abc123",
  "payload": {
    "tx_id": "tx_def456",
    "from": "agent-alice",
    "to": "agent-bob",
    "amount": 1000,
    "memo": "inference fee",
    "latency_ms": 0.42
  },
  "timestamp": 1707321600000
}
```

이벤트 타입: `channel_created` | `tx_confirmed` | `credits_topped_up` | `channel_settled`

## 인증 플로우 (ERC-8004)

```
1. POST /v1/auth/challenge  { "agent_id": "0xABC..." }
   → { "challenge": "a1b2c3...", "expires_at": 1707321630 }

2. 에이전트가 챌린지를 EVM 개인키로 서명 (personal_sign)

3. POST /v1/auth/verify  { "agent_id": "0xABC...", "challenge": "a1b2c3...", "signature": "0x..." }
   → ECDSA 복원 → EVM 주소 일치 확인
   → { "agent_id": "0xABC...", "evm_address": "0xABC...", "verified": true }
   → DB에 EVM 주소 저장 (정산 시 활용)
```

## Pro 모드와의 차이

| | AEL Lite (이 서비스) | AEL Pro |
|---|---|---|
| 원장 | PostgreSQL DB | Hydra UTXO |
| 지연시간 | <1ms | <50ms |
| 에이전트 서명 | 불필요 | 직접 서명 필수 |
| 검증 가능성 | AEL 서버 신뢰 | 온체인 증명 |
| 인프라 | PostgreSQL만 | + Cardano + Hydra |

동일한 API 인터페이스를 공유하므로, 에이전트는 채널 생성 시 `"mode": "lite"` / `"mode": "pro"`만 변경하면 된다.
