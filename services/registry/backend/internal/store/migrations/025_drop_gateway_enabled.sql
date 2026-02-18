-- Drop gateway_enabled column (gateway proxy feature removed)
ALTER TABLE agents DROP COLUMN IF EXISTS gateway_enabled;
