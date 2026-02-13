-- Seed data for Defi-professor agent (84532-2d1007)
-- UUID: cc183dbf-42f7-401d-a409-2f8bcdfb9966
-- Purpose: Demo/promotional data for Analytics, Customers, Overview tabs

BEGIN;

-- ============================================================
-- 1. CUSTOMERS (40 unique customers from various countries)
-- ============================================================
INSERT INTO customers (agent_id, customer_id, first_seen_at, last_seen_at, total_requests, total_revenue, avg_response_ms, error_rate, churn_risk, country, city) VALUES
-- Heavy users (low churn risk)
('cc183dbf-42f7-401d-a409-2f8bcdfb9966', '203.0.113.10',  NOW() - INTERVAL '28 days', NOW() - INTERVAL '1 hour',  487, 312.50, 128.3, 0.012, 'low', 'US', 'San Francisco'),
('cc183dbf-42f7-401d-a409-2f8bcdfb9966', '198.51.100.22', NOW() - INTERVAL '25 days', NOW() - INTERVAL '3 hours', 356, 245.00, 142.7, 0.018, 'low', 'KR', 'Seoul'),
('cc183dbf-42f7-401d-a409-2f8bcdfb9966', '192.0.2.45',    NOW() - INTERVAL '27 days', NOW() - INTERVAL '2 hours', 312, 198.75, 135.1, 0.009, 'low', 'SG', 'Singapore'),
('cc183dbf-42f7-401d-a409-2f8bcdfb9966', '10.20.30.40',   NOW() - INTERVAL '22 days', NOW() - INTERVAL '5 hours', 289, 187.50, 151.2, 0.021, 'low', 'JP', 'Tokyo'),
('cc183dbf-42f7-401d-a409-2f8bcdfb9966', '172.16.0.100',  NOW() - INTERVAL '26 days', NOW() - INTERVAL '4 hours', 267, 175.25, 139.8, 0.015, 'low', 'DE', 'Berlin'),
('cc183dbf-42f7-401d-a409-2f8bcdfb9966', '10.0.1.55',     NOW() - INTERVAL '24 days', NOW() - INTERVAL '6 hours', 234, 156.00, 145.3, 0.013, 'low', 'GB', 'London'),
('cc183dbf-42f7-401d-a409-2f8bcdfb9966', '192.168.1.10',  NOW() - INTERVAL '20 days', NOW() - INTERVAL '2 hours', 198, 132.50, 137.6, 0.020, 'low', 'US', 'New York'),
('cc183dbf-42f7-401d-a409-2f8bcdfb9966', '10.10.10.88',   NOW() - INTERVAL '21 days', NOW() - INTERVAL '8 hours', 187, 125.00, 148.9, 0.017, 'low', 'CA', 'Toronto'),
-- Medium users (low churn risk)
('cc183dbf-42f7-401d-a409-2f8bcdfb9966', '172.20.0.33',   NOW() - INTERVAL '18 days', NOW() - INTERVAL '1 day',   156, 98.75,  155.4, 0.025, 'low', 'FR', 'Paris'),
('cc183dbf-42f7-401d-a409-2f8bcdfb9966', '10.50.0.77',    NOW() - INTERVAL '19 days', NOW() - INTERVAL '12 hours',143, 87.50,  162.1, 0.022, 'low', 'AU', 'Sydney'),
('cc183dbf-42f7-401d-a409-2f8bcdfb9966', '192.168.5.20',  NOW() - INTERVAL '16 days', NOW() - INTERVAL '6 hours', 134, 82.25,  144.7, 0.019, 'low', 'NL', 'Amsterdam'),
('cc183dbf-42f7-401d-a409-2f8bcdfb9966', '10.100.0.12',   NOW() - INTERVAL '17 days', NOW() - INTERVAL '1 day',   128, 78.00,  158.3, 0.023, 'low', 'CH', 'Zurich'),
('cc183dbf-42f7-401d-a409-2f8bcdfb9966', '172.30.0.55',   NOW() - INTERVAL '15 days', NOW() - INTERVAL '8 hours', 112, 67.50,  141.2, 0.016, 'low', 'HK', 'Hong Kong'),
('cc183dbf-42f7-401d-a409-2f8bcdfb9966', '192.168.10.30', NOW() - INTERVAL '14 days', NOW() - INTERVAL '4 hours', 98,  52.25,  149.8, 0.020, 'low', 'AE', 'Dubai'),
('cc183dbf-42f7-401d-a409-2f8bcdfb9966', '10.200.0.44',   NOW() - INTERVAL '13 days', NOW() - INTERVAL '2 days',  87,  45.00,  167.5, 0.028, 'low', 'US', 'Austin'),
-- Lighter users (low/medium churn risk)
('cc183dbf-42f7-401d-a409-2f8bcdfb9966', '172.25.0.11',   NOW() - INTERVAL '12 days', NOW() - INTERVAL '3 days',  76,  38.75,  173.2, 0.032, 'low',    'SE', 'Stockholm'),
('cc183dbf-42f7-401d-a409-2f8bcdfb9966', '10.60.0.99',    NOW() - INTERVAL '11 days', NOW() - INTERVAL '2 days',  65,  32.50,  156.8, 0.024, 'low',    'ES', 'Madrid'),
('cc183dbf-42f7-401d-a409-2f8bcdfb9966', '192.168.20.5',  NOW() - INTERVAL '10 days', NOW() - INTERVAL '4 days',  54,  28.00,  179.4, 0.035, 'low',    'BR', 'São Paulo'),
('cc183dbf-42f7-401d-a409-2f8bcdfb9966', '10.70.0.22',    NOW() - INTERVAL '9 days',  NOW() - INTERVAL '5 days',  48,  22.50,  164.1, 0.029, 'low',    'IN', 'Mumbai'),
('cc183dbf-42f7-401d-a409-2f8bcdfb9966', '172.18.0.66',   NOW() - INTERVAL '8 days',  NOW() - INTERVAL '3 days',  42,  18.75,  171.6, 0.031, 'low',    'KR', 'Busan'),
('cc183dbf-42f7-401d-a409-2f8bcdfb9966', '10.80.0.33',    NOW() - INTERVAL '14 days', NOW() - INTERVAL '8 days',  38,  15.00,  185.3, 0.042, 'medium', 'TW', 'Taipei'),
('cc183dbf-42f7-401d-a409-2f8bcdfb9966', '192.168.30.7',  NOW() - INTERVAL '12 days', NOW() - INTERVAL '9 days',  32,  12.50,  192.7, 0.038, 'medium', 'IT', 'Milan'),
('cc183dbf-42f7-401d-a409-2f8bcdfb9966', '10.90.0.11',    NOW() - INTERVAL '11 days', NOW() - INTERVAL '8 days',  28,  10.25,  177.9, 0.036, 'medium', 'PL', 'Warsaw'),
('cc183dbf-42f7-401d-a409-2f8bcdfb9966', '172.22.0.88',   NOW() - INTERVAL '10 days', NOW() - INTERVAL '7 days',  24,  8.50,   188.4, 0.041, 'medium', 'TH', 'Bangkok'),
-- New users (recent, low requests)
('cc183dbf-42f7-401d-a409-2f8bcdfb9966', '10.110.0.55',   NOW() - INTERVAL '5 days',  NOW() - INTERVAL '1 hour',  18,  6.25,   143.2, 0.011, 'low', 'US', 'Chicago'),
('cc183dbf-42f7-401d-a409-2f8bcdfb9966', '192.168.40.12', NOW() - INTERVAL '4 days',  NOW() - INTERVAL '3 hours', 15,  5.00,   138.7, 0.013, 'low', 'JP', 'Osaka'),
('cc183dbf-42f7-401d-a409-2f8bcdfb9966', '10.120.0.77',   NOW() - INTERVAL '3 days',  NOW() - INTERVAL '2 hours', 12,  3.75,   152.1, 0.016, 'low', 'SG', 'Singapore'),
('cc183dbf-42f7-401d-a409-2f8bcdfb9966', '172.28.0.44',   NOW() - INTERVAL '3 days',  NOW() - INTERVAL '5 hours', 10,  2.50,   147.5, 0.010, 'low', 'GB', 'Manchester'),
('cc183dbf-42f7-401d-a409-2f8bcdfb9966', '10.130.0.22',   NOW() - INTERVAL '2 days',  NOW() - INTERVAL '4 hours', 8,   1.75,   141.3, 0.012, 'low', 'DE', 'Munich'),
('cc183dbf-42f7-401d-a409-2f8bcdfb9966', '192.168.50.66', NOW() - INTERVAL '2 days',  NOW() - INTERVAL '6 hours', 7,   1.25,   159.8, 0.014, 'low', 'KR', 'Incheon'),
('cc183dbf-42f7-401d-a409-2f8bcdfb9966', '10.140.0.88',   NOW() - INTERVAL '1 day',   NOW() - INTERVAL '1 hour',  5,   0.75,   135.6, 0.000, 'low', 'FR', 'Lyon'),
('cc183dbf-42f7-401d-a409-2f8bcdfb9966', '172.31.0.11',   NOW() - INTERVAL '1 day',   NOW() - INTERVAL '2 hours', 4,   0.50,   142.9, 0.000, 'low', 'NL', 'Rotterdam'),
-- High churn risk (inactive)
('cc183dbf-42f7-401d-a409-2f8bcdfb9966', '10.150.0.33',   NOW() - INTERVAL '25 days', NOW() - INTERVAL '16 days', 35,  14.25,  195.6, 0.057, 'high', 'RU', 'Moscow'),
('cc183dbf-42f7-401d-a409-2f8bcdfb9966', '192.168.60.9',  NOW() - INTERVAL '22 days', NOW() - INTERVAL '15 days', 22,  8.75,   201.3, 0.045, 'high', 'TR', 'Istanbul'),
('cc183dbf-42f7-401d-a409-2f8bcdfb9966', '10.160.0.44',   NOW() - INTERVAL '20 days', NOW() - INTERVAL '18 days', 15,  5.50,   210.7, 0.066, 'high', 'AR', 'Buenos Aires');

