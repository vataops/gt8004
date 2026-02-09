# GT8004 (Agent Economy Layer) 구현 계획

## Context

GT8004는 AI 에이전트를 위한 비즈니스 인텔리전스 플랫폼 + Escrow 결제 보호 기능을 제공한다.

- **GT8004 플랫폼 (무료)**: SDK 기반 비즈니스 인텔리전스 — 트래픽, 수익, 고객 분석, 성능 모니터링
- **Escrow (결제 보호)**: DB가 원장, <1ms, 마일스톤 기반 정산

**현재 진행**: 플랫폼 (Phase 1A Foundation) 구현 중.
**디렉토리 구조**: `services/open/`, `services/lite/`, `services/unified/`, `common/` 디렉토리로 구성.

**기술 스택**: Go (백엔드) / Next.js (대시보드) / TypeScript SDK / Solidity (Escrow) / PostgreSQL

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

# Part 2: Escrow 구현 계획

---

## Escrow 채널 아키텍처

DB 기반 Escrow 결제 보호. PostgreSQL을 원장으로 사용하여 <1ms 지연시간으로 에이전트 간 CREDIT 전송을 처리한다.

---

## 핵심 아키텍처 결정

1. **채널 매니저는 인터페이스로 추상화**: `ChannelEngine` 인터페이스를 정의, `LiteEngine`(DB)이 구현
2. **DB가 원장**: 잔액, TX 기록 모두 PostgreSQL에 저장. 즉시 확정 (<1ms)
3. **API 레이어는 모드 무관**: 핸들러가 `ChannelEngine`을 호출

### ChannelEngine 인터페이스

```go
type ChannelEngine interface {
    CreateChannel(ctx, req) (*Channel, error)
    GetChannel(ctx, channelID) (*Channel, error)
    SendTransaction(ctx, channelID, txReq) (*TxResult, error)
    TopupCredits(ctx, channelID, amount) error
    CloseChannel(ctx, channelID) (*Settlement, error)
}
```

---

## 데이터베이스 스키마

### channels 테이블
| 컬럼 | 설명 |
|------|------|
| `mode` | `'lite'` |
| `status` | pending → active → closing → settled |
| `total_usdc_deposited` | Escrow에 예치된 USDC |
| `total_credits_minted` | 발행된 CREDIT |

### credit_balances 테이블 (DB가 원장)
| 컬럼 | 설명 |
|------|------|
| `channel_id` | FK → channels |
| `agent_id` | FK → agents |
| `balance` | 현재 CREDIT 잔액 (원자적 업데이트) |

### 기타
- `agents`, `channel_participants`, `transaction_log`, `events`, `operator_wallets`

---

## API 엔드포인트

### Public API (에이전트용)
```
POST   /v1/channels                    # 채널 생성 (x402 결제)
GET    /v1/channels/:id                # 채널 상태 조회
POST   /v1/channels/:id/topup         # 크레딧 충전 (x402)
POST   /v1/channels/:id/close         # 채널 종료 + 정산
POST   /v1/channels/:id/tx            # 즉시 처리
GET    /v1/channels/:id/ws            # WebSocket (고빈도)
POST   /v1/auth/challenge             # ERC-8004 챌린지
POST   /v1/auth/verify                # 서명 검증
```

### Admin API (대시보드용) — 이전과 동일

---

## 스마트 컨트랙트

### Escrow (Solidity on Base Sepolia)
- USDC 담보 보관. Escrow에 예치
- `deposit()`, `topup()`, `settle()`, `exitParticipant()`, `emergencyWithdraw()`

---

## 인프라 (Docker Compose)

### `lite/docker-compose.yml`
| 서비스 | 이미지/빌드 | 포트 |
|--------|-------------|------|
| `backend` | `./backend` (Go) | 8080, 8081 |
| `dashboard` | `./dashboard` (Next.js) | 3000 |
| `postgres` | `postgres:16-alpine` | 5432 |

외부 서비스: Base Sepolia RPC, x402 Facilitator

---

## 구현 순서

### Phase 1: Escrow MVP + 대시보드 ✅ 완료

**Step 1: 기반 구축** ✅ 완료
- [x] 전체 디렉토리 구조 생성
- [x] Go 모듈 초기화 + 서버 스켈레톤 (Gin 라우터, config, handler, store)
- [x] DB 마이그레이션 SQL
- [x] Docker Compose (PostgreSQL + backend + dashboard)
- [x] Makefile
- [x] Next.js 대시보드 + 페이지들
- [x] Escrow 컨트랙트 (Solidity) 초안

**Step 2: 채널 엔진** ✅ 완료
- [x] `ChannelEngine` 인터페이스 정의 (`channel/engine.go`)
- [x] `LiteEngine` 구현 (`channel/lite.go`)
- [x] `credit_balances` 테이블 추가 마이그레이션 (`005_lite_mode.sql`)
- [x] TX 핸들러 (서명 없이 즉시 처리)

**Step 3: 결제 + 인증** ✅ 완료
- [x] x402 결제 미들웨어
- [x] ERC-8004 신원 검증
- [x] Escrow 컨트랙트 연동 (Go 바인딩)

**Step 4: 채널 라이프사이클 완성** ✅ 완료
- [x] 채널 REST 핸들러 + WS 이벤트 브로드캐스트
- [x] 정산 플로우
- [x] WebSocket API

**Step 5: 대시보드 연동** ✅ 완료

**Step 6: 통합 테스트** ✅ 완료
- [x] `go test ./...` 전체 통과

---

## 검증 방법

1. **백엔드**: `go test ./...`
2. **대시보드**: `npm run build`
3. **E2E**: `docker compose up` → curl로 채널 생성 → TX → 정산 → 대시보드 확인
4. **컨트랙트**: `forge test` (Escrow)
