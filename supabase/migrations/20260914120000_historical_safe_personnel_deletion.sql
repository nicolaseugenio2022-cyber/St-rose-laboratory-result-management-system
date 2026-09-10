-- Historical-safe permanent deletion of an inactive personnel record.
--
-- WHY THIS EXISTS. `report_signatories` is already, by its own DDL comment, the "frozen medical
-- professional signatories snapshot": every fact a completed report prints about the person who
-- signed it - `printed_full_name`, `printed_credentials`, `printed_prc_license_number`, `role`,
-- `display_order` - is stored on that row, together with `signature_image_url`, the reference to
-- the object in the private signatures bucket. A completed report's signatory block is rendered
-- from that frozen data and from the frozen `completed_snapshot`; current personnel is never
-- consulted for it.
--
-- The one thing that still tied a completed report to the LIVE directory was
-- `report_signatories.personnel_id`, whose foreign key pointed at `personnel(id)`. That foreign
-- key, plus an explicit scan of `completed_snapshot`, made `delete_inactive_personnel()` answer
-- REFERENCED_BY_REPORTS for anyone who had ever signed. A Pathologist or Medical Technologist who
-- has left the laboratory therefore could not be removed from the directory, only deactivated.
--
-- `personnel_id` cannot simply be nulled. The signature IMAGE of a completed report is addressed as
-- `/api/signatures/proxy?reportId=<report>&personnelId=<person>`, and the route resolves it by
-- selecting the `report_signatories` row on exactly that pair (`src/app/api/signatures/proxy/
-- route.ts`). Detaching the column would keep the printed text and silently lose the signature.
-- The column must keep its exact value.
--
-- THE DESIGN. `personnel_id` stops being a pointer into the live directory and becomes what the
-- frozen row always needed: a stable identity. A new table, `personnel_identities`, records the
-- identity of every personnel record ever created. `personnel` becomes a child of it, and
-- `report_signatories.personnel_id` is repointed at it. Deleting the live `personnel` row leaves
-- the identity - and therefore the signatory row, its printed fields, its signature reference and
-- the frozen snapshot - exactly as issued.
--
-- The foreign key is not removed and nothing is cascaded. It is moved to a parent that outlives the
-- directory record, so the guarantee it enforces is STRONGER than before: a signatory row could
-- previously be orphaned only because deletion was forbidden outright, whereas an identity row is
-- never deleted at all.
--
-- WHAT THIS FILE DOES, IN ORDER.
--   1. Creates `personnel_identities`, with the project's standard posture: RLS on, no policies,
--      EXECUTE/DML revoked from PUBLIC, anon and authenticated, granted only to service_role.
--   2. Backfills one identity per existing personnel record.
--   3. Makes `personnel.id` a foreign key to it, ON DELETE RESTRICT - deleting a directory record
--      never deletes its identity.
--   4. Adds the BEFORE INSERT trigger that records the identity of every new personnel record, so
--      the application never has to know the table exists.
--   5. Repoints `report_signatories_personnel_id_fkey` from `personnel(id)` to
--      `personnel_identities(id)`, keeping the constraint name and ON DELETE RESTRICT.
--   6. Replaces `delete_inactive_personnel()` with the historical-safe policy.
--
-- WHAT THIS FILE NEVER DOES. No applied migration is edited. Nothing is dropped or truncated
-- except the one foreign-key constraint that is immediately re-created against the new parent. No
-- existing column is altered, renamed or nulled. `report_signatories`, `laboratory_reports`,
-- `laboratory_results`, `patient_report_sessions.completed_snapshot` and `audit_logs` are never
-- written by this migration or by the function it installs. No foreign key added or relied on here
-- cascades. Signature objects stay in the private bucket, untouched.
--
-- SECURITY POSTURE, unchanged and matching every other function in this schema: SECURITY INVOKER,
-- never SECURITY DEFINER, so no function carries a privilege of its own; a fixed `search_path` of
-- `public, pg_temp`; EXECUTE revoked from PUBLIC, anon and authenticated and granted only to
-- service_role. The application server stays the authorization boundary - `requirePersonnelAdmin()`
-- runs before the payload is parsed - and the function re-decides the Administrator actor and the
-- record's inactivity for itself.
--
-- RECOVERY (not executed; recorded so a rollback needs no reconstruction). Return the application
-- to its previous revision first, then:
--   -- Restore the previous refusal policy by re-running section 5 of
--   -- 20260913120000_stable_physician_references_and_atomic_directory_deletion.sql, then:
--   ALTER TABLE report_signatories DROP CONSTRAINT report_signatories_personnel_id_fkey;
--   ALTER TABLE report_signatories
--     ADD CONSTRAINT report_signatories_personnel_id_fkey
--     FOREIGN KEY (personnel_id) REFERENCES personnel (id);
--   DROP TRIGGER trg_personnel_record_identity ON personnel;
--   DROP FUNCTION record_personnel_identity();
--   ALTER TABLE personnel DROP CONSTRAINT personnel_id_identity_fkey;
--   DROP TABLE personnel_identities;
--
-- RE-CREATING THE ORIGINAL CONSTRAINT SUCCEEDS ONLY WHILE EVERY `report_signatories.personnel_id`
-- STILL NAMES A LIVE PERSONNEL RECORD. Once one record has been deleted under this policy, the
-- step above fails until that record is re-created WITH ITS ORIGINAL ID. It can be, and this is
-- where every field comes from - none of it is lost, so the rollback needs no guesswork:
--
--   * the id, the role and the retained signature object path - `audit_logs`, from the
--     `PersonnelRecordDeleted` row: `details ->> 'personnelId'`, `details ->> 'personnelRole'`,
--     `details ->> 'objectPath'` (present only when a signature was on file);
--   * the printed name, credentials and PRC licence number - any surviving `report_signatories`
--     row for that `personnel_id`: `printed_full_name`, `printed_credentials`,
--     `printed_prc_license_number`. `prc_license_number` is UNIQUE on `personnel`, so it must be
--     taken from here rather than invented;
--   * `signature_image_url` - the same signatory row's `signature_image_url`. The object itself was
--     never deleted from the bucket, so the restored row points at live bytes.
--   * `first_name` / `last_name` - `audit_logs.target_reference` holds them joined by one space,
--     and `printed_full_name` gives the same two parts in the screen's own format. Where the split
--     is ambiguous, prefer the operator's confirmation over a guess: only the two columns' split is
--     uncertain, never the name itself.
--
-- The row must be re-created by direct SQL, not through the application:
-- `SupabasePersonnelRepository.create()` omits `id`, so it physically cannot restore the original
-- identifier, and the identifier is the whole point. The BEFORE INSERT trigger will re-insert the
-- identity if it was dropped with the table, and will raise `unique_violation` if the identity is
-- still present - drop the trigger (as above) before re-creating the row, or delete the identity
-- row first.
--
-- Nothing else needs restoring: no printed text, snapshot, signatory row, audit row or storage
-- object is changed by this migration.

