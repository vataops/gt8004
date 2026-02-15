# Database Schema

> 마지막 생성: 2026-02-14 (코드 기준 자동 생성)

## 개요

GT8004는 PostgreSQL 16을 사용하며, 모든 서비스가 하나의 공유 DB에 접근한다. 스키마는 서비스별 마이그레이션 파일로 관리된다.

- **Registry**: 21개 마이그레이션 (에이전트, 인증, 로그, 고객, 매출, 알림, 벤치마크, 네트워크, 리뷰, 리퓨테이션)
- **Analytics**: 5개 마이그레이션 (request_logs 보강, 고객 geo)
- **Discovery**: 3개 마이그레이션 (network_agents, 변경 이력, creator 추적)

---

## Registry 테이블

### agents

에이전트 등록 정보. 모든 서비스의 핵심 테이블.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| id | UUID | uuid_generate_v4() | 기본 키 |
| agent_id | VARCHAR(128) | | 고유 에이전트 ID (UNIQUE) |
| name | VARCHAR(128) | | 에이전트 이름 |
| evm_address | VARCHAR(42) | | EVM 지갑 주소 |
| origin_endpoint | TEXT | | 오리진 API 엔드포인트 (A2A/MCP) |
| gt8004_endpoint | TEXT | | GT8004 서비스 엔드포인트 |
| protocols | TEXT[] | '{}' | 지원 프로토콜 배열 |
| category | VARCHAR(64) | | 에이전트 카테고리 |
| pricing_model | VARCHAR(32) | | 가격 모델 |
| pricing_amount | NUMERIC(20,8) | | 가격 |
| pricing_currency | VARCHAR(8) | 'USDC' | 통화 코드 |
| gateway_enabled | BOOLEAN | FALSE | 게이트웨이 활성화 |
| status | VARCHAR(16) | 'active' | 상태 |
| reputation_score | REAL | 0 | 리퓨테이션 점수 |
| total_requests | BIGINT | 0 | 누적 요청 수 |
| total_revenue_usdc | NUMERIC(20,6) | 0 | 총 매출 (USDC) |
| total_customers | INT | 0 | 고유 고객 수 |
| avg_response_ms | REAL | 0 | 평균 응답 시간 |
| erc8004_token_id | BIGINT | | ERC-8004 토큰 ID |
| agent_uri | TEXT | | 에이전트 메타데이터 URI |
| capabilities | JSONB | '[]'::jsonb | 에이전트 기능 JSON |
| identity_registry | VARCHAR(42) | | Identity Registry 컨트랙트 |
| verified_at | TIMESTAMPTZ | | 검증 타임스탬프 |
| current_tier | VARCHAR(8) | 'open' | 서비스 티어 (open/lite/pro) |
| tier_updated_at | TIMESTAMPTZ | | 마지막 티어 변경 |
| sdk_connected_at | TIMESTAMPTZ | | SDK 연결 타임스탬프 |
| chain_id | INT | 0 | 블록체인 네트워크 ID |
| created_at | TIMESTAMPTZ | NOW() | 생성 시각 |
| updated_at | TIMESTAMPTZ | NOW() | 수정 시각 |

**인덱스:**
- `idx_agents_category` ON agents(category)
- `idx_agents_status` ON agents(status)
- `idx_agents_evm` ON agents(evm_address)
- `idx_agents_tier` ON agents(current_tier)

---

### api_keys

API 키 관리. 에이전트 인증에 사용.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| id | UUID | uuid_generate_v4() | 기본 키 |
| agent_id | UUID | | FK → agents(id) ON DELETE CASCADE |
| key_hash | VARCHAR(64) | | 해시된 API 키 |
| key_prefix | VARCHAR(16) | | 키 프리픽스 (표시용) |
| last_used_at | TIMESTAMPTZ | | 마지막 사용 시각 |
| created_at | TIMESTAMPTZ | NOW() | 생성 시각 |
| revoked_at | TIMESTAMPTZ | | 폐기 시각 |

**인덱스:**
- `idx_apikeys_hash` ON api_keys(key_hash)

---

### request_logs

