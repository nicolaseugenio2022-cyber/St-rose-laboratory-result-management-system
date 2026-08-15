-- F6b-1: Durable account lockout state

CREATE TABLE IF NOT EXISTS account_lockouts (
    id UUID PRIMARY KEY,
    username TEXT NOT NULL,
    locked_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    released_at TIMESTAMPTZ,
    failure_count INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_account_lockouts_open_username
ON account_lockouts (username)
WHERE released_at IS NULL;

REVOKE ALL ON account_lockouts FROM PUBLIC;

ALTER TABLE account_lockouts ENABLE ROW LEVEL SECURITY;
