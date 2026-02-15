# GT8004 Services

> 마지막 생성: 2026-02-14 (코드 기준 자동 생성)

## 아키텍처 개요

GT8004는 5개의 독립 Go 마이크로서비스로 구성된 ERC-8004 AI 에이전트 비즈니스 인텔리전스 플랫폼이다.

```
┌─────────────┐
│  Dashboard   │ (Next.js 16)
│  :3000       │
└──────┬───────┘
       │ HTTPS
┌──────▼───────┐
│ API Gateway  │ ← 스마트 라우팅
│  :8080       │
└──┬───┬───┬───┘
   │   │   │
┌──▼┐ ┌▼──┐ ┌▼────────┐
│Reg│ │Ana│ │Discovery │
│:80│ │:80│ │ :8080    │
└─┬─┘ └─┬─┘ └────┬────┘
  │     │        │
  ▼     ▼        ▼
┌─────────────────────┐    ┌───────────┐
│   PostgreSQL 16     │    │ ERC-8004  │
│   (공유 DB)          │    │ On-Chain  │
└─────────────────────┘    └───────────┘
       ▲
       │
┌──────┴───────┐
│   Ingest     │ ← SDK/Gateway 로그 수집
│   :9094      │
└──────────────┘
```

- **Registry** — 에이전트 등록, 인증, API 키 관리, 게이트웨이 토글
- **Analytics** — 분석, 벤치마크, 리텐션, GeoIP
- **Discovery** — 온체인 ERC-8004 에이전트 탐색 및 동기화
- **Ingest** — SDK 로그 수집, 게이트웨이 프록시
- **API Gateway** — 리버스 프록시, 경로 기반 스마트 라우팅

## 서비스 의존성 그래프

| 서비스 | 모듈명 | 외부 의존성 |
|--------|--------|-------------|
| Registry | `github.com/GT8004/gt8004` | PostgreSQL, Redis(옵션), go-ethereum, Gin, pgx, zap, Prometheus |
| Analytics | `github.com/GT8004/gt8004-analytics` | PostgreSQL, Redis(옵션), GeoIP, Gin, pgx, zap, Prometheus |
| Discovery | `github.com/GT8004/gt8004-discovery` | PostgreSQL, go-ethereum, Gin, pgx, zap |
| Ingest | `github.com/GT8004/gt8004-ingest` | PostgreSQL, Gin, pgx, zap |
| API Gateway | `github.com/GT8004/apigateway` | Gin, zap |

모든 서비스는 Go 1.24.0, 공유 PostgreSQL DB 사용. **서비스 간 직접 API 호출 없음** — API Gateway가 라우팅을 담당.

---

## Registry Service (`services/registry/backend`)

### 개요
에이전트 등록, 인증(지갑 서명 + API 키), ERC-8004 토큰 검증, 리퓨테이션 조회, 게이트웨이 관리를 담당하는 주 서비스.

### 모듈
`github.com/GT8004/gt8004`

### 초기화 순서
1. 환경 설정 로드
2. PostgreSQL 연결
3. Redis 캐시 연결 (옵션, 실패 시 graceful fallback)
4. ERC-8004 Identity Verifier 초기화
5. WebSocket Hub 생성
6. 멀티 네트워크 ERC-8004 Registry 초기화 (Base Sepolia + Ethereum Sepolia)
7. Handler 생성
8. HTTP 서버 시작
9. Prometheus 메트릭 서버 시작

### API 엔드포인트

