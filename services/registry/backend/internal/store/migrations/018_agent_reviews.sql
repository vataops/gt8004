-- Helper: IMMUTABLE epoch-day function (extract(epoch) on TIMESTAMPTZ is truly
-- deterministic but PostgreSQL classifies it STABLE; this wrapper is safe).
CREATE OR REPLACE FUNCTION epoch_day(ts TIMESTAMPTZ) RETURNS INT
LANGUAGE SQL IMMUTABLE PARALLEL SAFE AS $$
  SELECT (floor(extract(epoch FROM ts) / 86400))::int
$$;

-- Peer review table for off-chain agent feedback
CREATE TABLE IF NOT EXISTS agent_reviews (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id    UUID NOT NULL REFERENCES agents(id),
    reviewer_id TEXT NOT NULL,
    score       SMALLINT NOT NULL CHECK (score BETWEEN 1 AND 5),
    tags        TEXT[] NOT NULL DEFAULT '{}',
    comment     TEXT DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_reviews_agent_id ON agent_reviews(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_reviews_reviewer ON agent_reviews(reviewer_id);

-- Prevent duplicate reviews from same reviewer for same agent (one per day)
CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_reviews_dedup
    ON agent_reviews(agent_id, reviewer_id, epoch_day(created_at));