요청 로그. SDK 및 게이트웨이에서 수집된 모든 요청 기록.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| id | BIGSERIAL | | 기본 키 |
| agent_id | UUID | | FK → agents(id) |
| request_id | VARCHAR(64) | | 요청 추적 ID |
| customer_id | VARCHAR(128) | | 고객 식별자 (IP) |
| tool_name | VARCHAR(128) | | 도구/함수 이름 |
| method | VARCHAR(8) | | HTTP 메서드 |
| path | TEXT | | 요청 경로 |
| status_code | SMALLINT | | HTTP 상태 코드 |
| response_ms | REAL | | 응답 시간 (ms) |
| error_type | VARCHAR(64) | | 에러 분류 |
| x402_amount | NUMERIC(20,8) | | 402 결제 금액 |
| x402_tx_hash | VARCHAR(66) | | 트랜잭션 해시 |
| x402_token | VARCHAR(16) | | 토큰 심볼 |
| x402_payer | VARCHAR(42) | | 지불자 지갑 주소 |
| request_body_size | INT | | 요청 바디 크기 (bytes) |
| response_body_size | INT | | 응답 바디 크기 (bytes) |
| request_body | TEXT | | 요청 바디 전문 |
| response_body | TEXT | | 응답 바디 전문 |
| batch_id | VARCHAR(64) | | 배치 처리 ID |
| sdk_version | VARCHAR(16) | | SDK 버전 |
| protocol | VARCHAR(8) | 'http' | 프로토콜 (http/mcp/a2a) |
| source | VARCHAR(8) | 'sdk' | 소스 (sdk/gateway) |
| headers | JSONB | | 요청 헤더 JSON |
| ip_address | VARCHAR(45) | | 클라이언트 IP |
| user_agent | TEXT | | User-Agent 헤더 |
| referer | TEXT | | Referer 헤더 |
| content_type | VARCHAR(128) | | Content-Type 헤더 |
| accept_language | VARCHAR(128) | | Accept-Language 헤더 |
| country | VARCHAR(2) | | GeoIP 국가 코드 |
| city | VARCHAR(128) | | GeoIP 도시명 |
| created_at | TIMESTAMPTZ | NOW() | 요청 시각 |

**인덱스:**
- `idx_reqlog_agent` ON request_logs(agent_id, created_at DESC)
- `idx_reqlog_customer` ON request_logs(customer_id, created_at DESC)
- `idx_reqlog_protocol` ON request_logs(agent_id, protocol, created_at DESC)
- `idx_reqlog_tool` ON request_logs(agent_id, tool_name, created_at DESC) WHERE tool_name IS NOT NULL
- `idx_reqlog_source_protocol` ON request_logs(agent_id, source, protocol, created_at DESC)
- `idx_reqlog_headers` ON request_logs USING GIN (headers) WHERE headers IS NOT NULL
- `idx_reqlog_ip` ON request_logs(ip_address, created_at DESC) WHERE ip_address IS NOT NULL
- `idx_reqlog_country` ON request_logs(agent_id, country, created_at DESC) WHERE country IS NOT NULL

---

### customers

고객(에이전트 사용자) 분석 데이터.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| id | UUID | uuid_generate_v4() | 기본 키 |
| agent_id | UUID | | FK → agents(id) |
| customer_id | VARCHAR(128) | | 고객 식별자 (IP) |
| first_seen_at | TIMESTAMPTZ | NOW() | 첫 상호작용 |
| last_seen_at | TIMESTAMPTZ | NOW() | 마지막 상호작용 |
| total_requests | BIGINT | 0 | 요청 수 |
| total_revenue | NUMERIC(20,8) | 0 | 누적 매출 |
| avg_response_ms | REAL | 0 | 평균 응답 시간 |
| error_rate | REAL | 0 | 에러율 |
| churn_risk | VARCHAR(16) | 'low' | 이탈 위험도 (low/medium/high) |
| country | VARCHAR(64) | '' | GeoIP 국가 |
| city | VARCHAR(128) | '' | GeoIP 도시 |
| created_at | TIMESTAMPTZ | NOW() | 생성 시각 |
| updated_at | TIMESTAMPTZ | NOW() | 수정 시각 |

**제약조건:** UNIQUE(agent_id, customer_id)

**인덱스:**
- `idx_customers_agent` ON customers(agent_id, last_seen_at DESC)
- `idx_customers_churn` ON customers(agent_id, churn_risk)
- `idx_customers_country` ON customers(agent_id, country)

---

### revenue_entries

매출 기록. x402 결제 정보 포함.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| id | BIGSERIAL | | 기본 키 |
| agent_id | UUID | | FK → agents(id) |
| customer_id | VARCHAR(128) | | 고객 식별자 |
| tool_name | VARCHAR(128) | | 도구 이름 |
| amount | NUMERIC(20,8) | | 매출 금액 |
| currency | VARCHAR(8) | 'USDC' | 통화 코드 |
| tx_hash | VARCHAR(66) | | 블록체인 트랜잭션 해시 |
| payer_address | VARCHAR(42) | | 지불자 지갑 주소 |
| created_at | TIMESTAMPTZ | NOW() | 거래 시각 |

**인덱스:**
- `idx_revenue_agent` ON revenue_entries(agent_id, created_at DESC)
- `idx_revenue_agent_created` ON revenue_entries(agent_id, created_at)

---

### alert_rules

