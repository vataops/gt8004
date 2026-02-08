# AEL (Agent Economy Layer) 구현 계획

## Context

AEL은 3티어 프리미엄 모델 (Open → Lite → Pro)로 구성된 AI 에이전트 인프라 플랫폼.

- **AEL Open (무료)**: SDK 기반 비즈니스 인텔리전스 — 트래픽, 수익, 고객 분석, 성능 모니터링
- **AEL Lite (서버 모드)**: DB가 원장, Hydra 없음, <1ms, 최저 비용, AEL 신뢰 필요
- **AEL Pro (Hydra 모드)**: Hydra UTXO가 원장, 에이전트 직접 서명, <50ms, 검증 가능

**현재 진행**: AEL Open (Phase 1A Foundation) 구현 중.
**디렉토리 구조**: `open/`, `lite/`, `pro/`, `common/` 4개 디렉토리로 재구성.

**기술 스택**: Go (백엔드) / Next.js (대시보드) / TypeScript SDK / Aiken (CREDIT, Pro 전용) / Solidity (Escrow) / PostgreSQL

---

# Part 1: AEL Open 구현 계획

## Overview

SDK 5줄로 연동 → 비즈니스 인텔리전스 대시보드. 에이전트 운영자가 자신의 에이전트를 모니터링하는 "Stripe Dashboard for AI Agents".

**핵심 온보딩 흐름**:
```
npm install @ael-network/sdk
→ AELLogger 초기화 (agentId + apiKey)
→ Express/Fastify 미들웨어 연결
→ 로그 자동 배치 전송 (/v1/ingest)
→ 대시보드에서 통계 확인
```

## 재구성된 디렉토리 구조

```
/AEL/
├── common/
│   ├── go/                        # 공유 Go 패키지 (module: github.com/AEL/ael-common)
│   │   ├── go.mod
│   │   ├── identity/identity.go   # ERC-8004 검증 (lite에서 추출)
│   │   ├── ws/hub.go              # WebSocket hub (lite에서 추출)
│   │   ├── ws/hub_test.go
│   │   └── types/types.go         # 공유 타입 (Agent 등)
│   │
│   └── sdk/                       # TypeScript SDK (@ael-network/sdk)
│       ├── package.json
│       ├── tsconfig.json
│       ├── tsup.config.ts
│       └── src/
│           ├── index.ts
│           ├── logger.ts          # AELLogger 클래스
│           ├── client.ts          # AELClient 클래스 (Phase 1F)
│           ├── transport.ts       # 비동기 배치 전송
│           ├── middleware/
│           │   ├── express.ts     # Express 미들웨어
│           │   └── fastify.ts     # Fastify 플러그인 (Phase 1F)
│           └── types.ts
│
├── open/
│   ├── backend/                   # Go (Gin) — module: github.com/AEL/ael-open
│   │   ├── go.mod
│   │   ├── cmd/aesd/main.go
│   │   ├── Dockerfile
│   │   ├── Makefile
│   │   └── internal/
│   │       ├── config/config.go
│   │       ├── server/
│   │       │   ├── server.go
│   │       │   ├── router.go
│   │       │   └── middleware.go    # API key 인증
│   │       ├── handler/
│   │       │   ├── handler.go       # DI 구조체
│   │       │   ├── agent.go         # 에이전트 등록
│   │       │   ├── ingest.go        # POST /v1/ingest
│   │       │   ├── dashboard.go     # 대시보드 집계
│   │       │   ├── auth.go          # ERC-8004 인증
│   │       │   └── health.go
│   │       ├── ingest/
│   │       │   ├── parser.go        # 배치 파싱
│   │       │   ├── enricher.go      # 데이터 추출 + INSERT
│   │       │   └── worker.go        # 백그라운드 워커 풀
│   │       ├── store/
│   │       │   ├── store.go         # pgx 연결 풀
│   │       │   ├── agent.go         # 에이전트 CRUD
│   │       │   ├── apikey.go        # API 키 관리
│   │       │   ├── request_log.go   # 배치 INSERT + 통계
│   │       │   ├── overview.go      # 대시보드 집계
│   │       │   └── migrations/
│   │       │       ├── 001_init.sql
│   │       │       ├── 002_agents.sql
│   │       │       └── 003_request_logs.sql
│   │       └── metrics/metrics.go
│   │
│   ├── dashboard/                   # Next.js (lite 대시보드 확장)
│   │   └── src/
│   │       ├── app/
│   │       │   ├── layout.tsx
│   │       │   └── page.tsx         # Overview 대시보드
│   │       ├── lib/
│   │       │   ├── api.ts
│   │       │   └── hooks.ts
│   │       └── components/
│   │           ├── StatCard.tsx
│   │           └── DataTable.tsx
│   │
│   ├── docker-compose.yml
│   └── .env.example
│
├── lite/backend/                    # 기존 유지 (identity/, ws/ → common/ 참조로 변경)
├── pro/backend/                     # 기존 유지 (변경 없음)
├── contracts/                       # 기존 유지
└── README.md
```

