CREATE TABLE IF NOT EXISTS benchmark_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category VARCHAR(100) NOT NULL,
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    rank INT NOT NULL,
    score DOUBLE PRECISION NOT NULL,
    total_requests BIGINT NOT NULL DEFAULT 0,
    avg_response_ms DOUBLE PRECISION NOT NULL DEFAULT 0,
    error_rate DOUBLE PRECISION NOT NULL DEFAULT 0,
    revenue DOUBLE PRECISION NOT NULL DEFAULT 0,
    customer_count INT NOT NULL DEFAULT 0,
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(category, agent_id)
);

CREATE INDEX idx_benchmark_category ON benchmark_cache(category, rank);