-- ============================================================
-- 2. REQUEST_LOGS (generate ~4000 request logs across 30 days)
--    Protocols: mcp, a2a, http
--    Sources: sdk, gateway
--    Tools: DeFi-related MCP tools
-- ============================================================

-- Helper: IP addresses mapped to countries (matching customers above)
-- We'll use generate_series to create bulk data

-- MCP requests (source=sdk, protocol=mcp) - the main protocol ~55% of traffic
INSERT INTO request_logs (agent_id, tool_name, method, path, status_code, response_ms, x402_amount, x402_token, x402_payer, protocol, source, ip_address, country, city, sdk_version, created_at)
SELECT
    'cc183dbf-42f7-401d-a409-2f8bcdfb9966'::uuid,
    tool,
    'POST',
    '/mcp/tools/' || tool,
    CASE
        WHEN random() < 0.02 THEN 500  -- 2% server error
        WHEN random() < 0.05 THEN 402  -- 3% payment required (x402)
        ELSE 200
    END,
    -- Response time: 80-250ms with realistic distribution
    80 + random() * 120 + (CASE WHEN random() < 0.1 THEN random() * 150 ELSE 0 END),
    -- x402 amount only for 402 and some 200 responses
    CASE WHEN random() < 0.15 THEN round((0.10 + random() * 1.90)::numeric, 4) ELSE NULL END,
    CASE WHEN random() < 0.15 THEN 'USDC' ELSE NULL END,
    CASE WHEN random() < 0.15 THEN '0x' || encode(gen_random_bytes(20), 'hex') ELSE NULL END,
    'mcp',
    'sdk',
    ip,
    ctry,
    cty,
    'v0.3.2',
    -- Distribute across 30 days with increasing trend
    NOW() - (random() * 30)::int * INTERVAL '1 day'
         - (random() * 24)::int * INTERVAL '1 hour'
         - (random() * 60)::int * INTERVAL '1 minute'