| Method | Path | Handler | 설명 |
|--------|------|---------|------|
| GET | `/healthz` | `Healthz` | 헬스 체크 |
| GET | `/readyz` | `Readyz` | 레디니스 체크 |
| GET | `/.well-known/agent.json` | `AgentDescriptor` | ERC-8004 에이전트 디스크립터 |
| POST | `/v1/auth/challenge` | `AuthChallenge` | 지갑 인증 챌린지 요청 |
| POST | `/v1/auth/verify` | `AuthVerify` | 챌린지 서명 검증 |
| POST | `/v1/auth/wallet-login` | `WalletLogin` | 지갑 로그인 |
| GET | `/v1/erc8004/token/:token_id` | `VerifyToken` | ERC-8004 토큰 검증 |
| GET | `/v1/erc8004/tokens/:address` | `ListTokensByOwner` | 소유자별 토큰 목록 |
| GET | `/v1/erc8004/reputation/:token_id/summary` | `GetReputationSummary` | 리퓨테이션 요약 |
| GET | `/v1/erc8004/reputation/:token_id/feedbacks` | `GetReputationFeedbacks` | 리퓨테이션 피드백 |
| POST | `/v1/services/register` | `RegisterService` | 서비스 등록 |
| GET | `/v1/services/:agent_id` | `GetService` | 서비스 상세 (인증 필요) |
| PUT | `/v1/services/:agent_id/tier` | `UpdateTier` | 티어 변경 (인증 필요) |
| PUT | `/v1/services/:agent_id/link-erc8004` | `LinkERC8004` | ERC-8004 토큰 연결 (인증 필요) |
| DELETE | `/v1/services/:agent_id` | `DeregisterService` | 서비스 등록 해제 (인증 필요) |
| POST | `/v1/agents/register` | `RegisterService` | 에이전트 등록 (하위 호환) |
| GET | `/v1/agents/search` | `SearchAgents` | 에이전트 검색 |
| GET | `/v1/agents/wallet/:address` | `ListWalletAgents` | 지갑별 에이전트 목록 |
| GET | `/v1/agents/:agent_id/health` | `AgentHealth` | 에이전트 엔드포인트 헬스 체크 |
| GET | `/v1/agents/:agent_id/origin-health` | `AgentOriginHealth` | 오리진 엔드포인트 헬스 체크 |
| GET | `/v1/proxy/health` | `ServiceHealth` | 프록시 서비스 헬스 (CORS 지원) |
| GET | `/v1/agents/me` | `GetMe` | 현재 인증된 에이전트 (API 키 인증) |
| POST | `/v1/agents/:agent_id/gateway/enable` | `EnableGateway` | 게이트웨이 활성화 (소유자 인증) |
| POST | `/v1/agents/:agent_id/gateway/disable` | `DisableGateway` | 게이트웨이 비활성화 (소유자 인증) |
| POST | `/v1/agents/:agent_id/api-key/regenerate` | `RegenerateAPIKey` | API 키 재발급 (소유자 인증) |
| GET | `/internal/agents/:slug` | `InternalGetAgent` | 에이전트 조회 (내부 API) |
| POST | `/internal/validate-key` | `InternalValidateKey` | API 키 검증 (내부 API) |
| PUT | `/internal/agents/:id/stats` | `InternalUpdateAgentStats` | 에이전트 통계 갱신 (내부 API) |
| PUT | `/internal/agents/:id/customers-count` | `InternalUpdateCustomersCount` | 고객 수 갱신 (내부 API) |

### 핵심 패키지

| 패키지 | 역할 |
|--------|------|
| `internal/handler/` | HTTP 핸들러 (agent, auth, erc8004, apikey, gateway, health, service, internal) |
| `internal/store/` | PostgreSQL 데이터 액세스 레이어 |
| `internal/erc8004/` | 멀티 네트워크 ERC-8004 레지스트리 연동 |
| `internal/cache/` | Redis 캐싱 레이어 |
| `internal/metrics/` | Prometheus 메트릭 |
| `internal/server/` | Gin 라우터 설정, 미들웨어 |
| `internal/config/` | 환경 변수 설정 관리 |

