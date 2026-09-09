-- Managed physician directory: the authoritative source for the report "Requested By" field.
--
-- Deliberately a table of its own rather than a new `personnel` role. A requesting physician is
-- not a PRC-licensed signatory of this laboratory: it carries no licence number, no credentials
-- and no signature, and every one of those columns is NOT NULL on `personnel`. Widening that
-- table's role CHECK would have made three required columns optional for everyone.
--
-- NON-DESTRUCTIVE BY CONSTRUCTION. This migration creates one new table, its updated_at trigger
-- and the current roster as seed rows. It contains no DROP, no DELETE, no TRUNCATE and no ALTER
-- of any pre-existing object, so it applies identically to a clean database and to the existing
-- production database. `auto_suggestions` is deliberately left completely alone - it remains in
-- use for its other categories and no data is migrated out of it here.

CREATE TABLE IF NOT EXISTS physicians (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_physicians_full_name_present CHECK (char_length(btrim(full_name)) > 0)
);

-- Mirrors the shared updated_at trigger shape used by every other maintained table
-- (03_indexes_and_triggers.sql). PostgreSQL has no CREATE TRIGGER IF NOT EXISTS, and DROP TRIGGER
-- IF EXISTS would introduce a destructive statement into a migration that must contain none, so
-- the catalogue is consulted instead. The CREATE TRIGGER statement itself is byte-identical in
-- shape to its siblings.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'trg_physicians_updated_at'
          AND tgrelid = 'physicians'::regclass
    ) THEN
        CREATE TRIGGER trg_physicians_updated_at
        BEFORE UPDATE ON physicians
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END
$$;

-- The application server is the authoritative authorization boundary (SECURITY_MODEL.md 8.0).
-- RLS is defense-in-depth only; privileged server access uses the server-only secret credential,
-- which bypasses RLS. No permissive policy is created here, and no auth.* function is referenced,
-- exactly as in 05_rls_policies.sql.
ALTER TABLE physicians ENABLE ROW LEVEL SECURITY;

-- Privileges are restated rather than inherited, matching every table created after
-- 20260812100100_authorization_grants.sql. The exact precedent is accession_allocation.sql, whose
-- revoke/revoke/grant trio these three statements reproduce. add_account_lockouts.sql is NOT that
-- precedent and was previously named here in error: it carries the PUBLIC revoke alone, with
-- neither the browser-role revoke nor the service_role grant.
-- That migration's REVOKE covered only the tables existing at the time, and its ALTER DEFAULT
-- PRIVILEGES entry is recorded per grantor role - so a table created later by a different role
-- would fall back to the platform default, which grants the browser roles a table grant. RLS with
-- no policy would still deny every row, but the belt every sibling table wears is stated here too.
-- The explicit service_role grant also removes the availability risk of relying on an inherited
-- default: the server client authenticates as service_role, and a missing grant would surface as
-- 'permission denied for table physicians' on every physician query.
-- All four statements are non-destructive and idempotent.
REVOKE ALL ON physicians FROM PUBLIC;
REVOKE ALL ON physicians FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON physicians TO service_role;

-- The complete current roster, preserved verbatim as it must print on a report. Idempotent: a
-- re-application of this migration inserts nothing and overwrites nothing, and an operator who
-- has since deactivated or renamed a physician keeps that change.
INSERT INTO physicians (full_name, is_active)
VALUES
    ('Dr. Ralph Roland Asperas', TRUE),
    ('Dr. Heinz Roland Asperas', TRUE),
    ('Dr. Ma. Floricel Dedace-Lagrazon', TRUE)
ON CONFLICT (full_name) DO NOTHING;
