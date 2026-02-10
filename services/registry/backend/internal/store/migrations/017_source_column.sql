-- Add source column to distinguish SDK vs Gateway origin
ALTER TABLE request_logs ADD COLUMN IF NOT EXISTS source VARCHAR(8) DEFAULT 'sdk';

-- Backfill source from sdk_version (gateway-* → 'gateway', else → 'sdk')
UPDATE request_logs SET source = CASE
  WHEN sdk_version LIKE 'gateway%' THEN 'gateway'
  ELSE 'sdk'
END;

-- Index for source+protocol combined queries
CREATE INDEX IF NOT EXISTS idx_reqlog_source_protocol
  ON request_logs(agent_id, source, protocol, created_at DESC);
