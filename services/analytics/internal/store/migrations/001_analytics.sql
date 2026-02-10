-- Analytics service migration: shared DB with Registry.
-- All tables use IF NOT EXISTS since unified service may have already created them.

CREATE TABLE IF NOT EXISTS request_logs (
    id              BIGSERIAL PRIMARY KEY,
    agent_id        UUID NOT NULL REFERENCES agents(id),
    request_id      VARCHAR(64),
    customer_id     VARCHAR(128),
    tool_name       VARCHAR(128),
    method          VARCHAR(8),
    path            TEXT,
    status_code     SMALLINT,
    response_ms     REAL,
    error_type      VARCHAR(64),
    x402_amount     NUMERIC(20,8),
    x402_tx_hash    VARCHAR(66),
    x402_token      VARCHAR(16),
    x402_payer      VARCHAR(42),
    request_body_size  INT,
    response_body_size INT,
    request_body    TEXT,
    response_body   TEXT,
    batch_id        VARCHAR(64),
    sdk_version     VARCHAR(16),
    protocol        VARCHAR(8) DEFAULT 'http',
    source          VARCHAR(8) DEFAULT 'sdk',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reqlog_agent ON request_logs(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reqlog_customer ON request_logs(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reqlog_protocol ON request_logs(agent_id, protocol, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reqlog_tool ON request_logs(agent_id, tool_name, created_at DESC)
  WHERE tool_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reqlog_source_protocol
  ON request_logs(agent_id, source, protocol, created_at DESC);

CREATE TABLE IF NOT EXISTS customers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id        UUID NOT NULL REFERENCES agents(id),
    customer_id     VARCHAR(128) NOT NULL,
    first_seen_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    total_requests  BIGINT DEFAULT 0,
    total_revenue   NUMERIC(20,8) DEFAULT 0,
    avg_response_ms REAL DEFAULT 0,
    error_rate      REAL DEFAULT 0,
    churn_risk      VARCHAR(16) DEFAULT 'low',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(agent_id, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_customers_agent ON customers(agent_id, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_customers_churn ON customers(agent_id, churn_risk);

CREATE TABLE IF NOT EXISTS revenue_entries (
    id              BIGSERIAL PRIMARY KEY,
    agent_id        UUID NOT NULL REFERENCES agents(id),
    customer_id     VARCHAR(128),
    tool_name       VARCHAR(128),
    amount          NUMERIC(20,8) NOT NULL,
    currency        VARCHAR(8) DEFAULT 'USDC',
    tx_hash         VARCHAR(66),
    payer_address   VARCHAR(42),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_revenue_agent ON revenue_entries(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_revenue_agent_created ON revenue_entries(agent_id, created_at);

CREATE TABLE IF NOT EXISTS benchmark_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category VARCHAR(100) NOT NULL,
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    rank INT NOT NULL,
    score DOUBLE PRECISION NOT NULL,
    total_requests BIGINT NOT NULL DEFAULT 0,
    avg_response_ms DOUBLE PRECISION NOT NULL DEFAULT 0,
    error_rate DOUBLE PRECISION NOT NULL DEFAULT 0,
    revenue DOUBLE PRECISION NOT NULL DEFAULT 0,
    customer_count INT NOT NULL DEFAULT 0,
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(category, agent_id)
);

CREATE INDEX IF NOT EXISTS idx_benchmark_category ON benchmark_cache(category, rank);
