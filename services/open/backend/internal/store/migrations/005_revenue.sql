CREATE TABLE revenue_entries (
    id              BIGSERIAL PRIMARY KEY,
    agent_id        UUID NOT NULL REFERENCES agents(id),
    customer_id     VARCHAR(128),
    tool_name       VARCHAR(128),
    amount          NUMERIC(20,8) NOT NULL,
    currency        VARCHAR(8) DEFAULT 'USDC',
    tx_hash         VARCHAR(66),
    payer_address   VARCHAR(42),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_revenue_agent ON revenue_entries(agent_id, created_at DESC);
CREATE INDEX idx_revenue_agent_month ON revenue_entries(agent_id, date_trunc('month', created_at));
