-- Physician-to-examination assignment: which requesting physicians an Administrator has made
-- available for each examination, and which one of them the workspace pre-selects.
--
-- NORMALIZED BY CONSTRUCTION. One row per (physician, examination). The alternative shapes were
-- all rejected: a `template_codes TEXT[]` or a JSON blob on `physicians` cannot carry a foreign
-- key to `report_templates`, cannot be indexed for "who is assigned to this examination" without
-- a GIN index over an opaque value, and above all cannot express "at most one default physician
-- per examination" as a database constraint - that invariant would degrade into application code,
-- which is exactly what this table exists to avoid.
--
-- NON-DESTRUCTIVE BY CONSTRUCTION. This migration creates one new table, its indexes, its
-- updated_at trigger, and seed rows. It contains no DROP, no TRUNCATE, no data-removal statement
-- and no ALTER of any pre-existing object, so it applies identically to a clean database and to
-- the live one. `physicians` and `report_templates` are referenced only, never modified.

CREATE TABLE IF NOT EXISTS physician_examination_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- RESTRICT, not CASCADE. There is no physician removal path anywhere in this application -
    -- `IPhysicianRepository` declares no delete and the repository exposes none, because a
    -- historical report must keep resolving the physician it was issued with; removal is the
    -- soft `is_active` toggle. RESTRICT makes that absence structural: a stray manual DELETE of a
    -- physician row is refused by the database rather than silently discarding this
    -- configuration. `laboratory_reports.template_code` sets the same precedent for the template
    -- side (02_tables.sql line 117) - the CASCADE used by `template_parameters` is right for rows
    -- that ARE the template's definition, and wrong for rows that record an operator's choice.
    physician_id UUID NOT NULL REFERENCES physicians(id) ON DELETE RESTRICT,
    -- `template_code` is the maintained natural key of the report registry, and every other
    -- table in this schema joins the registry by it rather than by `report_templates.id`.
    -- ON UPDATE CASCADE so a registry re-code cannot orphan an assignment.
    template_code TEXT NOT NULL REFERENCES report_templates(template_code)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    -- The default lives ON the assignment row, so "the default physician for an examination is
    -- also assigned to it" is structural rather than a cross-table invariant nothing enforces.
    -- A default that is not an assignment is unrepresentable: there is no row to carry the flag.
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- One physician is assigned to one examination at most once. A duplicate raises 23505.
    -- Leading column `physician_id` also serves "every examination assigned to this physician",
    -- which is the read the Administrator's physician editor issues.
    CONSTRAINT uq_physician_examination_assignment UNIQUE (physician_id, template_code)
);

-- "Every physician assigned to this examination" - the read the workspace issues when it builds
-- the Requested By choices for the examination being encoded. The composite unique constraint
-- above cannot serve it: `template_code` is its trailing column.
CREATE INDEX IF NOT EXISTS idx_physician_examination_assignments_template_code
ON physician_examination_assignments(template_code);

-- THE DEFAULT INVARIANT, enforced by the database and not by the UI. A partial unique index over
-- `template_code` restricted to the default rows: two physicians cannot both be default for the
-- same examination, because that would be two index entries for one key. Rows with
-- is_default = FALSE are not in the index at all, so an examination may have any number of
-- assignments and zero or one default among them. Zero is a legitimate state - three of the
-- seeded examinations require staff entry and have no declarative default.
CREATE UNIQUE INDEX IF NOT EXISTS uq_physician_examination_assignments_default_per_template
ON physician_examination_assignments(template_code)
WHERE is_default;

-- Mirrors the shared updated_at trigger shape used by every maintained table
-- (03_indexes_and_triggers.sql). PostgreSQL has no CREATE TRIGGER IF NOT EXISTS, and
-- DROP TRIGGER IF EXISTS would introduce a destructive statement into a migration that must
-- contain none, so the catalogue is consulted instead - the same idiom as
-- 20260909120000_physician_directory.sql. The CREATE TRIGGER statement is byte-identical in
-- shape to its siblings.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'trg_physician_examination_assignments_updated_at'
          AND tgrelid = 'physician_examination_assignments'::regclass
    ) THEN
        CREATE TRIGGER trg_physician_examination_assignments_updated_at
        BEFORE UPDATE ON physician_examination_assignments
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END
$$;

