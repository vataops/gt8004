# Customer Data Collection

에이전트에 요청을 보내는 customer(호출자)에 대한 데이터 수집, 저장, 조회 구조를 정리한 문서.

---

## 1. 데이터 수집 경로

Customer 데이터는 두 가지 경로로 수집된다:

```
[Customer] → Gateway Proxy → Analytics (Internal Ingest)
[Customer] → Agent SDK Middleware → Analytics (API Key Ingest)
```

### Gateway 경로 (source: `gateway`)

1. Customer가 `GET /gateway/{slug}/{path}` 로 요청
2. Gateway가 agent origin으로 프록시하면서 요청/응답 메타데이터 캡처
3. `LogEntry` 구조체에 데이터를 담아 `POST /internal/ingest` 로 Analytics 서비스에 비동기 전송
4. Analytics의 Enricher가 `request_logs` 테이블에 INSERT, `customers` 테이블에 UPSERT

### SDK 경로 (source: `sdk`)

1. Agent가 SDK 미들웨어를 사용해 수신 요청을 자동 로깅
2. SDK가 `LogBatch`를 모아서 `POST /v1/ingest` (API Key 인증)로 Analytics에 전송
3. 이후 동일한 Enricher 파이프라인으로 처리

---

## 2. 저장 테이블

### 2-1. `request_logs` — 개별 요청 로그

모든 HTTP 요청이 1행씩 저장된다. Customer별 상세 이력 조회의 기반 데이터.

| 컬럼 | 타입 | 설명 | 수집 출처 |
|------|------|------|----------|
| `id` | BIGSERIAL | PK | 자동생성 |
| `agent_id` | UUID | 요청을 받은 에이전트 (FK → agents) | Gateway/SDK |
| `request_id` | VARCHAR(64) | 요청별 고유 ID (UUID) | Gateway/SDK |
| `customer_id` | VARCHAR(128) | 호출자 식별자 (클라이언트 IP 주소) | Gateway/SDK |
| `tool_name` | VARCHAR(128) | 호출된 도구/엔드포인트 (URL 마지막 세그먼트) | Gateway/SDK |
| `method` | VARCHAR(8) | HTTP 메서드 (GET, POST 등) | Gateway/SDK |
| `path` | TEXT | 요청 경로 | Gateway/SDK |
| `status_code` | SMALLINT | HTTP 응답 코드 | Gateway/SDK |
| `response_ms` | REAL | 응답 시간 (밀리초) | Gateway/SDK |
| `error_type` | VARCHAR(64) | 에러 유형 (있는 경우) | SDK |
| `protocol` | VARCHAR(8) | 프로토콜 (`http`, `mcp`, `a2a`) | Gateway/SDK |
| `source` | VARCHAR(8) | 수집 출처 (`gateway` 또는 `sdk`) | 자동판별 |
| `ip_address` | VARCHAR(45) | 클라이언트 IP (IPv4/IPv6) | Gateway |
| `user_agent` | TEXT | User-Agent 헤더 | Gateway |
| `referer` | TEXT | Referer 헤더 | Gateway |
| `content_type` | VARCHAR(128) | Content-Type 헤더 | Gateway |
| `accept_language` | VARCHAR(128) | Accept-Language 헤더 | Gateway |
| `country` | VARCHAR(2) | GeoIP 국가 코드 (ISO 3166-1 alpha-2) | Enricher (IP→GeoIP) |
| `city` | VARCHAR(128) | GeoIP 도시명 | Enricher (IP→GeoIP) |
| `headers` | JSONB | 전체 요청 헤더 (선택적) | Gateway |
| `request_body` | TEXT | 요청 본문 (선택적, 최대 50KB) | Gateway/SDK |
| `response_body` | TEXT | 응답 본문 (선택적, 최대 50KB) | Gateway/SDK |
| `request_body_size` | INT | 요청 본문 크기 (바이트) | Gateway/SDK |
| `response_body_size` | INT | 응답 본문 크기 (바이트) | Gateway/SDK |
| `x402_amount` | NUMERIC(20,8) | x402 결제 금액 | Gateway/SDK |
| `x402_tx_hash` | VARCHAR(66) | 결제 트랜잭션 해시 | Gateway/SDK |
| `x402_token` | VARCHAR(16) | 결제 토큰 주소 | Gateway/SDK |
| `x402_payer` | VARCHAR(42) | 결제자 EVM 주소 | Gateway/SDK |
| `batch_id` | VARCHAR(64) | 배치 ID (여러 로그를 묶은 단위) | Gateway/SDK |
| `sdk_version` | VARCHAR(16) | SDK/Gateway 버전 | Gateway/SDK |
| `created_at` | TIMESTAMPTZ | 저장 시각 | 자동생성 |