알림 규칙. 메트릭 기반 임계값 모니터링.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| id | UUID | gen_random_uuid() | 기본 키 |
| agent_id | UUID | | FK → agents(id) ON DELETE CASCADE |
| name | VARCHAR(255) | | 알림 이름 |
| type | VARCHAR(50) | | 알림 유형 (performance/customer/revenue) |
| metric | VARCHAR(100) | | 모니터링 메트릭 |
| operator | VARCHAR(10) | | 비교 연산자 (gt/lt/gte/lte/eq) |
| threshold | DOUBLE PRECISION | | 임계값 |
| window_minutes | INT | 60 | 집계 윈도우 (분) |
| webhook_url | TEXT | | 웹훅 알림 URL |
| enabled | BOOLEAN | TRUE | 활성화 여부 |
| created_at | TIMESTAMPTZ | NOW() | 생성 시각 |
| updated_at | TIMESTAMPTZ | NOW() | 수정 시각 |

**인덱스:**
- `idx_alert_rules_agent` ON alert_rules(agent_id)
- `idx_alert_rules_enabled` ON alert_rules(agent_id, enabled)

---

### alert_history

알림 발생 이력.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| id | UUID | gen_random_uuid() | 기본 키 |
| rule_id | UUID | | FK → alert_rules(id) ON DELETE CASCADE |
| agent_id | UUID | | FK → agents(id) ON DELETE CASCADE |
| metric_value | DOUBLE PRECISION | | 관측된 메트릭 값 |
| threshold | DOUBLE PRECISION | | 발생 시 임계값 |
| message | TEXT | | 알림 메시지 |
| notified | BOOLEAN | FALSE | 알림 발송 여부 |
| created_at | TIMESTAMPTZ | NOW() | 알림 시각 |

**인덱스:**
- `idx_alert_history_rule` ON alert_history(rule_id)
- `idx_alert_history_agent` ON alert_history(agent_id, created_at DESC)

---

### benchmark_cache

벤치마크 캐시. 카테고리별 에이전트 랭킹.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| id | UUID | gen_random_uuid() | 기본 키 |
| category | VARCHAR(100) | | 에이전트 카테고리 |
| agent_id | UUID | | FK → agents(id) ON DELETE CASCADE |
| rank | INT | | 카테고리 내 순위 |
| score | DOUBLE PRECISION | | 벤치마크 점수 |
| total_requests | BIGINT | 0 | 요청 수 |
| avg_response_ms | DOUBLE PRECISION | 0 | 평균 응답 시간 |
| error_rate | DOUBLE PRECISION | 0 | 에러율 |
| revenue | DOUBLE PRECISION | 0 | 매출 |
| customer_count | INT | 0 | 고객 수 |
| calculated_at | TIMESTAMPTZ | NOW() | 계산 시각 |

**제약조건:** UNIQUE(category, agent_id)

**인덱스:**
- `idx_benchmark_category` ON benchmark_cache(category, rank)

---

### network_agents

온체인 ERC-8004 에이전트 동기화 데이터.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| id | UUID | uuid_generate_v4() | 기본 키 |
| chain_id | INT | | 블록체인 네트워크 ID |
| token_id | BIGINT | | ERC-8004 토큰 ID |
| owner_address | VARCHAR(42) | | 소유자 지갑 주소 |
| agent_uri | TEXT | | 에이전트 메타데이터 URI |
| name | TEXT | '' | 에이전트 이름 |
| description | TEXT | '' | 에이전트 설명 |
| image_url | TEXT | '' | 에이전트 이미지 URL |
| metadata | JSONB | '{}' | 전체 메타데이터 JSON |
| creator_address | VARCHAR(42) | '' | 생성자 지갑 주소 |
| created_tx | VARCHAR(66) | '' | 생성 트랜잭션 해시 |
| created_at | TIMESTAMPTZ | NOW() | 레코드 생성 시각 |
| synced_at | TIMESTAMPTZ | NOW() | 마지막 동기화 시각 |

**제약조건:** UNIQUE(chain_id, token_id)

**인덱스:**
- `idx_network_agents_chain` ON network_agents(chain_id)
- `idx_network_agents_owner` ON network_agents(owner_address)

---

### agent_reviews

에이전트 리뷰. 1일 1리뷰 중복 제거.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| id | UUID | gen_random_uuid() | 기본 키 |
| agent_id | UUID | | FK → agents(id) |
| reviewer_id | TEXT | | 리뷰어 식별자 |
| score | SMALLINT | | 리뷰 점수 (1-5) |
| tags | TEXT[] | '{}' | 리뷰 태그 배열 |
| comment | TEXT | '' | 리뷰 코멘트 |
| created_at | TIMESTAMPTZ | NOW() | 리뷰 시각 |

**제약조건:**
- CHECK (score BETWEEN 1 AND 5)
- UNIQUE(agent_id, reviewer_id, epoch_day(created_at)) — 1일 1리뷰