## AEL Open 구현 순서 (Sub-Phases)

### Phase 1A — Foundation (MVP) ← 현재 진행 중

SDK로 로그를 보내고, 대시보드에서 기본 통계를 보는 최소 동작 단위.

**1. common/go 추출** ✅ 완료
- `lite/backend/internal/identity/` → `common/go/identity/` 이동
- `lite/backend/internal/ws/` → `common/go/ws/` 이동
- `common/go/go.mod` 생성 (module: `github.com/AEL/ael-common`)
- `common/go/types/types.go` 생성 (공유 Agent 타입)
- `lite/backend` import 경로 변경 + 빌드 확인 ✅

**2. common/sdk TypeScript 패키지** 🔄 진행 중
- `AELLogger` 클래스: `new AELLogger({ agentId, apiKey })` → `.middleware()` 반환
- Express 미들웨어: req/res 래핑, 응답 시간 측정, x402 헤더 추출, 고객 ID 추출
- `BatchTransport`: 내부 버퍼 → 50건 또는 5초마다 `POST /v1/ingest`로 전송
- 재시도: 지수 백오프 (1s, 2s, 4s), circuit breaker
- `package.json`, `tsconfig.json`, `tsup.config.ts` (ESM/CJS 듀얼 빌드)

**3. open/backend 코어** 🔄 진행 중
- `config.go`: PORT, DATABASE_URL, LOG_LEVEL, INGEST_WORKERS 등
- `main.go`: DB 연결 → Store → Identity → Hub → Handler → Server
- `server/router.go`: 라우트 정의
- `server/middleware.go`: API key 인증 미들웨어
- `handler/agent.go`: `POST /v1/agents/register` → 에이전트 생성 + API 키 발급
- `handler/ingest.go`: `POST /v1/ingest` → 배치 파싱 → 워커에 제출 → 202 Accepted
- `handler/dashboard.go`: `GET /v1/agents/:id/stats` → 기본 통계
- `handler/auth.go`: ERC-8004 챌린지/검증
- `handler/health.go`: `/healthz`, `/readyz`
- `ingest/parser.go`, `enricher.go`, `worker.go`
- `store/store.go`, `agent.go`, `apikey.go`, `request_log.go`, `overview.go`
- `migrations/001_init.sql`, `002_agents.sql`, `003_request_logs.sql`

**4. open/dashboard MVP** ⏳ 대기
- `layout.tsx`: Open 전용 사이드바 네비게이션
- `page.tsx`: Overview — StatCard 4개 + 최근 요청 테이블
- `lib/api.ts`: Open API 클라이언트
- `lib/hooks.ts`: usePolling 패턴

**5. 인프라** ⏳ 대기
- `docker-compose.yml`: backend + dashboard + postgres
- `.env.example`, `Makefile`

### Phase 1B — Customer Intelligence + Revenue

- `ingest/enricher.go` 확장: 고객 프로필 자동 생성, revenue_entries INSERT
- `store/customer.go`, `store/revenue.go`
- `analytics/customer.go`: 코호트 분석, 이탈 리스크 계산
- `analytics/revenue.go`: ARPU, LTV, 가격 추천
- `handler/customer.go`, `handler/revenue.go`
- `migrations/004_customers.sql`, `005_revenue.sql`
- Dashboard: `customers/`, `revenue/` 페이지

