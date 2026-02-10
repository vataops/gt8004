-- 002: Network agent change history tracking

CREATE TABLE IF NOT EXISTS network_agent_history (
    id           BIGSERIAL PRIMARY KEY,
    chain_id     INT NOT NULL,
    token_id     BIGINT NOT NULL,
    change_type  VARCHAR(32) NOT NULL,
    old_value    JSONB,
    new_value    JSONB,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nah_chain_token
    ON network_agent_history(chain_id, token_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_nah_change_type
    ON network_agent_history(change_type, created_at DESC);
