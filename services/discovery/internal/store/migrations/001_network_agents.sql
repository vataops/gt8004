CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS network_agents (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chain_id        INT NOT NULL,
    token_id        BIGINT NOT NULL,
    owner_address   VARCHAR(42),
    agent_uri       TEXT,
    name            TEXT NOT NULL DEFAULT '',
    description     TEXT NOT NULL DEFAULT '',
    image_url       TEXT NOT NULL DEFAULT '',
    metadata        JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    synced_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(chain_id, token_id)
);

CREATE INDEX IF NOT EXISTS idx_network_agents_chain ON network_agents(chain_id);
CREATE INDEX IF NOT EXISTS idx_network_agents_owner ON network_agents(owner_address);
