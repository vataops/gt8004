-- Add SDK connection tracking to agents table
ALTER TABLE agents ADD COLUMN IF NOT EXISTS sdk_connected_at TIMESTAMPTZ;