### 환경 변수

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `PORT` | HTTP 서버 포트 | 8080 |
| `METRICS_PORT` | Prometheus 메트릭 포트 | 8081 |
| `LOG_LEVEL` | 로깅 레벨 | debug |
| `DATABASE_URL` | PostgreSQL 연결 문자열 | (필수) |
| `IDENTITY_REGISTRY_ADDRESS` | Identity Registry 컨트랙트 주소 | 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432 |
| `IDENTITY_REGISTRY_RPC` | Identity Registry RPC 엔드포인트 | https://sepolia.base.org |
| `REDIS_URL` | Redis 연결 URL | (옵션) |
| `GT8004_TOKEN_ID` | ERC-8004 토큰 ID | (옵션) |
| `GT8004_AGENT_URI` | 에이전트 메타데이터 URI | (옵션) |
| `GATEWAY_BASE_URL` | 게이트웨이 기본 URL | http://localhost:8080 |

### 의존성

| 라이브러리 | 버전 |
|-----------|------|
| `github.com/GT8004/gt8004-common` | replace → `../../common/go` |
| `github.com/ethereum/go-ethereum` | v1.16.8 |
| `github.com/gin-gonic/gin` | v1.10.0 |
| `github.com/jackc/pgx/v5` | v5.7.2 |
| `github.com/redis/go-redis/v9` | v9.17.3 |
| `github.com/spf13/viper` | v1.19.0 |
| `go.uber.org/zap` | v1.27.0 |
| `github.com/prometheus/client_golang` | v1.20.5 |
| `github.com/gorilla/websocket` | v1.4.2 |

### 빌드
```bash
cd services/registry/backend && go build ./cmd/registryd/
```

---

## Analytics Service (`services/analytics`)

### 개요
에이전트 분석, 성능 메트릭, 매출 추적, 벤치마킹, 고객 분석, 데이터 리텐션을 담당.

### 모듈
`github.com/GT8004/gt8004-analytics`

### 초기화 순서
1. 환경 설정 로드
2. PostgreSQL 연결
3. Redis 캐시 연결 (옵션)
4. Body 리텐션 클린업 잡 시작 (오래된 request body 삭제)
5. 분석 계산기 초기화 (Customer, Revenue, Performance)
6. 벤치마크 계산기 백그라운드 잡 시작
7. Handler 생성
8. HTTP 서버 시작
9. Prometheus 메트릭 서버 시작

### API 엔드포인트

| Method | Path | Handler | 설명 |
|--------|------|---------|------|
| GET | `/healthz` | `Healthz` | 헬스 체크 |
| GET | `/readyz` | `Readyz` | 레디니스 체크 |
| GET | `/v1/dashboard/overview` | `DashboardOverview` | 플랫폼 전체 개요 |
| GET | `/v1/benchmark` | `GetBenchmark` | 벤치마크 데이터 |
| GET | `/v1/agents/:agent_id/analytics` | `AnalyticsReport` | 에이전트 종합 분석 |
| GET | `/v1/agents/:agent_id/stats` | `AgentStats` | 에이전트 통계 |
| GET | `/v1/agents/:agent_id/stats/daily` | `AgentDailyStats` | 에이전트 일별 통계 |
| GET | `/v1/agents/:agent_id/customers` | `ListCustomers` | 고객 목록 |
| GET | `/v1/agents/:agent_id/customers/:customer_id` | `GetCustomer` | 고객 상세 |
| GET | `/v1/agents/:agent_id/customers/:customer_id/logs` | `CustomerLogs` | 고객 요청 로그 |
| GET | `/v1/agents/:agent_id/customers/:customer_id/tools` | `CustomerTools` | 고객 도구 사용량 |
| GET | `/v1/agents/:agent_id/customers/:customer_id/daily` | `CustomerDailyStats` | 고객 일별 통계 |
| GET | `/v1/agents/:agent_id/revenue` | `RevenueReport` | 매출 분석 |
| GET | `/v1/agents/:agent_id/performance` | `PerformanceReport` | 성능 분석 |
| GET | `/v1/agents/:agent_id/logs` | `ListLogs` | 요청 로그 목록 |
| GET | `/v1/agents/:agent_id/funnel` | `ConversionFunnel` | 전환 퍼널 분석 |
| GET | `/v1/wallet/:address/stats` | `WalletStats` | 지갑 소유자 통계 |
| GET | `/v1/wallet/:address/daily` | `WalletDailyStats` | 지갑 일별 통계 |
| GET | `/v1/wallet/:address/errors` | `WalletErrors` | 지갑 에러 로그 |

