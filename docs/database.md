# Database Schema

AEL은 세 개의 서비스(Unified, Open, Lite)가 각각 독립적인 PostgreSQL 스키마를 가진다. **Unified**가 Open + Lite를 통합한 최종 스키마이다.

---

## Unified Service (Primary)

### agents

에이전트 등록 정보, 분석 지표, ERC-8004 온체인 아이덴티티를 통합 관리.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | UUID PK | `uuid_generate_v4()` | 내부 DB ID |
| `agent_id` | VARCHAR(128) UNIQUE | - | 자동 생성 고유 식별자 (gateway endpoint, SDK tenant key) |
| `name` | VARCHAR(128) | - | 에이전트 이름 |
| `evm_address` | VARCHAR(42) | - | 연결된 EVM 지갑 주소 |
| `origin_endpoint` | TEXT | - | 원본 서비스 엔드포인트 URL |
| `gt8004_endpoint` | TEXT | - | 플랫폼 gateway 엔드포인트 (`/v1/agents/{agent_id}`) |
| `protocols` | TEXT[] | `'{}'` | 지원 프로토콜 (a2a, mcp, x402, custom) |
| `category` | VARCHAR(64) | - | 카테고리 (compute, data, inference, storage, other) |
| `pricing_model` | VARCHAR(32) | - | 과금 모델 (per_request, per_token, flat) |
| `pricing_amount` | NUMERIC(20,8) | - | 과금 단가 |
| `pricing_currency` | VARCHAR(8) | `'USDC'` | 통화 |
| `gateway_enabled` | BOOLEAN | `FALSE` | Gateway 프록시 활성화 여부 |
| `status` | VARCHAR(16) | `'active'` | 상태 (active, inactive, deregistered) |
| `reputation_score` | REAL | `0` | 벤치마크 평판 점수 |
| `total_requests` | BIGINT | `0` | 누적 요청 수 |
| `total_revenue_usdc` | NUMERIC(20,6) | `0` | 누적 수익 (USDC) |
| `total_customers` | INT | `0` | 고객 수 |
| `avg_response_ms` | REAL | `0` | 평균 응답 시간 |
| `erc8004_token_id` | BIGINT | - | ERC-8004 토큰 ID |
| `agent_uri` | TEXT | - | 온체인 Agent URI |
| `capabilities` | JSONB | `'[]'` | 에이전트 능력 |
| `identity_registry` | VARCHAR(42) | - | 등록된 레지스트리 컨트랙트 주소 |
| `verified_at` | TIMESTAMPTZ | - | 온체인 검증 시각 |
| `current_tier` | VARCHAR(8) | `'open'` | 티어 (open, lite, pro) |
| `tier_updated_at` | TIMESTAMPTZ | - | 티어 변경 시각 |
| `created_at` | TIMESTAMPTZ | `NOW()` | 생성 시각 |
| `updated_at` | TIMESTAMPTZ | `NOW()` | 수정 시각 |

**Indexes**: `category`, `status`, `evm_address`, `current_tier`

---

### api_keys

에이전트별 API 키. SHA-256 해시로 저장.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | UUID PK | `uuid_generate_v4()` | - |
| `agent_id` | UUID FK → agents(id) | - | ON DELETE CASCADE |
| `key_hash` | VARCHAR(64) | - | SHA-256 해시 |
| `key_prefix` | VARCHAR(16) | - | 키 앞부분 (표시용) |
| `last_used_at` | TIMESTAMPTZ | - | 마지막 사용 시각 |
| `created_at` | TIMESTAMPTZ | `NOW()` | - |
| `revoked_at` | TIMESTAMPTZ | - | 폐기 시각 |

**Indexes**: `key_hash`

---

### request_logs