### Phase 1C — Performance + Alerts

- `analytics/performance.go`: p50/p95/p99, 에러율, RPS
- `alert/engine.go`: 주기적 룰 평가 (60초)
- `alert/notifier.go`: Webhook/Slack/Email
- `handler/performance.go`, `handler/alert.go`
- `migrations/006_alerts.sql`
- Dashboard: `performance/`, `alerts/` 페이지

### Phase 1D — Discovery + Benchmark

- `handler/discovery.go`: 에이전트 검색 API
- `analytics/benchmark.go`: 카테고리별 랭킹 (백그라운드 5분 주기)
- `handler/benchmark.go`
- `migrations/007_benchmarks.sql`
- Dashboard: `discovery/`, `benchmark/` 페이지

### Phase 1E — Gateway (Optional)

- `gateway/proxy.go`: `httputil.ReverseProxy` 리버스 프록시
- `gateway/ratelimit.go`: 토큰 버킷
- `handler/gateway.go`

### Phase 1F — SDK Client + Polish

- `common/sdk/src/client.ts`: `AELClient`
- `common/sdk/src/middleware/fastify.ts`: Fastify 플러그인
- Dashboard: `logs/page.tsx`, 차트 (Recharts)

## Phase 1A 완료 검증

1. `cd common/go && go build ./...` — 공통 패키지 빌드 ✅
2. `cd lite/backend && go build ./...` — lite 빌드 (import 경로 변경 후) ✅
3. `cd common/sdk && npm run build` — SDK 빌드
4. `cd open/backend && go build ./...` — open 백엔드 빌드
5. `docker-compose up` (open/) — backend + dashboard + postgres 기동
6. SDK로 에이전트 등록 → API 키 수신 → 미들웨어 연동 → 로그 전송 → 대시보드에서 통계 확인

---

# Part 2: AEL Lite/Pro 구현 계획 (기존)

---

## Lite/Pro 서비스 티어 비교

| | AEL Lite | AEL Pro |
|---|---|---|
| 원장 | AEL 서버 DB | Hydra UTXO |
| 지연시간 | <1ms | <50ms |
| 비용 | 최저 | 약간 높음 |
| 에이전트 서명 | 불필요 | 직접 서명 |
| 검증 가능성 | ❌ (AEL 신뢰) | ✅ (온체인 증명) |
| 분쟁 해결 | AEL 중재 | Hydra 스냅샷 증명 |
| 인프라 의존 | PostgreSQL만 | PostgreSQL + Cardano + Hydra |

---

## Lite/Pro 디렉토리 구조

**Lite와 Pro는 완전히 분리된 코드베이스**로 관리한다.

