-- Add metadata columns to network_agents for agentURI-fetched data.
ALTER TABLE network_agents
  ADD COLUMN IF NOT EXISTS name        TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS image_url   TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS metadata    JSONB NOT NULL DEFAULT '{}';