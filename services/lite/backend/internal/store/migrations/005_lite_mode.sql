-- Add mode column (replaces trust_mode) to channels
ALTER TABLE channels ADD COLUMN IF NOT EXISTS mode VARCHAR(8) NOT NULL DEFAULT 'lite';
CREATE INDEX IF NOT EXISTS idx_channels_mode ON channels(mode);

-- Lite mode: credit_balances table (DB is the ledger)
CREATE TABLE IF NOT EXISTS credit_balances (
    id              BIGSERIAL PRIMARY KEY,
    channel_id      UUID NOT NULL REFERENCES channels(id),
    agent_id        UUID NOT NULL REFERENCES agents(id),
    balance         BIGINT NOT NULL DEFAULT 0 CHECK (balance >= 0),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(channel_id, agent_id)
);

CREATE INDEX idx_cb_channel ON credit_balances(channel_id);
CREATE INDEX idx_cb_agent ON credit_balances(agent_id);