FROM (
    SELECT unnest(ARRAY[
        'defi_analyst', 'defi_analyst', 'defi_analyst', 'defi_analyst',  -- most popular
        'yield_calculator', 'yield_calculator', 'yield_calculator',
        'token_price', 'token_price', 'token_price',
        'pool_analyzer', 'pool_analyzer',
        'gas_estimator', 'gas_estimator',
        'whale_tracker',
        'protocol_tvl',
        'impermanent_loss_calc',
        'defi_risk_score'
    ]) AS tool
) tools
CROSS JOIN (
    SELECT unnest(ARRAY[
        '203.0.113.10','198.51.100.22','192.0.2.45','10.20.30.40','172.16.0.100',
        '10.0.1.55','192.168.1.10','10.10.10.88','172.20.0.33','10.50.0.77',
        '192.168.5.20','10.100.0.12','172.30.0.55','192.168.10.30','10.200.0.44',
        '172.25.0.11','10.60.0.99','192.168.20.5','10.70.0.22','172.18.0.66',
        '10.110.0.55','192.168.40.12','10.120.0.77','172.28.0.44','10.130.0.22'
    ]) AS ip,
    unnest(ARRAY[
        'US','KR','SG','JP','DE',
        'GB','US','CA','FR','AU',
        'NL','CH','HK','AE','US',
        'SE','ES','BR','IN','KR',
        'US','JP','SG','GB','DE'
    ]) AS ctry,
    unnest(ARRAY[
        'San Francisco','Seoul','Singapore','Tokyo','Berlin',
        'London','New York','Toronto','Paris','Sydney',
        'Amsterdam','Zurich','Hong Kong','Dubai','Austin',
        'Stockholm','Madrid','São Paulo','Mumbai','Busan',
        'Chicago','Osaka','Singapore','Manchester','Munich'
    ]) AS cty
) customers
CROSS JOIN generate_series(1, 2) AS rep(n)
WHERE random() < 0.45;  -- ~45% sampling to get natural variation