### 핵심 패키지

| 패키지 | 역할 |
|--------|------|
| `internal/handler/` | HTTP 핸들러 (agent, benchmark, customer, dashboard, logs, performance, revenue, wallet) |
| `internal/store/` | PostgreSQL 데이터 액세스 |
| `internal/analytics/` | 분석 계산기 (customer, revenue, performance, benchmark) |
| `internal/cache/` | Redis 캐싱 |
| `internal/geoip/` | GeoIP DB 핸들링 |
| `internal/retention/` | Request body 리텐션 클린업 |
| `internal/server/` | Gin 라우터 설정 |
| `internal/config/` | 환경 변수 설정 |

### 환경 변수

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `PORT` | HTTP 서버 포트 | 8080 |
| `METRICS_PORT` | Prometheus 메트릭 포트 | 8081 |
| `LOG_LEVEL` | 로깅 레벨 | debug |
| `DATABASE_URL` | PostgreSQL 연결 문자열 | (필수) |
| `REDIS_URL` | Redis 연결 URL | (옵션) |
| `INGEST_WORKERS` | 수집 워커 수 | 4 |
| `INGEST_BUFFER_SIZE` | 수집 버퍼 크기 | 1000 |
| `BENCHMARK_INTERVAL` | 벤치마크 계산 주기 (초) | 300 |
| `MAX_BODY_SIZE_BYTES` | 최대 요청 바디 크기 | 51200 |
| `BODY_RETENTION_DAYS` | 요청 바디 보존 기간 (일) | 30 |
| `GEOIP_DB_PATH` | GeoIP DB 파일 경로 | (옵션) |

### 의존성

| 라이브러리 | 버전 |
|-----------|------|
| `github.com/gin-gonic/gin` | v1.10.0 |
| `github.com/jackc/pgx/v5` | v5.7.2 |
| `github.com/redis/go-redis/v9` | v9.17.3 |
| `github.com/spf13/viper` | v1.19.0 |
| `go.uber.org/zap` | v1.27.0 |
| `github.com/prometheus/client_golang` | v1.20.5 |
| `github.com/oschwald/geoip2-golang` | v1.13.0 |
| `golang.org/x/sync` | v0.12.0 |

### 빌드
```bash
cd services/analytics && go build ./cmd/analyticsd/
```

---

## Discovery Service (`services/discovery`)

### 개요
멀티 네트워크 ERC-8004 온체인 에이전트를 탐색하고 로컬 DB에 동기화하는 서비스.

### 모듈
`github.com/GT8004/gt8004-discovery`

### 초기화 순서
1. 환경 설정 로드
2. PostgreSQL 연결
3. 멀티 네트워크 ERC-8004 Registry 초기화
4. 네트워크 에이전트 동기화 잡 시작 (주기적 온체인 스캔)
5. Handler 생성
6. HTTP 서버 시작

### API 엔드포인트

| Method | Path | Handler | 설명 |
|--------|------|---------|------|
| GET | `/healthz` | `Healthz` | 헬스 체크 |
| GET | `/readyz` | `Readyz` | 레디니스 체크 |
| GET | `/v1/network/agents` | `ListNetworkAgents` | 온체인 에이전트 목록 |
| GET | `/v1/network/agents/:chain_id/:token_id` | `GetNetworkAgent` | 특정 온체인 에이전트 조회 |
| GET | `/v1/network/stats` | `GetNetworkStats` | 네트워크 통계 |

### 핵심 패키지

| 패키지 | 역할 |
|--------|------|
| `internal/handler/` | HTTP 핸들러 (health, network) |
| `internal/store/` | PostgreSQL 데이터 액세스 |
| `internal/erc8004/` | 멀티 네트워크 ERC-8004 레지스트리 연동 |
| `internal/sync/` | 네트워크 에이전트 동기화 잡 |
| `internal/server/` | Gin 라우터 설정 |
| `internal/config/` | 환경 변수 설정 + 네트워크 정의 |

