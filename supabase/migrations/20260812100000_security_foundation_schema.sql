-- Milestone 6A: Security foundation schema objects

CREATE TABLE auth_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT NOT NULL,
    attempt_kind TEXT NOT NULL CHECK (attempt_kind IN
        ('Login', 'RecoveryLookup', 'RecoveryAnswer', 'PasswordReset')),
    succeeded BOOLEAN NOT NULL,
    client_ip TEXT,
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_auth_attempts_username_time
ON auth_attempts (username, attempted_at DESC);

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL,
    event_type TEXT NOT NULL,
    performed_by_user_id UUID NULL,
    performed_by_username TEXT NULL,
    target_reference TEXT NULL,
    details JSONB NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

REVOKE UPDATE, DELETE ON audit_logs FROM PUBLIC;

CREATE OR REPLACE FUNCTION audit_logs_append_only()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'audit_logs is append-only: % is not permitted', TG_OP;
END;
$$;

CREATE TRIGGER trg_audit_logs_append_only
    BEFORE UPDATE OR DELETE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION audit_logs_append_only();

ALTER TABLE auth_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
