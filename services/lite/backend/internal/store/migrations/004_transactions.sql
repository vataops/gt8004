CREATE TABLE transaction_log (
    id              BIGSERIAL PRIMARY KEY,
    channel_id      UUID NOT NULL REFERENCES channels(id),
    tx_id           VARCHAR(128),
    tx_hash         VARCHAR(128),

    from_address    VARCHAR(128),
    to_address      VARCHAR(128),
    amount          BIGINT NOT NULL,
    memo            TEXT,

    latency_ms      REAL,
    status          VARCHAR(16) DEFAULT 'confirmed',

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_txlog_channel ON transaction_log(channel_id, created_at DESC);
CREATE INDEX idx_txlog_created ON transaction_log(created_at DESC);

CREATE TABLE events (
    id              BIGSERIAL PRIMARY KEY,
    event_type      VARCHAR(32) NOT NULL,
    channel_id      UUID REFERENCES channels(id),
    agent_id        UUID REFERENCES agents(id),
    payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_events_type ON events(event_type, created_at DESC);
CREATE INDEX idx_events_created ON events(created_at DESC);

CREATE TABLE operator_wallets (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chain           VARCHAR(16) NOT NULL,
    address         VARCHAR(256) NOT NULL,
    label           VARCHAR(64),
    balance_ada     NUMERIC(20,6),
    balance_usdc    NUMERIC(20,6),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