### 환경 변수

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `PORT` | HTTP 서버 포트 | 8080 |
| `LOG_LEVEL` | 로깅 레벨 | debug |
| `DATABASE_URL` | PostgreSQL 연결 문자열 | (필수) |
| `SCAN_SYNC_INTERVAL` | 동기화 주기 (초) | 86400 (24시간) |

### 의존성

| 라이브러리 | 버전 |
|-----------|------|
| `github.com/ethereum/go-ethereum` | v1.16.8 |
| `github.com/gin-gonic/gin` | v1.10.0 |
| `github.com/jackc/pgx/v5` | v5.7.2 |
| `github.com/spf13/viper` | v1.19.0 |
| `go.uber.org/zap` | v1.27.0 |

### 빌드
```bash
cd services/discovery && go build ./cmd/discoveryd/
```

---

## Ingest Service (`services/ingest`)

### 개요
SDK와 게이트웨이에서 발생하는 요청 로그를 수집하고, 게이트웨이 프록시를 통해 오리진 서비스로 요청을 전달하는 서비스.

### 모듈
`github.com/GT8004/gt8004-ingest`

### 초기화 순서
1. 환경 설정 로드
2. PostgreSQL 연결
3. Enricher 초기화 (분석 데이터 보강)
4. Worker Pool 시작 (비동기 요청 처리)
5. Proxy Handler 초기화
6. Rate Limiter 초기화
7. Handler 생성
8. HTTP 서버 시작

### API 엔드포인트

| Method | Path | Handler | 설명 |
|--------|------|---------|------|
| GET | `/healthz` | `Healthz` | 헬스 체크 |
| GET | `/readyz` | `Readyz` | 레디니스 체크 |
| POST | `/v1/ingest` | `IngestLogs` | SDK 로그 수집 (API 키 인증) |
| ANY | `/gateway/:slug/*path` | `GatewayProxy` | 게이트웨이 프록시 (레이트 리밋) |

### 핵심 패키지

| 패키지 | 역할 |
|--------|------|
| `internal/handler/` | HTTP 핸들러 (health, ingest, gateway) |
| `internal/store/` | PostgreSQL 데이터 액세스 |
| `internal/ingest/` | 요청 보강 + Worker Pool |
| `internal/middleware/` | API 키 인증 미들웨어 |
| `internal/proxy/` | HTTP 프록시 + 레이트 리밋 |
| `internal/server/` | Gin 라우터 설정 |
| `internal/config/` | 환경 변수 설정 |

### 환경 변수

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `PORT` | HTTP 서버 포트 | 8080 |
| `LOG_LEVEL` | 로깅 레벨 | info |
| `DATABASE_URL` | PostgreSQL 연결 문자열 | postgres://gt8004:gt8004@postgres:5432/gt8004?sslmode=disable |
| `INGEST_WORKERS` | 수집 워커 수 | 4 |
| `INGEST_BUFFER_SIZE` | 수집 버퍼 크기 | 1000 |
| `MAX_BODY_SIZE_BYTES` | 최대 요청 바디 크기 | 51200 |
| `RATE_LIMIT` | 레이트 리밋 (요청/초) | 10 |
| `RATE_BURST` | 레이트 버스트 허용량 | 100 |

### 의존성

| 라이브러리 | 버전 |
|-----------|------|
| `github.com/gin-gonic/gin` | v1.10.0 |
| `github.com/jackc/pgx/v5` | v5.7.2 |
| `github.com/spf13/viper` | v1.19.0 |
| `go.uber.org/zap` | v1.27.0 |

### 빌드
```bash
cd services/ingest && go build ./cmd/ingestd/
```

---

## API Gateway (`services/apigateway`)

### 개요
클라이언트 요청을 경로 기반으로 적절한 백엔드 서비스(Analytics, Registry, Discovery)로 라우팅하는 리버스 프록시.

### 모듈
`github.com/GT8004/apigateway`