**인덱스:**
- `(agent_id, created_at DESC)` — 에이전트별 최신 로그 조회
- `(customer_id, created_at DESC)` — 고객별 최신 로그 조회
- `(agent_id, protocol, created_at DESC)` — 프로토콜별 분석
- `(agent_id, tool_name, created_at DESC)` — 도구별 분석 (partial: tool_name IS NOT NULL)
- `(agent_id, source, protocol, created_at DESC)` — 소스+프로토콜 복합
- `(ip_address, created_at DESC)` — IP별 조회 (partial: ip_address IS NOT NULL)
- `(agent_id, country, created_at DESC)` — 국가별 분석 (partial: country IS NOT NULL)
- `headers` GIN — JSONB 헤더 검색 (partial: headers IS NOT NULL)

### 2-2. `customers` — 고객 집계 테이블

에이전트별 고유 customer를 추적하는 집계 테이블. `request_logs` 인입 시 자동으로 UPSERT.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | UUID | PK |
| `agent_id` | UUID | 에이전트 (FK → agents) |
| `customer_id` | VARCHAR(128) | 고객 식별자 (클라이언트 IP 주소) |
| `first_seen_at` | TIMESTAMPTZ | 최초 요청 시각 |
| `last_seen_at` | TIMESTAMPTZ | 최근 요청 시각 |
| `total_requests` | BIGINT | 누적 요청 수 |
| `total_revenue` | NUMERIC(20,8) | 누적 매출 (USDC) |
| `avg_response_ms` | REAL | 평균 응답 시간 |
| `error_rate` | REAL | 에러율 (0.0 ~ 1.0) |
| `churn_risk` | VARCHAR(16) | 이탈 위험도 (`low`, `medium`, `high`) |
| `country` | VARCHAR(64) | GeoIP 국가 (IP → GeoIP 변환) |
| `city` | VARCHAR(128) | GeoIP 도시 (IP → GeoIP 변환) |
| `created_at` | TIMESTAMPTZ | 레코드 생성 시각 |
| `updated_at` | TIMESTAMPTZ | 최근 갱신 시각 |

**UNIQUE 제약조건:** `(agent_id, customer_id)` — 에이전트당 customer는 1행.

**Churn Risk 기준:**
- `low`: 7일 이내 활동
- `medium`: 7~14일 비활동
- `high`: 14일 이상 비활동

---

## 3. Customer 식별 방식

Customer는 **클라이언트 IP 주소**로 식별된다.

```
GET /gateway/my-agent/api/chat HTTP/1.1
X-Forwarded-For: 203.0.113.42    ← 이 IP가 customer_id로 저장됨
```

**IP 추출 우선순위** (Gateway 및 SDK 동일):
1. `X-Forwarded-For` 헤더의 첫 번째 IP
2. `X-Real-IP` 헤더
3. TCP socket의 `RemoteAddr`

**GeoIP 연동**: IP 주소는 Enricher에서 GeoIP DB를 통해 국가/도시로 변환되어 `customers` 테이블의 `country`, `city` 컬럼에 저장된다.

**제한사항**:
- NAT/프록시 뒤의 여러 사용자가 동일 IP로 집계될 수 있음
- VPN 사용 시 실제 위치와 다를 수 있음
- IP가 없는 경우: `customer_id = NULL` → customers 테이블에는 미집계

---

## 4. 데이터 저장 흐름 (Ingest Pipeline)

```
Gateway/SDK
    │
    ▼
LogBatch { agent_id, entries: []LogEntry }
    │
    ▼ POST /internal/ingest (Gateway) 또는 POST /v1/ingest (SDK)
    │
    ▼
IngestWorker (4 goroutines, buffer: 1000)
    │
    ▼
Enricher.Process()
    ├── 1. LogEntry → RequestLog 변환 (본문 50KB 초과 시 자동 truncate)
    ├── 2. request_logs 테이블에 배치 INSERT
    ├── 3. agents 테이블 통계 갱신 (total_requests, total_revenue)
    ├── 4. customers 테이블 UPSERT (customer_id별 집계)
    ├── 5. revenue_entries 테이블에 x402 결제 기록 INSERT
    └── 6. Redis 캐시 무효화 (agent:*:* 패턴)
```

### UPSERT 로직 (customers)