-- ── 1. The permanent identity ───────────────────────────────────────────────────────────────────
-- One row per personnel record ever created, and nothing more. The identity facts a completed
-- report needs are already frozen on `report_signatories` and inside `completed_snapshot`;
-- duplicating them here would create a second, divergable copy of a printed clinical fact. What
-- this table adds is the one thing those rows cannot state for themselves: that the id they carry
-- was genuinely issued by this laboratory's personnel directory, and not fabricated.
--
-- Rows are inserted only by the trigger in section 4, and are never deleted or updated.
CREATE TABLE IF NOT EXISTS personnel_identities (
    id UUID PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The project's posture for every table (05_rls_policies.sql): RLS is defence in depth, the
-- application server is the authoritative boundary, and privileged access uses the server-only
-- credential. No policy is defined here, exactly as no policy is defined for `personnel` or
-- `report_signatories`.
ALTER TABLE personnel_identities ENABLE ROW LEVEL SECURITY;

-- Supabase grants new public tables to anon and authenticated by default. Every existing table in
-- this schema is reachable only by service_role, and this one must match rather than become the
-- single table a browser-held key can read.
REVOKE ALL ON TABLE personnel_identities FROM PUBLIC, anon, authenticated;

-- Narrow on purpose, the way physicians and physician_examination_assignments are narrowed rather
-- than granted wholesale. An identity row is written once and never changed or removed, and the
-- historical-safety argument of this whole migration rests on exactly that: a signatory row keeps a
-- valid parent forever. So the privilege set says it. Supabase's default grant to service_role is
-- ALL, so the REVOKE is what actually enforces this - the GRANT alone would be decorative.
--
-- Nothing needs the removed verbs. The trigger in section 4 only inserts; the two foreign-key
-- checks are performed by the constraints' own internal triggers with the constraint owner's
-- rights, not the caller's; and no application code reads or writes this table at all.
GRANT SELECT, INSERT ON TABLE personnel_identities TO service_role;
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE personnel_identities FROM service_role;

-- ── 2. Backfill ─────────────────────────────────────────────────────────────────────────────────
-- Every personnel record that exists now gets its identity. `report_signatories.personnel_id` is
-- NOT NULL and currently references `personnel(id)`, so every signatory row already names a live
-- personnel record and is covered by this backfill; the constraint added in section 5 would refuse
-- to be created otherwise, which is the check.
INSERT INTO personnel_identities (id)
SELECT personnel.id FROM personnel
ON CONFLICT (id) DO NOTHING;

-- ── 3. Personnel becomes a child of its identity ────────────────────────────────────────────────
-- ON DELETE RESTRICT, never CASCADE: this is the direction that matters. Deleting a personnel row
-- is the CHILD side and stays permitted; deleting an identity would have to clear the directory
-- record first, and nothing ever does.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'personnel_id_identity_fkey'
      AND conrelid = 'personnel'::regclass
  ) THEN
    ALTER TABLE personnel
      ADD CONSTRAINT personnel_id_identity_fkey
      FOREIGN KEY (id) REFERENCES personnel_identities (id) ON DELETE RESTRICT;
  END IF;