**인덱스:**
- `idx_agent_reviews_agent_id` ON agent_reviews(agent_id)
- `idx_agent_reviews_reviewer` ON agent_reviews(reviewer_id)

**SQL 함수:**
```sql
CREATE OR REPLACE FUNCTION epoch_day(ts TIMESTAMPTZ) RETURNS INT
LANGUAGE SQL IMMUTABLE PARALLEL SAFE AS $$
  SELECT (floor(extract(epoch FROM ts) / 86400))::int
$$;
```

---

### reputation_breakdown

리퓨테이션 점수 세부 분해. 에이전트당 1행.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| agent_id | UUID | | FK → agents(id) UNIQUE |
| reliability | FLOAT | 0 | 신뢰성 점수 |
| performance | FLOAT | 0 | 성능 점수 |
| activity | FLOAT | 0 | 활동 점수 |
| revenue_quality | FLOAT | 0 | 매출 품질 점수 |
| customer_retention | FLOAT | 0 | 고객 유지 점수 |
| peer_review | FLOAT | 0 | 피어 리뷰 점수 |
| onchain_score | FLOAT | 0 | 온체인 리퓨테이션 점수 |
| total_score | FLOAT | 0 | 총 리퓨테이션 점수 |
| onchain_count | INT | 0 | 온체인 리뷰 수 |
| review_count | INT | 0 | 피어 리뷰 수 |
| calculated_at | TIMESTAMPTZ | NOW() | 계산 시각 |

---

## Analytics 테이블

Analytics 서비스의 마이그레이션은 기존 Registry 테이블에 컬럼을 추가하는 형태:

### 002: request_logs에 headers 추가
- `headers` JSONB — 요청 헤더 JSON
- GIN 인덱스 추가

### 003: request_logs에 클라이언트 메타데이터 추가
- `ip_address` VARCHAR(45)
- `user_agent` TEXT
- `referer` TEXT
- `content_type` VARCHAR(128)
- `accept_language` VARCHAR(128)
- `country` VARCHAR(2) — GeoIP
- `city` VARCHAR(128) — GeoIP

### 004: customers에 geo 추가
- `country` VARCHAR(64) DEFAULT ''
- `city` VARCHAR(128) DEFAULT ''

### 005: request_logs에서 customer_id 제거
- `customer_id` 컬럼 삭제 — `ip_address`로 고객 식별 통합

---

## Discovery 테이블

### network_agents (Discovery DB)

Registry의 `network_agents`와 동일한 스키마. Discovery 서비스는 별도 DB 또는 공유 DB에서 동일 테이블 사용.

### network_agent_history

온체인 에이전트 변경 이력 추적.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| id | BIGSERIAL | | 기본 키 |
| chain_id | INT | | 블록체인 네트워크 ID |
| token_id | BIGINT | | ERC-8004 토큰 ID |
| change_type | VARCHAR(32) | | 변경 유형 |
| old_value | JSONB | | 이전 상태 |
| new_value | JSONB | | 새 상태 |
| created_at | TIMESTAMPTZ | NOW() | 변경 시각 |

**인덱스:**
- `idx_nah_chain_token` ON network_agent_history(chain_id, token_id, created_at DESC)
- `idx_nah_change_type` ON network_agent_history(change_type, created_at DESC)

---

## ER Diagram

```
agents ─────────┬──< api_keys
  │             ├──< request_logs
  │             ├──< customers
  │             ├──< revenue_entries
  │             ├──< alert_rules ──< alert_history
  │             ├──< benchmark_cache
  │             ├──< agent_reviews
  │             └──── reputation_breakdown (1:1)
  │
network_agents (독립) ──< network_agent_history
```

## Data Type Conventions

| 규칙 | 설명 |
|------|------|
| UUID | 기본 키 (`uuid_generate_v4()` 또는 `gen_random_uuid()`) |
| TIMESTAMPTZ | 모든 타임스탬프 (UTC) |
| NUMERIC(20,8) | 금액 (소수점 8자리) |
| VARCHAR(42) | EVM 주소 (0x + 40 hex) |
| VARCHAR(66) | 트랜잭션 해시 (0x + 64 hex) |
| JSONB | 구조화되지 않은 메타데이터 |
| TEXT[] | 태그/프로토콜 배열 |
| REAL/FLOAT | 점수, 비율, 평균 |
| BIGINT/BIGSERIAL | 카운터, 시퀀스 |

## Migration Files

### Registry (`services/registry/backend/internal/store/migrations/`)
001_init.sql — 021_sdk_connected.sql (21개 파일)

### Analytics (`services/analytics/internal/store/migrations/`)
001_analytics.sql — 005_drop_request_logs_customer_id.sql (5개 파일)

### Discovery (`services/discovery/internal/store/migrations/`)
001_network_agents.sql — 003_agent_creator_tx.sql (3개 파일)
