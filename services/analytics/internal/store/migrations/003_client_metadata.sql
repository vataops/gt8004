-- 003: Client metadata columns for enriched customer intelligence
-- Captures IP, User-Agent, Referer, Content-Type, Accept-Language, and GeoIP data

ALTER TABLE request_logs ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45);
ALTER TABLE request_logs ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE request_logs ADD COLUMN IF NOT EXISTS referer TEXT;
ALTER TABLE request_logs ADD COLUMN IF NOT EXISTS content_type VARCHAR(128);
ALTER TABLE request_logs ADD COLUMN IF NOT EXISTS accept_language VARCHAR(128);
ALTER TABLE request_logs ADD COLUMN IF NOT EXISTS country VARCHAR(2);
ALTER TABLE request_logs ADD COLUMN IF NOT EXISTS city VARCHAR(128);

CREATE INDEX IF NOT EXISTS idx_reqlog_ip ON request_logs(ip_address, created_at DESC)
    WHERE ip_address IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reqlog_country ON request_logs(agent_id, country, created_at DESC)
    WHERE country IS NOT NULL;
