-- 004: Track last scanned block per chain for incremental sync

CREATE TABLE IF NOT EXISTS sync_state (
    chain_id        INT PRIMARY KEY,
    last_block      BIGINT NOT NULL DEFAULT 0,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