END
$$;

-- ── 4. Recording the identity of every new personnel record ─────────────────────────────────────
-- Decided by the database, never supplied by the application, exactly as the requesting-physician
-- reference is in 20260913120000_stable_physician_references_and_atomic_directory_deletion.sql.
-- `SupabasePersonnelRepository.create()` inserts a row whose type omits `id`, so the id is always a
-- fresh `gen_random_uuid()` and this insert always succeeds.
--
-- Deliberately NOT `ON CONFLICT DO NOTHING`: an insert that supplied a RETIRED identity would
-- otherwise be accepted and the new person would silently inherit the deleted person's place on
-- every historical report. Raising `unique_violation` makes identity reuse impossible.
CREATE OR REPLACE FUNCTION record_personnel_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $function$
BEGIN
  INSERT INTO personnel_identities (id) VALUES (NEW.id);
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION record_personnel_identity() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_personnel_record_identity'
      AND tgrelid = 'personnel'::regclass
  ) THEN
    CREATE TRIGGER trg_personnel_record_identity
    BEFORE INSERT ON personnel
    FOR EACH ROW
    EXECUTE FUNCTION record_personnel_identity();
  END IF;
END
$$;

-- ── 5. The frozen signatory now references the identity ─────────────────────────────────────────
-- Same constraint name, same column, same NOT NULL, same values - only the parent changes. The row
-- keeps its exact `personnel_id`, which is what the completed report's signature address is
-- resolved by.
--
-- ON DELETE RESTRICT is stated explicitly rather than left to the default NO ACTION the original
-- constraint carried: identity rows are never deleted, and the constraint should say so at the
-- point where a future writer would look.
ALTER TABLE report_signatories DROP CONSTRAINT IF EXISTS report_signatories_personnel_id_fkey;
ALTER TABLE report_signatories
  ADD CONSTRAINT report_signatories_personnel_id_fkey
  FOREIGN KEY (personnel_id) REFERENCES personnel_identities (id) ON DELETE RESTRICT;

