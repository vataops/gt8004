CREATE TABLE request_logs (
    id              BIGSERIAL PRIMARY KEY,
    agent_id        UUID NOT NULL REFERENCES agents(id),
    request_id      VARCHAR(64),
    customer_id     VARCHAR(128),
    tool_name       VARCHAR(128),
    method          VARCHAR(8),
    path            TEXT,
    status_code     SMALLINT,
    response_ms     REAL,
    error_type      VARCHAR(64),
    x402_amount     NUMERIC(20,8),
    x402_tx_hash    VARCHAR(66),
    x402_token      VARCHAR(16),
    x402_payer      VARCHAR(42),
    request_body_size  INT,
    response_body_size INT,
    batch_id        VARCHAR(64),
    sdk_version     VARCHAR(16),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reqlog_agent ON request_logs(agent_id, created_at DESC);
CREATE INDEX idx_reqlog_customer ON request_logs(customer_id, created_at DESC);