```sql
INSERT INTO customers (agent_id, customer_id, total_requests, total_revenue, avg_response_ms, error_rate, country, city, last_seen_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
ON CONFLICT (agent_id, customer_id) DO UPDATE SET
    total_requests  = customers.total_requests + EXCLUDED.total_requests,
    total_revenue   = customers.total_revenue + EXCLUDED.total_revenue,
    avg_response_ms = EXCLUDED.avg_response_ms,
    error_rate      = EXCLUDED.error_rate,
    country         = CASE WHEN EXCLUDED.country != '' THEN EXCLUDED.country ELSE customers.country END,
    city            = CASE WHEN EXCLUDED.city != '' THEN EXCLUDED.city ELSE customers.city END,
    last_seen_at    = NOW(),
    updated_at      = NOW()
```

- `total_requests`, `total_revenue`: 누적 합산 (+=)
- `avg_response_ms`, `error_rate`: 최신 배치의 값으로 덮어쓰기
- `first_seen_at`: INSERT 시에만 설정 (UPDATE 시 변경 안 됨)

---

## 5. 조회 API

### Customer 리스트
```
GET /v1/agents/:agent_id/customers?limit=50&offset=0
→ { customers: Customer[], total: number }
```

### Customer 상세
```
GET /v1/agents/:agent_id/customers/:customer_id
→ Customer
```

### Customer 요청 로그
```
GET /v1/agents/:agent_id/customers/:customer_id/logs?limit=50
→ { logs: RequestLog[], total: number }
```
- IP, User-Agent, Referer 등 client metadata 포함

### Customer 도구 사용 통계
```
GET /v1/agents/:agent_id/customers/:customer_id/tools
→ { tools: CustomerToolUsage[] }
```
- tool_name별 call_count, avg_response_ms, error_rate, revenue 집계

### Customer 일별 통계
```
GET /v1/agents/:agent_id/customers/:customer_id/daily?days=30
→ { stats: DailyStats[] }
```
- 일별 requests, errors, revenue 시계열 데이터

---

## 6. GeoIP 해석

IP 주소를 국가/도시로 변환하는 GeoIP 해석은 Analytics Enricher에서 수행된다.

- **라이브러리**: `github.com/oschwald/geoip2-golang`
- **DB**: DB-IP City Lite (`.mmdb` 포맷, 무료)
- **경로**: `GEOIP_DB_PATH` 환경변수 (Docker: `/data/GeoLite2-City.mmdb`)
- **동작**: IP가 있고 country가 아직 없는 엔트리에 대해 자동 해석
- **제외**: loopback, private, unspecified IP는 건너뜀 (Docker 내부 네트워크 등)
- **graceful degradation**: DB 파일이 없으면 해석 없이 정상 동작

DB 파일 위치: `data/geoip/GeoLite2-City.mmdb` (Docker volume mount)

---

## 7. 미구현 항목

| 항목 | 상태 | 비고 |
|------|------|------|
| Rate Limit 상태 기록 | 미구현 | 현재 429 응답 시 로그 자체가 생성되지 않음 |
| Customer Identity Resolution | 프론트엔드에서 부분 구현 | customer_id가 EVM 주소 형식이면 Etherscan 링크 제공 |

---

## 8. 관련 파일

| 파일 | 역할 |
|------|------|
| `services/gateway/internal/handler/gateway.go` | 요청 프록시 + 메타데이터 캡처 |
| `services/gateway/internal/client/analytics.go` | LogEntry/LogBatch 구조체 + Analytics 전송 |
| `services/analytics/internal/ingest/parser.go` | LogEntry 파싱 (JSON → struct) |
| `services/analytics/internal/ingest/enricher.go` | LogEntry → RequestLog 변환 + DB 저장 |
| `services/analytics/internal/store/customer.go` | customers 테이블 CRUD |
| `services/analytics/internal/store/request_log.go` | request_logs 테이블 CRUD + 분석 쿼리 |
| `services/analytics/internal/handler/customer.go` | Customer API 핸들러 |
| `services/analytics/internal/store/migrations/001_analytics.sql` | 기본 스키마 (request_logs, customers) |
| `services/analytics/internal/geoip/geoip.go` | IP → country/city GeoIP 해석 |
| `services/analytics/internal/store/migrations/003_client_metadata.sql` | IP/UA/GeoIP 컬럼 추가 |
| `dashboard/src/lib/api.ts` | 프론트엔드 타입 정의 + API 클라이언트 |
| `dashboard/src/lib/hooks.ts` | React 커스텀 훅 (useCustomerLogs 등) |