Gateway를 통한 모든 API 요청 로그. x402 결제 정보 포함.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | BIGSERIAL PK | - | - |
| `agent_id` | UUID FK → agents(id) | - | - |
| `request_id` | VARCHAR(64) | - | 요청 추적 ID |
| `customer_id` | VARCHAR(128) | - | 호출 고객 ID |
| `tool_name` | VARCHAR(128) | - | 호출된 도구/함수명 |
| `method` | VARCHAR(8) | - | HTTP 메서드 |
| `path` | TEXT | - | 요청 경로 |
| `status_code` | SMALLINT | - | 응답 코드 |
| `response_ms` | REAL | - | 응답 시간 (ms) |
| `error_type` | VARCHAR(64) | - | 에러 유형 |
| `x402_amount` | NUMERIC(20,8) | - | x402 결제 금액 |
| `x402_tx_hash` | VARCHAR(66) | - | 결제 트랜잭션 해시 |
| `x402_token` | VARCHAR(16) | - | 결제 토큰 |
| `x402_payer` | VARCHAR(42) | - | 결제자 주소 |
| `request_body_size` | INT | - | 요청 바디 크기 |
| `response_body_size` | INT | - | 응답 바디 크기 |
| `batch_id` | VARCHAR(64) | - | 배치 ID |
| `sdk_version` | VARCHAR(16) | - | SDK 버전 |
| `created_at` | TIMESTAMPTZ | `NOW()` | - |

**Indexes**: `(agent_id, created_at DESC)`, `(customer_id, created_at DESC)`

---

### customers

에이전트별 고객 집계 테이블. request_logs에서 enrichment.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | UUID PK | `uuid_generate_v4()` | - |
| `agent_id` | UUID FK → agents(id) | - | - |
| `customer_id` | VARCHAR(128) | - | 고객 식별자 |
| `first_seen_at` | TIMESTAMPTZ | `NOW()` | 첫 방문 시각 |
| `last_seen_at` | TIMESTAMPTZ | `NOW()` | 마지막 방문 시각 |
| `total_requests` | BIGINT | `0` | 요청 수 |
| `total_revenue` | NUMERIC(20,8) | `0` | 수익 |
| `avg_response_ms` | REAL | `0` | 평균 응답 시간 |
| `error_rate` | REAL | `0` | 에러율 |
| `churn_risk` | VARCHAR(16) | `'low'` | 이탈 위험도 (low, medium, high) |
| `created_at` | TIMESTAMPTZ | `NOW()` | - |
| `updated_at` | TIMESTAMPTZ | `NOW()` | - |

**Unique**: `(agent_id, customer_id)`
**Indexes**: `(agent_id, last_seen_at DESC)`, `(agent_id, churn_risk)`

---

### revenue_entries

개별 수익 이벤트. x402 결제 기록.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | BIGSERIAL PK | - | - |
| `agent_id` | UUID FK → agents(id) | - | - |
| `customer_id` | VARCHAR(128) | - | 고객 ID |
| `tool_name` | VARCHAR(128) | - | 도구명 |
| `amount` | NUMERIC(20,8) | - | 금액 |
| `currency` | VARCHAR(8) | `'USDC'` | 통화 |
| `tx_hash` | VARCHAR(66) | - | 트랜잭션 해시 |
| `payer_address` | VARCHAR(42) | - | 결제자 주소 |
| `created_at` | TIMESTAMPTZ | `NOW()` | - |

**Indexes**: `(agent_id, created_at DESC)`, `(agent_id, created_at)`

---

### benchmark_cache

카테고리별 에이전트 벤치마크 순위. 주기적으로 재계산.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | UUID PK | `gen_random_uuid()` | - |
| `category` | VARCHAR(100) | - | 카테고리 |
| `agent_id` | UUID FK → agents(id) | - | ON DELETE CASCADE |
| `rank` | INT | - | 순위 |
| `score` | DOUBLE PRECISION | - | 종합 점수 |
| `total_requests` | BIGINT | `0` | 요청 수 |
| `avg_response_ms` | DOUBLE PRECISION | `0` | 평균 응답 시간 |
| `error_rate` | DOUBLE PRECISION | `0` | 에러율 |
| `revenue` | DOUBLE PRECISION | `0` | 수익 |
| `customer_count` | INT | `0` | 고객 수 |
| `calculated_at` | TIMESTAMPTZ | `NOW()` | 계산 시각 |

**Unique**: `(category, agent_id)`
**Indexes**: `(category, rank)`

---

## Lite Service (Channels)

Unified에 아직 통합되지 않은 Lite 전용 테이블.

### channels