-- A2A requests (source=sdk, protocol=a2a) - ~25% of traffic
INSERT INTO request_logs (agent_id, tool_name, method, path, status_code, response_ms, x402_amount, x402_token, x402_payer, protocol, source, ip_address, country, city, sdk_version, created_at)
SELECT
    'cc183dbf-42f7-401d-a409-2f8bcdfb9966'::uuid,
    NULL, -- A2A doesn't use tool_name
    method,
    endpoint,
    CASE
        WHEN random() < 0.015 THEN 500
        WHEN random() < 0.08 THEN 402
        ELSE 200
    END,
    100 + random() * 180 + (CASE WHEN random() < 0.08 THEN random() * 200 ELSE 0 END),
    CASE WHEN random() < 0.20 THEN round((0.25 + random() * 2.50)::numeric, 4) ELSE NULL END,
    CASE WHEN random() < 0.20 THEN 'USDC' ELSE NULL END,
    CASE WHEN random() < 0.20 THEN '0x' || encode(gen_random_bytes(20), 'hex') ELSE NULL END,
    'a2a',
    'sdk',
    ip,
    ctry,
    cty,
    'v0.3.2',
    NOW() - (random() * 30)::int * INTERVAL '1 day'
         - (random() * 24)::int * INTERVAL '1 hour'
         - (random() * 60)::int * INTERVAL '1 minute'
