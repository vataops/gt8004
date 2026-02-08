CREATE TABLE customers (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id        UUID NOT NULL REFERENCES agents(id),
    customer_id     VARCHAR(128) NOT NULL,  -- SDK-provided customer ID
    first_seen_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    total_requests  BIGINT DEFAULT 0,
    total_revenue   NUMERIC(20,8) DEFAULT 0,
    avg_response_ms REAL DEFAULT 0,
    error_rate      REAL DEFAULT 0,
    churn_risk      VARCHAR(16) DEFAULT 'low',  -- low, medium, high
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(agent_id, customer_id)
);

CREATE INDEX idx_customers_agent ON customers(agent_id, last_seen_at DESC);
CREATE INDEX idx_customers_churn ON customers(agent_id, churn_risk);