-- ── 6. Historical-safe permanent deletion ───────────────────────────────────────────────────────
-- The shape of the function is unchanged from
-- 20260913120000_stable_physician_references_and_atomic_directory_deletion.sql, and so is every
-- guarantee it already made:
--
--   * INPUTS ARE RE-DECIDED. The record id and the acting Administrator are required; the recorded
--     actor must be an Administrator. Anything else raises INVALID_PAYLOAD (ST007).
--   * THE ROW IS LOCKED FIRST, FOR UPDATE, so nothing can reactivate it between the check and the
--     delete.
--   * THE OUTCOME IS ONE OF A CLOSED SET OF WORDS, returned rather than raised, so a refusal
--     commits nothing and needs no audit.
--   * THE AUDIT IS WRITTEN AFTER THE DELETE, IN THE SAME TRANSACTION. If it cannot be written the
--     error aborts the transaction and the delete with it. A DELETED answer means both committed.
--   * THE SIGNATURE IMAGE IS NOT TOUCHED. It stays in the private bucket, still referenced by
--     `report_signatories.signature_image_url` and therefore still served by the signature proxy to
--     an authorized caller viewing the completed report. Its storage path is recorded in the audit
--     under the curated `objectPath` key, and only when the stored reference is in the exact form
--     the signature upload writes.
--
-- WHAT CHANGES, and only this:
--
--   * REFERENCED_BY_REPORTS is gone. The `completed_snapshot` scan that returned it is removed, and
--     so is the mapping of a `report_signatories_personnel_id_fkey` violation onto it - after
--     section 5 that constraint cannot be violated by this delete, because the delete no longer
--     touches the constraint's parent table. Personnel now answer exactly one of DELETED,
--     NOT_FOUND or STILL_ACTIVE. Physicians are unaffected: `delete_inactive_physician()` is not
--     redefined here and keeps REFERENCED_BY_REPORTS and HAS_ASSIGNMENTS.
--   * The DELETE is issued directly, with no exception handler. Nothing references `personnel` any
--     more, so a foreign-key violation here would be an unmodelled state, and aborting the
--     transaction is the correct answer to it - never a refusal word that would misreport it.
--
-- WHAT DOES NOT CHANGE. `NOT personnel.is_active` stays on the DELETE itself, so the active-record
-- rule is enforced by the statement and not only by the check above it. The row count is still
-- verified before anything is audited.
CREATE OR REPLACE FUNCTION delete_inactive_personnel(
  p_personnel_id uuid,
  p_actor_user_id uuid,
  p_actor_username text,
  p_actor_role text
)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_personnel personnel%ROWTYPE;
  v_details jsonb;
  v_deleted bigint;
BEGIN
  IF p_personnel_id IS NULL
     OR p_actor_user_id IS NULL
     OR p_actor_username IS NULL
     OR btrim(p_actor_username) = ''
     OR p_actor_role IS DISTINCT FROM 'Admin'
  THEN
    RAISE EXCEPTION 'INVALID_PAYLOAD: record id and Administrator actor are required'
      USING ERRCODE = 'ST007';
  END IF;

  SELECT *
  INTO v_personnel
  FROM personnel
  WHERE personnel.id = p_personnel_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'NOT_FOUND';
  END IF;

  IF v_personnel.is_active THEN
    RETURN 'STILL_ACTIVE';
  END IF;

  DELETE FROM personnel
  WHERE personnel.id = v_personnel.id
    AND NOT personnel.is_active;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  -- The row is locked and was inactive, so exactly one row is deleted. Anything else is not a state
  -- this function can explain, and it must not be audited as a deletion.
  IF v_deleted <> 1 THEN
    RAISE EXCEPTION 'Personnel deletion affected % rows', v_deleted;
  END IF;

  v_details := jsonb_build_object(
    'personnelId', v_personnel.id,
    'personnelRole', v_personnel.role
  );
  IF v_personnel.signature_image_url ~ '^/api/signatures/proxy\?path=personnel%2F[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}%2F[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png$' THEN
    v_details := v_details || jsonb_build_object(
      'objectPath',
      replace(substr(v_personnel.signature_image_url, char_length('/api/signatures/proxy?path=') + 1), '%2F', '/')
    );
  END IF;

  INSERT INTO audit_logs (
    category,
    event_type,
    performed_by_user_id,
    performed_by_username,
    target_reference,
    details,
    actor_role,
    target_role
  )
  VALUES (
    'PersonnelCredential',
    'PersonnelRecordDeleted',
    p_actor_user_id,
    p_actor_username,
    v_personnel.first_name || ' ' || v_personnel.last_name,
    v_details,
    p_actor_role,
    NULL
  );

  RETURN 'DELETED';
END;
$function$;

REVOKE EXECUTE ON FUNCTION delete_inactive_personnel(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION delete_inactive_personnel(uuid, uuid, text, text) TO service_role;
