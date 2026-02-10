-- 002: Raw data collection enhancements
-- Add headers JSONB column to request_logs

ALTER TABLE request_logs ADD COLUMN IF NOT EXISTS headers JSONB;

CREATE INDEX IF NOT EXISTS idx_reqlog_headers ON request_logs USING GIN (headers)
    WHERE headers IS NOT NULL;