FROM (
    SELECT unnest(ARRAY['POST','POST','POST','GET','GET']) AS method,
           unnest(ARRAY[
               '/a2a/tasks/send',
               '/a2a/tasks/send',
               '/a2a/tasks/send',
               '/a2a/tasks/get',
               '/a2a/agent-card'
           ]) AS endpoint
) endpoints
CROSS JOIN (
    SELECT unnest(ARRAY[
        '203.0.113.10','198.51.100.22','192.0.2.45','10.20.30.40','172.16.0.100',
        '10.0.1.55','192.168.1.10','10.10.10.88','172.20.0.33','10.50.0.77',
        '192.168.5.20','10.100.0.12','172.30.0.55','192.168.10.30','10.200.0.44'
    ]) AS ip,
    unnest(ARRAY[
        'US','KR','SG','JP','DE',
        'GB','US','CA','FR','AU',
        'NL','CH','HK','AE','US'
    ]) AS ctry,
    unnest(ARRAY[
        'San Francisco','Seoul','Singapore','Tokyo','Berlin',
        'London','New York','Toronto','Paris','Sydney',
        'Amsterdam','Zurich','Hong Kong','Dubai','Austin'
    ]) AS cty
) customers
CROSS JOIN generate_series(1, 2) AS rep(n)
WHERE random() < 0.35;

-- HTTP/OASF requests (source=gateway, protocol=http) - ~20% of traffic
INSERT INTO request_logs (agent_id, tool_name, method, path, status_code, response_ms, protocol, source, ip_address, country, city, sdk_version, created_at)
SELECT
    'cc183dbf-42f7-401d-a409-2f8bcdfb9966'::uuid,
    NULL,
    method,
    endpoint,
    CASE
        WHEN random() < 0.03 THEN 500
        WHEN random() < 0.01 THEN 408
        ELSE 200
    END,
    60 + random() * 100,
    'http',
    'gateway',
    ip,
    ctry,
    cty,
    NULL,
    NOW() - (random() * 30)::int * INTERVAL '1 day'
         - (random() * 24)::int * INTERVAL '1 hour'
         - (random() * 60)::int * INTERVAL '1 minute'
FROM (
    SELECT unnest(ARRAY['GET','GET','POST','GET']) AS method,
           unnest(ARRAY[
               '/api/v1/analyze',
               '/api/v1/health',
               '/api/v1/query',
               '/api/v1/status'
           ]) AS endpoint
) endpoints
CROSS JOIN (
    SELECT unnest(ARRAY[
        '10.80.0.33','192.168.30.7','10.90.0.11','172.22.0.88',
        '10.150.0.33','192.168.60.9','10.160.0.44',
        '192.168.50.66','10.140.0.88','172.31.0.11'
    ]) AS ip,
    unnest(ARRAY[
        'TW','IT','PL','TH',
        'RU','TR','AR',
        'KR','FR','NL'
    ]) AS ctry,
    unnest(ARRAY[
        'Taipei','Milan','Warsaw','Bangkok',
        'Moscow','Istanbul','Buenos Aires',
        'Incheon','Lyon','Rotterdam'
    ]) AS cty
) customers
CROSS JOIN generate_series(1, 3) AS rep(n)
WHERE random() < 0.40;

-- Add more recent-day heavy traffic (last 7 days should have upward trend)
INSERT INTO request_logs (agent_id, tool_name, method, path, status_code, response_ms, x402_amount, x402_token, protocol, source, ip_address, country, city, sdk_version, created_at)
SELECT
    'cc183dbf-42f7-401d-a409-2f8bcdfb9966'::uuid,
    tool,
    'POST',
    '/mcp/tools/' || tool,
    CASE WHEN random() < 0.02 THEN 500 WHEN random() < 0.05 THEN 402 ELSE 200 END,
    75 + random() * 110,
    CASE WHEN random() < 0.18 THEN round((0.15 + random() * 2.00)::numeric, 4) ELSE NULL END,
    CASE WHEN random() < 0.18 THEN 'USDC' ELSE NULL END,
    'mcp',
    'sdk',
    ip,
    ctry,
    cty,
    'v0.3.2',
    NOW() - (random() * 7)::int * INTERVAL '1 day'
         - (random() * 24)::int * INTERVAL '1 hour'
         - (random() * 60)::int * INTERVAL '1 minute'