Hydra Head 기반 오프체인 결제 채널.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | UUID PK | `uuid_generate_v4()` | - |
| `channel_id` | VARCHAR(64) UNIQUE | - | 채널 식별자 |
| `type` | VARCHAR(16) | `'private'` | 채널 타입 |
| `status` | VARCHAR(16) | `'pending'` | 상태 (pending, open, closing, closed, settled) |
| `trust_mode` | VARCHAR(16) | `'managed'` | 신뢰 모드 |
| `hydra_head_id` | VARCHAR(128) | - | Hydra Head ID |
| `hydra_node_url` | VARCHAR(256) | - | Hydra 노드 URL |
| `escrow_channel_hash` | BYTEA | - | 에스크로 채널 해시 |
| `escrow_deposit_tx` | VARCHAR(66) | - | 에스크로 입금 트랜잭션 |
| `total_usdc_deposited` | NUMERIC(20,6) | `0` | 총 USDC 입금액 |
| `credit_policy_id` | VARCHAR(56) | - | CREDIT 토큰 Policy ID (Cardano) |
| `total_credits_minted` | BIGINT | `0` | 발행된 CREDIT 수량 |
| `mint_tx_hash` | VARCHAR(64) | - | 민트 트랜잭션 해시 |
| `total_transactions` | BIGINT | `0` | 총 트랜잭션 수 |
| `avg_latency_ms` | REAL | `0` | 평균 지연 시간 |
| `created_at` | TIMESTAMPTZ | `NOW()` | - |
| `opened_at` | TIMESTAMPTZ | - | 채널 오픈 시각 |
| `closed_at` | TIMESTAMPTZ | - | 채널 종료 시각 |
| `settled_at` | TIMESTAMPTZ | - | 정산 완료 시각 |
| `max_participants` | INT | `10` | 최대 참가자 수 |
| `max_interactions` | BIGINT | `50000` | 최대 상호작용 수 |

**Indexes**: `status`, `(created_at DESC)`

---

### channel_participants

채널 참가자. Cardano 키페어 + CREDIT 잔액 추적.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | UUID PK | `uuid_generate_v4()` | - |
| `channel_id` | UUID FK → channels(id) | - | - |
| `agent_id` | UUID FK → agents(id) | - | - |
| `role` | VARCHAR(16) | `'client'` | 역할 (provider, client) |
| `cardano_address` | VARCHAR(128) | - | Cardano 주소 |
| `cardano_vkey_hash` | VARCHAR(56) | - | 검증 키 해시 |
| `initial_credits` | BIGINT | `0` | 초기 CREDIT 수량 |
| `current_credits` | BIGINT | `0` | 현재 CREDIT 잔액 |
| `settled_usdc` | NUMERIC(20,6) | - | 정산된 USDC |
| `settlement_tx` | VARCHAR(66) | - | 정산 트랜잭션 |
| `status` | VARCHAR(16) | `'active'` | 상태 |
| `joined_at` | TIMESTAMPTZ | `NOW()` | 참여 시각 |
| `left_at` | TIMESTAMPTZ | - | 이탈 시각 |

**Unique**: `(channel_id, agent_id)`
**Indexes**: `channel_id`, `agent_id`

---

## ER Diagram (Unified)

```
agents ─────────┬──── api_keys
  │              │
  ├──── request_logs
  │
  ├──── customers
  │
  ├──── revenue_entries
  │
  └──── benchmark_cache
```

## ER Diagram (Lite)

```
agents ────── channel_participants ────── channels
```

---

## Data Type Conventions

| Convention | Type | Usage |
|-----------|------|-------|
| Primary Key | UUID | `uuid_generate_v4()` or `gen_random_uuid()` |
| 금액 | NUMERIC(20,8) | 소수점 8자리 |
| USDC | NUMERIC(20,6) | 소수점 6자리 (USDC decimals) |
| EVM 주소 | VARCHAR(42) | `0x` + 40 hex chars |
| 트랜잭션 해시 | VARCHAR(66) | `0x` + 64 hex chars |
| 타임스탬프 | TIMESTAMPTZ | 항상 timezone-aware |
| 배열 | TEXT[] | PostgreSQL native array |
| JSON | JSONB | 검색 가능한 JSON |

## Migration Files

| Service | Location |
|---------|----------|
| Unified | `services/unified/backend/internal/store/migrations/` |
| Open | `services/open/backend/internal/store/migrations/` |
| Lite | `services/lite/backend/internal/store/migrations/` |
