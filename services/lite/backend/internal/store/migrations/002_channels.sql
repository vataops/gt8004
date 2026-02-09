CREATE TABLE channels (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    channel_id           VARCHAR(64) UNIQUE NOT NULL,
    type                 VARCHAR(16) NOT NULL DEFAULT 'private',
    status               VARCHAR(16) NOT NULL DEFAULT 'pending',
    trust_mode           VARCHAR(16) NOT NULL DEFAULT 'managed',

    -- Escrow (Base chain)
    escrow_channel_hash  BYTEA,
    escrow_deposit_tx    VARCHAR(66),
    total_usdc_deposited NUMERIC(20,6) DEFAULT 0,

    -- CREDIT
    total_credits_minted BIGINT DEFAULT 0,

    -- Stats
    total_transactions   BIGINT DEFAULT 0,
    avg_latency_ms       REAL DEFAULT 0,

    -- Lifecycle
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    opened_at            TIMESTAMPTZ,
    closed_at            TIMESTAMPTZ,
    settled_at           TIMESTAMPTZ,

    -- Config
    max_participants     INT DEFAULT 10,
    max_interactions     BIGINT DEFAULT 50000
);

CREATE INDEX idx_channels_status ON channels(status);
CREATE INDEX idx_channels_created ON channels(created_at DESC);
