-- Add protocol column to request_logs
ALTER TABLE request_logs ADD COLUMN IF NOT EXISTS protocol VARCHAR(8) DEFAULT 'http';

-- Index for protocol-based queries (filtered by agent_id)
CREATE INDEX IF NOT EXISTS idx_reqlog_protocol ON request_logs(agent_id, protocol, created_at DESC);

-- Index for tool_name ranking queries
CREATE INDEX IF NOT EXISTS idx_reqlog_tool ON request_logs(agent_id, tool_name, created_at DESC)
  WHERE tool_name IS NOT NULL;

-- Backfill protocol for existing rows based on path patterns
UPDATE request_logs SET protocol = CASE
  WHEN path LIKE '%/mcp/%' THEN 'mcp'
  WHEN path LIKE '%/a2a/%' OR path LIKE '%/.well-known/%' THEN 'a2a'
  ELSE 'http'
END
WHERE protocol = 'http' OR protocol IS NULL;
