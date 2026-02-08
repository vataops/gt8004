CREATE TABLE agents (
    id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id              VARCHAR(128) UNIQUE NOT NULL,
    evm_address           VARCHAR(42),

    -- ERC-8004 identity (cached)
    erc8004_token_id      BIGINT,
    agent_uri             TEXT,
    reputation_score      REAL,
    capabilities          JSONB DEFAULT '[]'::jsonb,

    -- Verification
    verified_at           TIMESTAMPTZ,
    identity_registry     VARCHAR(42),

    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agents_evm ON agents(evm_address);

CREATE TABLE channel_participants (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    channel_id          UUID NOT NULL REFERENCES channels(id),
    agent_id            UUID NOT NULL REFERENCES agents(id),
    role                VARCHAR(16) NOT NULL DEFAULT 'client',

    -- Cardano keypair for this channel session
    cardano_address     VARCHAR(128) NOT NULL,
    cardano_vkey_hash   VARCHAR(56) NOT NULL,

    -- Credit tracking (snapshot from Hydra)
    initial_credits     BIGINT DEFAULT 0,
    current_credits     BIGINT DEFAULT 0,

    -- Settlement
    settled_usdc        NUMERIC(20,6),
    settlement_tx       VARCHAR(66),

    status              VARCHAR(16) DEFAULT 'active',
    joined_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    left_at             TIMESTAMPTZ,

    UNIQUE(channel_id, agent_id)
);

CREATE INDEX idx_cp_channel ON channel_participants(channel_id);
CREATE INDEX idx_cp_agent ON channel_participants(agent_id);