```
/AEL
├── lite/                        # ── AEL Lite (DB 기반) ──
│   ├── backend/                 # Go — module: github.com/AEL/ael-lite
│   │   ├── Dockerfile
│   │   ├── go.mod
│   │   ├── cmd/aesd/main.go
│   │   └── internal/
│   │       ├── config/          # Viper 기반 환경 설정
│   │       ├── server/          # Gin 라우터, 미들웨어
│   │       ├── handler/         # HTTP 핸들러
│   │       ├── channel/         # 채널 엔진 (DB 기반)
│   │       │   ├── engine.go    # Engine 인터페이스 + 타입
│   │       │   └── lite.go      # LiteEngine 구현
│   │       ├── x402/            # x402 결제 미들웨어
│   │       ├── identity/        # ERC-8004 신원 검증
│   │       ├── evm/             # Escrow 컨트랙트 Go 바인딩
│   │       ├── settlement/      # CREDIT→USDC 정산
│   │       ├── store/           # PostgreSQL + 마이그레이션
│   │       └── metrics/         # Prometheus
│   ├── dashboard/               # Next.js — 모니터링 대시보드
│   │   └── src/app/             # App Router 페이지
│   ├── docker-compose.yml       # PostgreSQL + backend + dashboard
│   ├── Makefile
│   └── .env.example
│
├── pro/                         # ── AEL Pro (Hydra 기반) ──
│   ├── backend/                 # Go — module: github.com/AEL/ael-pro
│   │   ├── Dockerfile
│   │   ├── go.mod
│   │   ├── cmd/aesd/main.go
│   │   └── internal/
│   │       ├── config/
│   │       ├── server/
│   │       ├── handler/
│   │       ├── channel/         # 채널 엔진 (Hydra 기반)
│   │       │   ├── engine.go    # Engine 인터페이스 + 타입
│   │       │   └── pro.go       # ProEngine 구현 (Phase 2)
│   │       ├── hydra/           # Hydra 노드 WebSocket 클라이언트
│   │       ├── cardano/         # 키 생성, CREDIT 민팅
│   │       ├── evm/             # Escrow 컨트랙트 Go 바인딩
│   │       ├── settlement/
│   │       ├── store/
│   │       └── metrics/
│   ├── dashboard/               # Next.js (Phase 2)
│   ├── infra/                   # Hydra/Cardano 노드 설정
│   │   ├── hydra/
│   │   └── cardano/
│   ├── docker-compose.yml       # + cardano-node + hydra-node
│   ├── Makefile
│   └── .env.example
│
├── contracts/                   # ── 공유 스마트 컨트랙트 ──
│   ├── escrow/                  # Solidity (Foundry) — Base Sepolia
│   │   ├── src/AELEscrow.sol
│   │   └── test/
│   └── credit/                  # Aiken — CREDIT 민팅 (Pro 전용)
│       └── validators/credit.ak
├── scripts/                     # 개발/배포 스크립트
├── README.md
└── plans.md
```

---

## 핵심 아키텍처 결정

1. **채널 매니저는 인터페이스로 추상화**: `ChannelEngine` 인터페이스를 정의, `LiteEngine`(DB)과 `ProEngine`(Hydra)이 각각 구현
2. **Lite 모드에서 DB가 원장**: 잔액, TX 기록 모두 PostgreSQL에 저장. 즉시 확정 (<1ms)
3. **Pro 모드에서 Hydra UTXO가 원장**: DB는 스냅샷 캐시 용도. 에이전트 직접 서명 필수
4. **API 레이어는 모드 무관**: 핸들러가 `ChannelEngine`을 호출, 내부 구현만 다름
5. **Lite 먼저 구현, Pro는 후에 추가**: Lite로 전체 플로우를 검증한 뒤 Hydra를 얹음

### ChannelEngine 인터페이스

```go
type ChannelEngine interface {
    CreateChannel(ctx, req) (*Channel, error)
    GetChannel(ctx, channelID) (*Channel, error)
    SendTransaction(ctx, channelID, txReq) (*TxResult, error)
    TopupCredits(ctx, channelID, amount) error
    CloseChannel(ctx, channelID) (*Settlement, error)
}

// LiteEngine — DB 기반, Lite 모드
// ProEngine  — Hydra 기반, Pro 모드 (나중에 구현)
```

---

## 데이터베이스 스키마

### channels 테이블
| 컬럼 | 설명 |
|------|------|
| `mode` | `'lite'` 또는 `'pro'` |
| `status` | pending → active → closing → settled |
| `total_usdc_deposited` | Escrow에 예치된 USDC |
| `total_credits_minted` | 발행된 CREDIT |
| `hydra_head_id` | [Pro 전용] Hydra Head ID |

### Lite 전용: credit_balances 테이블 (DB가 원장)
| 컬럼 | 설명 |
|------|------|
| `channel_id` | FK → channels |
| `agent_id` | FK → agents |
| `balance` | 현재 CREDIT 잔액 (원자적 업데이트) |

### 기타 (이전과 동일)
- `agents`, `channel_participants`, `transaction_log`, `events`, `operator_wallets`

---

## API 엔드포인트 (Lite/Pro 공통)

### Public API (에이전트용)
```
POST   /v1/channels                    # 채널 생성 (mode: lite|pro, x402 결제)
GET    /v1/channels/:id                # 채널 상태 조회
POST   /v1/channels/:id/topup         # 크레딧 충전 (x402)
POST   /v1/channels/:id/close         # 채널 종료 + 정산
POST   /v1/channels/:id/tx            # Lite: 즉시 처리 / Pro: unsigned tx 반환
POST   /v1/channels/:id/tx/submit     # [Pro 전용] 서명된 tx 제출
GET    /v1/channels/:id/ws            # WebSocket (고빈도)
POST   /v1/auth/challenge             # ERC-8004 챌린지
POST   /v1/auth/verify                # 서명 검증
```