-- The application server is the authoritative authorization boundary (SECURITY_MODEL.md 8.0).
-- RLS is defense-in-depth only; privileged server access uses the server-only secret credential,
-- which bypasses RLS. No permissive policy is created here and no auth.* function is referenced,
-- exactly as in 05_rls_policies.sql, 20260815160000_accession_allocation.sql and
-- 20260909120000_physician_directory.sql. The browser roles get nothing: with RLS enabled, no
-- policy, and the table grant revoked, `anon` and `authenticated` can neither read nor write a
-- single row even if a publishable key reached this table's name.
ALTER TABLE physician_examination_assignments ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON physician_examination_assignments FROM PUBLIC;
REVOKE ALL ON physician_examination_assignments FROM anon, authenticated;
-- VERB SET, justified. SELECT: the workspace resolves the assigned physicians and the default
-- for the examination being encoded, and the Administrator's editor reads the current set.
-- INSERT: assigning a physician to an examination. UPDATE: moving the default flag, which is the
-- clear-then-set pair described below. DELETE: un-assigning. Un-assignment must be a real row
-- removal rather than a soft flag - an assignment row is CURRENT CONFIGURATION, not history. No
-- report depends on it: a completed report stores the physician's printed name in its own
-- session snapshot, so removing an assignment changes what may be chosen next and destroys
-- nothing already issued. TRUNCATE, REFERENCES and TRIGGER are deliberately not granted.
GRANT SELECT, INSERT, UPDATE, DELETE ON physician_examination_assignments TO service_role;

-- NO FUNCTION IS CREATED HERE, deliberately. "Make this physician the default for examination X,
-- clearing the previous default" is expressible as two ordinary statements the server action
-- issues in sequence:
--     UPDATE ... SET is_default = FALSE WHERE template_code = $1 AND is_default;
--     UPDATE ... SET is_default = TRUE  WHERE physician_id = $2 AND template_code = $1;
-- and it needs no atomicity guarantee beyond what the partial unique index already gives. The
-- worst outcome of a failure between the two statements is that the examination is left with NO
-- default - a state the schema already permits and three seeded examinations already occupy, and
-- which the Administrator repairs by re-selecting. The state that would actually be dangerous,
-- two defaults for one examination, is unrepresentable regardless of ordering or interleaving:
-- the index rejects the second write with 23505. Since the invariant is held by the constraint
-- rather than by the sequence, wrapping the pair in a database function would add a callable
-- surface and a second place to audit while buying nothing. An unnecessary function is a
-- security cost, not a security feature. Should a future requirement genuinely need atomicity,
-- the precedent to follow is `allocate_accession_number()` in
-- 20260815160000_accession_allocation.sql: SECURITY INVOKER, a fixed search_path, EXECUTE
-- revoked from PUBLIC/anon/authenticated and granted only to service_role - never
-- SECURITY DEFINER.

