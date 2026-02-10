-- Remove redundant customer_id column from request_logs.
-- Customer identification now uses ip_address exclusively.
DROP INDEX IF EXISTS idx_reqlog_customer;
ALTER TABLE request_logs DROP COLUMN IF EXISTS customer_id;