**Lite 모드 TX 플로우 (심플):**
```
POST /tx { from, to, amount, memo }
→ 서버가 DB 잔액 확인 → 차감/가산 → 즉시 confirmed 응답
```

**Pro 모드 TX 플로우 (서명 필요):**
```
POST /tx { from, to, amount, memo }
→ unsigned tx 반환
POST /tx/submit { tx_hash, signature }
→ Hydra 제출 → confirmed 응답
```

### Admin API (대시보드용) — 이전과 동일

---

## 스마트 컨트랙트

### Escrow (Solidity on Base Sepolia) — Lite/Pro 공통
- 모든 모드에서 USDC 담보 보관. Lite든 Pro든 Escrow에 예치
- `deposit()`, `topup()`, `settle()`, `exitParticipant()`, `emergencyWithdraw()`

### CREDIT 민팅 정책 (Aiken) — Pro 전용
- Lite는 DB에서 CREDIT 잔액을 추적하므로 온체인 토큰 불필요
- Pro에서만 Cardano 네이티브 토큰으로 민팅

---

## 인프라 (Docker Compose)

### `lite/docker-compose.yml` (Phase 1)
| 서비스 | 이미지/빌드 | 포트 |
|--------|-------------|------|
| `backend` | `./backend` (Go) | 8080, 8081 |
| `dashboard` | `./dashboard` (Next.js) | 3000 |
| `postgres` | `postgres:16-alpine` | 5432 |

**Lite는 Cardano/Hydra 노드 없이 동작한다.** 외부 서비스: Base Sepolia RPC, x402 Facilitator

### `pro/docker-compose.yml` (Phase 2)
| 서비스 | 이미지/빌드 | 포트 |
|--------|-------------|------|
| `backend` | `./backend` (Go) | 8080, 8081 |
| `dashboard` | `./dashboard` (Next.js) | 3000 |
| `postgres` | `postgres:16-alpine` | 5432 |
| `cardano-node` | `ghcr.io/intersectmbo/cardano-node:10.1.4` | — |
| `hydra-node` | `ghcr.io/cardano-scaling/hydra-node:0.20.0` | 4001, 5001 |

---

## 구현 순서

### Phase 1: AEL Lite MVP + 대시보드 ← 현재 목표

**Step 1: 기반 구축** ✅ 완료
- [x] 전체 디렉토리 구조 생성
- [x] Go 모듈 초기화 + 서버 스켈레톤 (Gin 라우터, config, handler, store)
- [x] DB 마이그레이션 SQL
- [x] Docker Compose (PostgreSQL + backend + dashboard)
- [x] Makefile
- [x] Next.js 대시보드 + 페이지들
- [x] Escrow 컨트랙트 (Solidity) + CREDIT 정책 (Aiken) 초안

**Step 2: Lite 채널 엔진** ✅ 완료
- [x] `ChannelEngine` 인터페이스 정의 (`channel/engine.go`)
- [x] `LiteEngine` 구현 (`channel/lite.go`)
  - DB 트랜잭션으로 잔액 원자적 이동
  - 채널 생성: DB에 채널 + 참여자 + 초기 잔액 기록
  - TX 처리: 발신자 잔액 차감 + 수신자 잔액 가산 (단일 DB tx)
  - 채널 종료: 최종 잔액 기준 정산 데이터 생성
- [x] `credit_balances` 테이블 추가 마이그레이션 (`005_lite_mode.sql`)
- [x] Lite 모드 TX 핸들러 (서명 없이 즉시 처리)
- [x] Handler에 ChannelEngine 주입 + docker-compose Lite 전용 모드 업데이트

