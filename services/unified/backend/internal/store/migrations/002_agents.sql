-- Unified agents table: merges Open analytics fields + Lite ERC-8004 fields
CREATE TABLE agents (
    id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id              VARCHAR(128) UNIQUE NOT NULL,
    name                  VARCHAR(128),
    evm_address           VARCHAR(42),
    origin_endpoint       TEXT,
    gt8004_endpoint          TEXT,
    protocols             TEXT[] DEFAULT '{}',
    category              VARCHAR(64),

    -- Pricing (Open)
    pricing_model         VARCHAR(32),
    pricing_amount        NUMERIC(20,8),
    pricing_currency      VARCHAR(8) DEFAULT 'USDC',

    -- Gateway (Open)
    gateway_enabled       BOOLEAN DEFAULT FALSE,
    status                VARCHAR(16) DEFAULT 'active',

    -- Analytics (Open)
    reputation_score      REAL DEFAULT 0,
    total_requests        BIGINT DEFAULT 0,
    total_revenue_usdc    NUMERIC(20,6) DEFAULT 0,
    total_customers       INT DEFAULT 0,
    avg_response_ms       REAL DEFAULT 0,

    -- ERC-8004 identity (Lite)
    erc8004_token_id      BIGINT,
    agent_uri             TEXT,
    capabilities          JSONB DEFAULT '[]'::jsonb,
    identity_registry     VARCHAR(42),
    verified_at           TIMESTAMPTZ,

    -- Tier tracking (Unified)
    current_tier          VARCHAR(8) NOT NULL DEFAULT 'open',
    tier_updated_at       TIMESTAMPTZ,

    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agents_category ON agents(category);
CREATE INDEX idx_agents_status ON agents(status);
CREATE INDEX idx_agents_evm ON agents(evm_address);
CREATE INDEX idx_agents_tier ON agents(current_tier);

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
