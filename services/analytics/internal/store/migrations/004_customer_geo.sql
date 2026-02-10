-- Add country/city columns for GeoIP-based customer identification.
-- customer_id now stores the caller's IP address instead of an agent slug.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS country VARCHAR(64) DEFAULT '';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS city VARCHAR(128) DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_customers_country ON customers(agent_id, country);
