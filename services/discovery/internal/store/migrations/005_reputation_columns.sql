-- Add reputation data columns to network_agents
ALTER TABLE network_agents
    ADD COLUMN IF NOT EXISTS reputation_score REAL NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS reputation_count INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_network_agents_reputation ON network_agents(reputation_score DESC);