-- ─────────────────────────── Seed: the assignments in force today ───────────────────────────
--
-- Physicians and examinations are referenced by their natural keys (`full_name`,
-- `template_code`) through sub-selects. No UUID is hardcoded: the physician ids are generated by
-- `gen_random_uuid()` and differ between the live database and any fresh one.
--
-- Every examination except Fecalysis was previously unrestricted, so all three rostered
-- physicians are assigned to it and today's choices all stay available. Fecalysis is the one
-- restriction: only Dr. Ralph Roland Asperas and Dr. Heinz Roland Asperas may request it, so
-- Dr. Ma. Floricel Dedace-Lagrazon gets no Fecalysis row.
--
-- The seventeen codes are named explicitly rather than harvested with a bare `FROM
-- report_templates`, so an eighteenth examination added later is NOT silently assigned to the
-- whole roster - that must be an Administrator's decision.
--
-- Idempotent: ON CONFLICT DO NOTHING on the (physician_id, template_code) key. A re-application
-- inserts nothing and overwrites nothing, and an Administrator who has since un-assigned a
-- physician does not get that un-assignment undone... except that a removed row would be
-- re-inserted, which is why this seed is applied once and the migration is never re-run against
-- a database an Administrator has edited.
INSERT INTO physician_examination_assignments (physician_id, template_code)
SELECT p.id, t.template_code
FROM physicians p
CROSS JOIN report_templates t
WHERE p.full_name IN (
        'Dr. Ralph Roland Asperas',
        'Dr. Heinz Roland Asperas',
        'Dr. Ma. Floricel Dedace-Lagrazon'
    )
  AND t.template_code IN (
        'BLOOD_TYPING', 'CBC', 'CHEM_10', 'CHEM_8', 'CT_BT', 'DENGUE_DUO',
        'ESR', 'FECALYSIS', 'HBA1C', 'HBSAG', 'HDL_LDL', 'HIV_RESULT',
        'OGTT', 'PREG_TEST', 'RBS', 'RPR', 'URINALYSIS'
    )
  AND NOT (
        t.template_code = 'FECALYSIS'
        AND p.full_name = 'Dr. Ma. Floricel Dedace-Lagrazon'
    )
ON CONFLICT (physician_id, template_code) DO NOTHING;

-- ─────────────────────────────── Seed: the default per examination ──────────────────────────
--
-- Each pair below reproduces the declarative default already shipped in
-- `src/domain/definitions/*.ts` as `requestedByPolicy.defaultPhysician`, with one deliberate
-- correction: ALL SIX Clinical Chemistry examinations default to Dr. Heinz Roland Asperas.
-- CHEM_10, HDL_LDL, HBA1C and OGTT already did; CHEM_8 and RBS declared Dr. Ralph Roland Asperas
-- and are corrected here.
--
-- BLOOD_TYPING, HIV_RESULT and URINALYSIS are absent on purpose. Their definitions declare
-- `defaultPhysician: null` - staff entry is required - so they get no default row, and the
-- partial unique index is satisfied by their having zero default assignments.
--
-- Idempotent and non-clobbering. The NOT EXISTS guard sets a seeded default only for an
-- examination that currently has none, so re-application is a no-op and an Administrator who has
-- moved a default to a different physician keeps that choice. The flag is set on the assignment
-- row itself, so a default can only ever land on a physician who is assigned.
WITH seeded_defaults(template_code, physician_full_name) AS (
    VALUES
        -- Clinical Chemistry: all six default to Dr. Heinz Roland Asperas.
        ('CHEM_8',      'Dr. Heinz Roland Asperas'),
        ('CHEM_10',     'Dr. Heinz Roland Asperas'),
        ('HDL_LDL',     'Dr. Heinz Roland Asperas'),
        ('OGTT',        'Dr. Heinz Roland Asperas'),
        ('RBS',         'Dr. Heinz Roland Asperas'),
        ('HBA1C',       'Dr. Heinz Roland Asperas'),
        -- Every other examination keeps the default its definition already declares.
        ('CBC',         'Dr. Ralph Roland Asperas'),
        ('CT_BT',       'Dr. Ralph Roland Asperas'),
        ('ESR',         'Dr. Ralph Roland Asperas'),
        ('FECALYSIS',   'Dr. Ralph Roland Asperas'),
        ('HBSAG',       'Dr. Ralph Roland Asperas'),
        ('RPR',         'Dr. Ralph Roland Asperas'),
        ('DENGUE_DUO',  'Dr. Ralph Roland Asperas'),
        ('PREG_TEST',   'Dr. Ralph Roland Asperas')
)
UPDATE physician_examination_assignments a
SET is_default = TRUE
FROM seeded_defaults d
JOIN physicians p ON p.full_name = d.physician_full_name
WHERE a.template_code = d.template_code
  AND a.physician_id = p.id
  AND NOT EXISTS (
        SELECT 1
        FROM physician_examination_assignments existing
        WHERE existing.template_code = d.template_code
          AND existing.is_default
    );