FROM (
    SELECT unnest(ARRAY[
        'defi_analyst','yield_calculator','token_price','pool_analyzer',
        'gas_estimator','whale_tracker','protocol_tvl','defi_risk_score'
    ]) AS tool
) tools
CROSS JOIN (
    SELECT unnest(ARRAY[
        '203.0.113.10','198.51.100.22','192.0.2.45','10.20.30.40',
        '172.16.0.100','10.0.1.55','192.168.1.10','10.10.10.88',
        '10.110.0.55','192.168.40.12','10.120.0.77','172.28.0.44'
    ]) AS ip,
    unnest(ARRAY[
        'US','KR','SG','JP','DE','GB','US','CA','US','JP','SG','GB'
    ]) AS ctry,
    unnest(ARRAY[
        'San Francisco','Seoul','Singapore','Tokyo','Berlin','London','New York','Toronto','Chicago','Osaka','Singapore','Manchester'
    ]) AS cty
) customers
CROSS JOIN generate_series(1, 4) AS rep(n)
WHERE random() < 0.55;

-- Add recent A2A burst (last 7 days)
INSERT INTO request_logs (agent_id, method, path, status_code, response_ms, x402_amount, x402_token, x402_payer, protocol, source, ip_address, country, city, sdk_version, created_at)
SELECT
    'cc183dbf-42f7-401d-a409-2f8bcdfb9966'::uuid,
    'POST',
    '/a2a/tasks/send',
    CASE WHEN random() < 0.01 THEN 500 WHEN random() < 0.10 THEN 402 ELSE 200 END,
    90 + random() * 160,
    CASE WHEN random() < 0.25 THEN round((0.50 + random() * 3.00)::numeric, 4) ELSE NULL END,
    CASE WHEN random() < 0.25 THEN 'USDC' ELSE NULL END,
    CASE WHEN random() < 0.25 THEN '0x' || encode(gen_random_bytes(20), 'hex') ELSE NULL END,
    'a2a',
    'sdk',
    ip,
    ctry,
    cty,
    'v0.3.2',
    NOW() - (random() * 5)::int * INTERVAL '1 day'
         - (random() * 24)::int * INTERVAL '1 hour'
         - (random() * 60)::int * INTERVAL '1 minute'
FROM (
    SELECT unnest(ARRAY[
        '203.0.113.10','198.51.100.22','192.0.2.45','10.20.30.40',
        '172.16.0.100','10.0.1.55','192.168.1.10','192.168.5.20'
    ]) AS ip,
    unnest(ARRAY['US','KR','SG','JP','DE','GB','US','NL']) AS ctry,
    unnest(ARRAY['San Francisco','Seoul','Singapore','Tokyo','Berlin','London','New York','Amsterdam']) AS cty
) customers
CROSS JOIN generate_series(1, 6) AS rep(n)
WHERE random() < 0.50;

-- ============================================================
-- 3. REVENUE_ENTRIES (from x402 payments)
-- ============================================================
INSERT INTO revenue_entries (agent_id, customer_id, tool_name, amount, currency, tx_hash, payer_address, created_at)
SELECT
    agent_id,
    ip_address,
    tool_name,
    x402_amount,
    'USDC',
    x402_tx_hash,
    x402_payer,
    created_at
FROM request_logs
WHERE agent_id = 'cc183dbf-42f7-401d-a409-2f8bcdfb9966'
  AND x402_amount IS NOT NULL
  AND x402_amount > 0;

-- ============================================================
-- 4. UPDATE CUSTOMER STATS (sync with actual request_logs)
-- ============================================================
UPDATE customers c SET
    total_requests = sub.total_requests,
    total_revenue = sub.total_revenue,
    avg_response_ms = sub.avg_response_ms,
    error_rate = sub.error_rate,
    first_seen_at = sub.first_seen,
    last_seen_at = sub.last_seen,
    updated_at = NOW()