**Step 3: 결제 + 인증** ✅ 완료
- [x] x402 결제 미들웨어 (채널 생성, 충전 시) — `x402/middleware.go`
- [x] ERC-8004 신원 검증 — `identity/identity.go` (챌린지-응답 + ECDSA 서명 복원)
- [x] Escrow 컨트랙트 연동 (Go 바인딩) — `evm/escrow.go` (deposit/topup/settle)
- [x] Handler 연결 + 라우터 x402 미들웨어 적용 + main.go 초기화

**Step 4: 채널 라이프사이클 완성** ✅ 완료
- [x] 채널 REST 핸들러 (생성/조회/충전/종료) — Lite 엔진 완전 연결 + WS 이벤트 브로드캐스트
- [x] 정산 플로우 — `settlement/settlement.go` (DB agent EVM 주소 조회 → Escrow.Settle 호출)
- [x] 에이전트 EVM 주소 저장 — 인증 성공 시 `store.UpdateAgentEVMAddress()` 호출
- [x] WebSocket API — `ws/hub.go` (채널별 구독 + 글로벌 Admin 구독, ping/pong, gorilla/websocket)
- [x] ChannelWebSocket + AdminEventsWebSocket 핸들러 구현

**Step 5: 대시보드 연동** ✅ 완료
- [x] Admin API 엔드포인트 실제 구현 (DB 쿼리) — store 레이어 (overview, channel, agent, event, escrow)
- [x] 실시간 이벤트 WebSocket — `useEventStream()` hook → `WsEvent` 타입으로 정렬
- [x] 프론트엔드 `trust_mode` → `mode` 반영, `ChannelDetail` 타입 (잔액 포함)
- [x] Channel 상세 페이지에 Credit Balances 테이블 추가
- [x] 대시보드 빌드 통과 확인

**Step 6: 통합 테스트** ✅ 완료
- [x] LiteEngine 풀 라이프사이클 테스트 (`lite_test.go`): 채널 생성 → TX → 잔액 확인 → 과잉인출 방지 → 충전 → 종료 → 정산
- [x] 다중 TX 테스트: 50건 연속 TX → 잔액/통계 검증
- [x] Handler HTTP 테스트 (`handler_test.go`): mock engine으로 Create/TX/Close/NotFound/BadRequest
- [x] WebSocket Hub 테스트 (`hub_test.go`): 채널 구독 브로드캐스트 + 글로벌 구독
- [x] `go test ./...` 전체 통과

### Phase 2: AEL Pro (Hydra 모드)

**Step 7: Pro 엔진**
- [ ] `ProEngine` 구현 (`channel/pro.go`)
- [ ] Hydra 클라이언트 (WebSocket, Init/Close/NewTx)
- [ ] Cardano 키 매니저 (Ed25519 키페어 생성)
- [ ] CREDIT 토큰 민팅 (Blockfrost + cardano-cli)
- [ ] unsigned tx 구성 + 서명 검증 + Hydra 제출
- [ ] Docker Compose에 cardano-node + hydra-node 추가

**Step 8: Pro 정산**
- [ ] Hydra Close → Fanout → 최종 UTXO 읽기
- [ ] CREDIT 잔액 기준 Escrow settle
- [ ] CREDIT 번 (burn)

### Phase 3~4: (README 로드맵대로)
- 다자간 채널, 풀 채널, 스케일링, 프로덕션 준비

### 의존성 그래프
```
Phase 1 (Lite):
[1] 기반 ✅ ──→ [2] Lite엔진 ──→ [3] 결제+인증 ──→ [4] 라이프사이클 ──→ [6] 통합
                                                    ↗
                               [5] 대시보드 연동 ──→

Phase 2 (Pro):
[4] 라이프사이클 ──→ [7] Pro엔진 ──→ [8] Pro 정산
```

---

## 검증 방법

### Phase 1 (Lite)
1. **백엔드**: `go test ./...`
2. **대시보드**: `npm run build`
3. **E2E**: `docker compose up` (backend + postgres + dashboard만) → curl로 채널 생성 → TX → 정산 → 대시보드 확인
4. **컨트랙트**: `forge test` (Escrow)

### Phase 2 (Pro)
1. 위 + Hydra/Cardano 연동 테스트
2. `aiken check` (CREDIT 정책)
3. Lite/Pro 동일 API로 동작 확인
