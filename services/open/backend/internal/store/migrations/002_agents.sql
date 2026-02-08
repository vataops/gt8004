CREATE TABLE agents (
    id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id              VARCHAR(128) UNIQUE NOT NULL,
    name                  VARCHAR(128),
    evm_address           VARCHAR(42),
    origin_endpoint       TEXT,
    aes_endpoint          TEXT,
    protocols             TEXT[] DEFAULT '{}',
    category              VARCHAR(64),
    pricing_model         VARCHAR(32),
    pricing_amount        NUMERIC(20,8),
    pricing_currency      VARCHAR(8) DEFAULT 'USDC',
    gateway_enabled       BOOLEAN DEFAULT FALSE,
    status                VARCHAR(16) DEFAULT 'active',
    reputation_score      REAL DEFAULT 0,
    total_requests        BIGINT DEFAULT 0,
    total_revenue_usdc    NUMERIC(20,6) DEFAULT 0,
    total_customers       INT DEFAULT 0,
    avg_response_ms       REAL DEFAULT 0,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agents_category ON agents(category);
CREATE INDEX idx_agents_status ON agents(status);

CREATE TABLE api_keys (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id        UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    key_hash        VARCHAR(64) NOT NULL,
    key_prefix      VARCHAR(16) NOT NULL,
    last_used_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at      TIMESTAMPTZ
);

CREATE INDEX idx_apikeys_hash ON api_keys(key_hash);