FROM (
    SELECT
        ip_address,
        COUNT(*) AS total_requests,
        COALESCE(SUM(x402_amount), 0) AS total_revenue,
        AVG(response_ms) AS avg_response_ms,
        CASE WHEN COUNT(*) > 0
            THEN CAST(COUNT(*) FILTER (WHERE status_code >= 400) AS FLOAT) / COUNT(*)
            ELSE 0
        END AS error_rate,
        MIN(created_at) AS first_seen,
        MAX(created_at) AS last_seen
    FROM request_logs
    WHERE agent_id = 'cc183dbf-42f7-401d-a409-2f8bcdfb9966'
    GROUP BY ip_address
) sub
WHERE c.agent_id = 'cc183dbf-42f7-401d-a409-2f8bcdfb9966'
  AND c.customer_id = sub.ip_address;

-- Update churn risk based on last activity
UPDATE customers SET
    churn_risk = CASE
        WHEN last_seen_at < NOW() - INTERVAL '14 days' THEN 'high'
        WHEN last_seen_at < NOW() - INTERVAL '7 days' THEN 'medium'
        ELSE 'low'
    END,
    updated_at = NOW()
WHERE agent_id = 'cc183dbf-42f7-401d-a409-2f8bcdfb9966';

-- ============================================================
-- 5. Add today's traffic for real-time health metrics
-- ============================================================
INSERT INTO request_logs (agent_id, tool_name, method, path, status_code, response_ms, x402_amount, x402_token, protocol, source, ip_address, country, city, sdk_version, created_at)
SELECT
    'cc183dbf-42f7-401d-a409-2f8bcdfb9966'::uuid,
    tool,
    'POST',
    '/mcp/tools/' || tool,
    CASE WHEN random() < 0.015 THEN 500 WHEN random() < 0.04 THEN 402 ELSE 200 END,
    70 + random() * 100,
    CASE WHEN random() < 0.20 THEN round((0.20 + random() * 1.80)::numeric, 4) ELSE NULL END,
    CASE WHEN random() < 0.20 THEN 'USDC' ELSE NULL END,
    'mcp',
    'sdk',
    ip,
    ctry,
    cty,
    'v0.3.2',
    -- Last 60 minutes for health metrics
    NOW() - (random() * 60)::int * INTERVAL '1 minute'
FROM (
    SELECT unnest(ARRAY[
        'defi_analyst','yield_calculator','token_price','pool_analyzer','gas_estimator','whale_tracker'
    ]) AS tool
) tools
CROSS JOIN (
    SELECT unnest(ARRAY['203.0.113.10','198.51.100.22','192.0.2.45','10.20.30.40','172.16.0.100','10.0.1.55']) AS ip,
           unnest(ARRAY['US','KR','SG','JP','DE','GB']) AS ctry,
           unnest(ARRAY['San Francisco','Seoul','Singapore','Tokyo','Berlin','London']) AS cty
) customers
CROSS JOIN generate_series(1, 3) AS rep(n)
WHERE random() < 0.60;

-- Add today's revenue entries
INSERT INTO revenue_entries (agent_id, customer_id, tool_name, amount, currency, tx_hash, payer_address, created_at)
SELECT
    agent_id, ip_address, tool_name, x402_amount, 'USDC', x402_tx_hash, x402_payer, created_at
FROM request_logs
WHERE agent_id = 'cc183dbf-42f7-401d-a409-2f8bcdfb9966'
  AND x402_amount IS NOT NULL
  AND x402_amount > 0
  AND created_at >= NOW() - INTERVAL '60 minutes'
ON CONFLICT DO NOTHING;

COMMIT;

-- Print summary
SELECT 'request_logs' AS table_name, COUNT(*) AS rows FROM request_logs WHERE agent_id = 'cc183dbf-42f7-401d-a409-2f8bcdfb9966'
UNION ALL
SELECT 'customers', COUNT(*) FROM customers WHERE agent_id = 'cc183dbf-42f7-401d-a409-2f8bcdfb9966'
UNION ALL
SELECT 'revenue_entries', COUNT(*) FROM revenue_entries WHERE agent_id = 'cc183dbf-42f7-401d-a409-2f8bcdfb9966';
