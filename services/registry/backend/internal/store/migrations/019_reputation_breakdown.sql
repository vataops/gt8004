-- Reputation breakdown cache (computed periodically by ReputationCalculator)
CREATE TABLE IF NOT EXISTS reputation_breakdown (
    agent_id           UUID NOT NULL REFERENCES agents(id) UNIQUE,
    reliability        FLOAT NOT NULL DEFAULT 0,
    performance        FLOAT NOT NULL DEFAULT 0,
    activity           FLOAT NOT NULL DEFAULT 0,
    revenue_quality    FLOAT NOT NULL DEFAULT 0,
    customer_retention FLOAT NOT NULL DEFAULT 0,
    peer_review        FLOAT NOT NULL DEFAULT 0,
    onchain_score      FLOAT NOT NULL DEFAULT 0,
    total_score        FLOAT NOT NULL DEFAULT 0,
    onchain_count      INT NOT NULL DEFAULT 0,
    review_count       INT NOT NULL DEFAULT 0,
    calculated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
