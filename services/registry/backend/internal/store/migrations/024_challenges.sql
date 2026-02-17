CREATE TABLE IF NOT EXISTS challenges (
    challenge   TEXT PRIMARY KEY,
    agent_id    TEXT NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_challenges_expires_at ON challenges (expires_at);
