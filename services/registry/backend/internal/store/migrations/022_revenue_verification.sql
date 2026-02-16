ALTER TABLE revenue_entries
  ADD COLUMN verified    BOOLEAN DEFAULT FALSE,
  ADD COLUMN chain_id    INT,
  ADD COLUMN verified_at TIMESTAMPTZ;

CREATE INDEX idx_revenue_verified ON revenue_entries(agent_id, verified);