### 초기화 순서
1. 환경 설정 로드 (서비스 URL 포함)
2. 로거 설정
3. Gin 모드 설정
4. 스마트 라우터 구성
5. HTTP 서버 시작

### 라우팅 규칙

| Method | Path | 대상 서비스 | 설명 |
|--------|------|------------|------|
| GET | `/health` | API Gateway | 헬스 체크 |
| ANY | `/v1/dashboard/*path` | Analytics | 대시보드 엔드포인트 |
| ANY | `/v1/benchmark` | Analytics | 벤치마크 |
| ANY | `/v1/wallet/:address/*action` | Analytics | 지갑 분석 |
| ANY | `/v1/agents/:id/stats*` | Analytics | 에이전트 통계 |
| ANY | `/v1/agents/:id/customers*` | Analytics | 고객 분석 |
| ANY | `/v1/agents/:id/revenue*` | Analytics | 매출 분석 |
| ANY | `/v1/agents/:id/performance*` | Analytics | 성능 분석 |
| ANY | `/v1/agents/:id/logs*` | Analytics | 로그 조회 |
| ANY | `/v1/agents/:id/analytics*` | Analytics | 종합 분석 |
| ANY | `/v1/agents/:id/funnel*` | Analytics | 전환 퍼널 |
| ANY | `/v1/network/*path` | Discovery | 네트워크 탐색 |
| ANY | `/*` | Registry | 기본 라우트 (인증, 등록 등) |

### 환경 변수

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `port` | HTTP 서버 포트 | 8080 |
| `analytics_url` | Analytics 서비스 URL | http://analytics:8080 |
| `discovery_url` | Discovery 서비스 URL | http://discovery:8080 |
| `registry_url` | Registry 서비스 URL | http://registry:8080 |
| `log_level` | 로깅 레벨 | info |

### 핵심 패키지

| 패키지 | 역할 |
|--------|------|
| `internal/config/` | 서비스 URL 포함 설정 |
| `internal/middleware/` | 요청/응답 미들웨어 (로깅, CORS) |
| `internal/proxy/` | HTTP 프록시 구현 |
| `internal/router/` | 스마트 라우팅 로직 |

### 의존성

| 라이브러리 | 버전 |
|-----------|------|
| `github.com/gin-gonic/gin` | v1.10.0 |
| `github.com/spf13/viper` | v1.19.0 |
| `go.uber.org/zap` | v1.27.0 |

### 빌드
```bash
cd services/apigateway && go build ./cmd/apigatewayd/
```

---

## 크로스 서비스 패턴

### 서비스 독립성
- 모든 서비스는 독립적이며 **직접적인 서비스 간 API 호출 없음**
- 각 서비스가 PostgreSQL과 온체인 소스에서 직접 데이터 조회
- 블록체인이 에이전트 메타데이터의 **단일 진실 소스(Single Source of Truth)**

### 공유 DB
- Registry, Analytics, Discovery, Ingest 모두 동일한 PostgreSQL DB 사용
- 서비스별 별도 DB 패턴이 아닌 공유 DB 패턴

### 인증 방식
- **API 키 인증**: SDK 및 서비스 간 접근
- **지갑 주소 인증**: 소유자 작업
- **Challenge/Verify**: 지갑 서명 검증

### 캐싱 전략
- Redis는 옵션 (graceful no-op fallback)
- 자주 접근하는 데이터(세션, 메트릭)에 사용
- 운영에 필수적이지 않음

### 네트워크 설정

| Chain ID | 네트워크 | Registry 주소 | RPC |
|----------|---------|--------------|-----|
| 84532 | Base Sepolia | 0x8004A818BFB912233c491871b3d84c89A494BD9e | https://base-sepolia-rpc.publicnode.com |
| 11155111 | Ethereum Sepolia | 0x8004A818BFB912233c491871b3d84c89A494BD9e | https://ethereum-sepolia-rpc.publicnode.com |

---

## 미구현 항목

코드 내 TODO 주석: 발견되지 않음.
