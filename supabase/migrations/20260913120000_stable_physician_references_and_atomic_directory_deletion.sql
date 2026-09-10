-- Stable physician references on laboratory reports, and atomic permanent deletion of directory
-- records together with their deletion audit.
--
-- WHY THIS EXISTS. A laboratory report stores its Requested By as printed text in
-- `encoding_data.requestedBy`. Text is the right thing to PRINT - a report must keep the name it
-- was issued with - but it is the wrong thing to PROTECT by: a physician renamed after appearing on
-- a report no longer matches the old text, and a name check made before a delete cannot see a
-- report saved an instant later. This migration gives each report a stable reference to the
-- managed physician its text names, and makes the database refuse to delete a physician any
-- retained report references. The printed text is not touched; it stays exactly as issued.
--
-- It also replaces the two direct table deletes the application issued for inactive personnel and
-- physicians, each followed by a separate audit request, with one function per record type that
-- re-decides every condition and writes the deletion audit in the SAME transaction as the delete.
-- The delete and its audit commit together or not at all.
--
-- WHAT THIS FILE DOES, IN ORDER.
--   1. Adds `laboratory_reports.requesting_physician_id`, nullable, a foreign key to physicians(id)
--      ON DELETE RESTRICT, with an index for the foreign-key check a physician delete performs.
--   2. Refuses to continue if any physician has ever been renamed (see the guard below).
--   3. Backfills the reference for reports whose Requested By text EXACTLY equals a current
--      physician name, and nothing else.
--   4. Adds the trigger that keeps the reference correct on every later report write.
--   5. Adds delete_inactive_personnel() and delete_inactive_physician().
--
-- WHAT THIS FILE NEVER DOES. No applied migration is edited. Nothing is dropped or truncated. No
-- existing column is altered. The only row changes are the backfill UPDATE, which writes the NEW
-- column only; `encoding_data`, `demographics`, `completed_snapshot`, signatories, results and
-- audit rows are never written. The two DELETE statements live inside function bodies and run only
-- when an Administrator deletes a record. No foreign key added or relied on here cascades.
--
-- SECURITY POSTURE, matching save_physician_configuration() and every other function in this
-- schema: SECURITY INVOKER, never SECURITY DEFINER, so no function carries a privilege of its own;
-- a fixed `search_path` of `public, pg_temp` so nothing placed on a caller's path can shadow a
-- referenced table; EXECUTE revoked from PUBLIC, anon and authenticated and granted only to
-- service_role, the role the server-only credential authenticates as. The application server
-- stays the authorization boundary - the Administrator guard runs before the payload is parsed -
-- and these functions are transaction boundaries that nevertheless re-decide their inputs.
--
-- RECOVERY (not executed; recorded so a rollback needs no reconstruction). The application must be
-- returned to its previous revision first, because the new server actions call these functions:
--   DROP TRIGGER trg_laboratory_reports_resolve_requesting_physician ON laboratory_reports;
--   DROP FUNCTION resolve_laboratory_report_requesting_physician();
--   DROP FUNCTION delete_inactive_physician(uuid, uuid, text, text);
--   DROP FUNCTION delete_inactive_personnel(uuid, uuid, text, text);
--   ALTER TABLE laboratory_reports DROP COLUMN requesting_physician_id;
-- Dropping the column drops its foreign key and index with it. No printed text, snapshot or audit
-- row depends on the column, so nothing else needs restoring.

-- ── 1. The stable reference ─────────────────────────────────────────────────────────────────────
-- Nullable by design: free-text Requested By - a doctor the laboratory has not added to its
-- directory, or a blank field - remains allowed and carries no reference. ON DELETE RESTRICT, never
-- CASCADE or SET NULL: deleting a physician must never delete a report or silently detach it.
ALTER TABLE laboratory_reports
  ADD COLUMN IF NOT EXISTS requesting_physician_id uuid NULL
    CONSTRAINT laboratory_reports_requesting_physician_id_fkey
    REFERENCES physicians (id) ON DELETE RESTRICT;

-- The physician delete checks this foreign key by scanning laboratory_reports for the id. Without
-- an index that check is a sequential scan of every report ever issued.
CREATE INDEX IF NOT EXISTS idx_laboratory_reports_requesting_physician_id
  ON laboratory_reports (requesting_physician_id);

-- ── 2. The rename guard ─────────────────────────────────────────────────────────────────────────
-- The backfill below links a report to the physician whose CURRENT name equals its text. That is
-- only correct if no physician has ever been renamed: a renamed physician's older reports carry a
-- name nobody holds now, and a later physician given that name would be linked to reports they
-- never requested. Every rename is audited as PhysicianRecordUpdated with "fullName" among its
-- changedFields, so this refuses to backfill - and rolls the whole migration back - if one exists.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM audit_logs
    WHERE event_type = 'PhysicianRecordUpdated'
      AND jsonb_typeof(details -> 'changedFields') = 'array'
      AND (details -> 'changedFields') ? 'fullName'
  ) THEN
    RAISE EXCEPTION 'A physician has been renamed; the exact-name backfill is not safe to run';
  END IF;
END
$$;

-- ── 3. The backfill ─────────────────────────────────────────────────────────────────────────────
-- Exact and unambiguous only:
--   * the report's own Requested By is a JSON string equal, byte for byte, to a physician's
--     current full name. physicians.full_name is UNIQUE, so an exact match names one physician.
--     A name differing only in case, spacing or punctuation is NOT matched and stays null.
--   * for a completed report, the frozen snapshot must agree: exactly one frozen report for this
--     examination, printing exactly the same Requested By. Anything else is ambiguous and stays
--     null.
-- A report whose text names nobody in the directory stays null: it is free text. A legacy report
-- with no per-report Requested By stays null too; its session-level name is still protected by the
-- name check in delete_inactive_physician() below.
-- This runs BEFORE the trigger in step 4 exists, so the trigger cannot rewrite what it sets.
UPDATE laboratory_reports AS report
SET requesting_physician_id = physician.id
FROM physicians AS physician, patient_report_sessions AS session
WHERE session.id = report.session_id
  AND report.requesting_physician_id IS NULL
  AND jsonb_typeof(report.encoding_data -> 'requestedBy') = 'string'
  AND physician.full_name = report.encoding_data ->> 'requestedBy'
  AND (
    session.completed_snapshot IS NULL
    OR (
      jsonb_typeof(session.completed_snapshot -> 'reports') = 'array'
      AND (
        SELECT count(*)
        FROM jsonb_array_elements(session.completed_snapshot -> 'reports') AS frozen(report_element)
        WHERE frozen.report_element ->> 'templateCode' = report.template_code
      ) = 1
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements(session.completed_snapshot -> 'reports') AS frozen(report_element)
        WHERE frozen.report_element ->> 'templateCode' = report.template_code
          AND frozen.report_element -> 'requestedBy' = report.encoding_data -> 'requestedBy'
      )
    )
  );

-- ── 4. Keeping the reference correct on every later write ───────────────────────────────────────
-- The reference is decided by the database, never supplied by the application: every writer of a
-- report - draft save, completion, Replacement Mode, and any added later - gets it without having
-- to remember it, exactly as the deactivation rule is enforced at the row in
-- 20260912120000_physician_deactivation_clears_defaults.sql. A value the caller supplies for the
-- column is ignored.
--
--   * While a report's Requested By text is UNCHANGED, its reference is kept as it is. This is the
--     rename protection: a physician renamed after being selected still owns the reports that print
--     the old name, and so still cannot be deleted while any of them is retained. It also means a
--     report written as free text is not quietly linked later because a physician of that name was
--     added afterwards.
--   * When the text is written for the first time, or changed, the reference is the physician whose
--     CURRENT name equals the new text exactly - the managed physician the operator selected - or
--     null when no physician holds that name.
--
-- FOR KEY SHARE closes the save/delete race from this side: it holds the matched physician row
-- until the report's transaction ends, so a concurrent delete waits and then meets the foreign key.
-- If the delete got there first, this lookup finds no row and the report is saved as free text,
-- which is what it has become. It does not conflict with a status change, which takes a weaker row
-- lock. It does conflict with a rename: `full_name` carries a unique index, so changing it locks
-- the row FOR UPDATE, and the rename and an in-flight report save naming that physician wait for
-- each other in turn. Neither writes the other's table, so no deadlock can form between them.
CREATE OR REPLACE FUNCTION resolve_laboratory_report_requesting_physician()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_requested_by text;
  v_physician_id uuid;
BEGIN
  IF TG_OP = 'UPDATE'
     AND (NEW.encoding_data -> 'requestedBy') IS NOT DISTINCT FROM (OLD.encoding_data -> 'requestedBy')
  THEN
    NEW.requesting_physician_id := OLD.requesting_physician_id;
    RETURN NEW;
  END IF;

  IF jsonb_typeof(NEW.encoding_data -> 'requestedBy') = 'string' THEN
    v_requested_by := NEW.encoding_data ->> 'requestedBy';
  END IF;

  v_physician_id := NULL;
  IF v_requested_by IS NOT NULL AND v_requested_by <> '' THEN
    SELECT physicians.id
    INTO v_physician_id
    FROM physicians
    WHERE physicians.full_name = v_requested_by
    FOR KEY SHARE;
  END IF;

  NEW.requesting_physician_id := v_physician_id;
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION resolve_laboratory_report_requesting_physician() FROM PUBLIC, anon, authenticated;

-- BEFORE, so the value is decided before the row is written and before the foreign key is checked.
-- Every INSERT and every UPDATE, not only UPDATE OF encoding_data: an UPDATE that tries to set the
-- reference directly while leaving the text alone keeps the reference it had.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_laboratory_reports_resolve_requesting_physician'
      AND tgrelid = 'laboratory_reports'::regclass
  ) THEN
    CREATE TRIGGER trg_laboratory_reports_resolve_requesting_physician
    BEFORE INSERT OR UPDATE ON laboratory_reports
    FOR EACH ROW
    EXECUTE FUNCTION resolve_laboratory_report_requesting_physician();
  END IF;
END
$$;

-- ── 5. Atomic permanent deletion ────────────────────────────────────────────────────────────────
-- Shared shape of both functions:
--
--   * INPUTS ARE RE-DECIDED. The record id and the acting Administrator are required; the recorded
--     actor must be an Administrator. Anything else raises INVALID_PAYLOAD (ST007), the same
--     SQLSTATE save_physician_configuration() uses, and the application treats it as a bug.
--   * THE ROW IS LOCKED FIRST, FOR UPDATE. From that moment nothing can reactivate it, and no
--     other transaction can commit a new row referencing it: a foreign-key check on insert needs a
--     FOR KEY SHARE lock on this row and waits. Every check below therefore reads a state that
--     cannot change before the delete.
--   * THE OUTCOME IS ONE OF A CLOSED SET OF WORDS, returned rather than raised, so a refusal
--     commits nothing and needs no audit: DELETED, NOT_FOUND, STILL_ACTIVE,
--     REFERENCED_BY_REPORTS, and for a physician HAS_ASSIGNMENTS.
--   * REFERENCES HELD BY A FOREIGN KEY ARE DECIDED BY THAT FOREIGN KEY, at the delete itself.
--     A violation of the one expected constraint is mapped to REFERENCED_BY_REPORTS; any other
--     violation is re-raised. References with no foreign key behind them - names inside JSON - are
--     checked explicitly before the delete.
--   * THE AUDIT IS WRITTEN AFTER THE DELETE, IN THE SAME TRANSACTION. It is never written before a
--     delete that can still fail, and if it cannot be written the error aborts the transaction and
--     the delete with it. A DELETED answer therefore means both committed.

-- Personnel. `report_signatories.personnel_id` is the only foreign key into personnel; the other
-- place a report names a person is the signatory list frozen into a completed snapshot.
--
-- The signature image is NOT touched: it stays in the private bucket, unreachable once no row
-- references it. Its storage path is recorded in the audit under the curated `objectPath` key, and
-- only when the stored reference is in the exact form the signature upload writes -
-- `/api/signatures/proxy?path=` followed by the URI-encoded `personnel/<uuid>/<uuid>.png` - so a
-- reference in any other form is never guessed at.
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
  v_constraint text;
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

  IF EXISTS (
    SELECT 1
    FROM patient_report_sessions
    WHERE patient_report_sessions.completed_snapshot @> jsonb_build_object(
      'reports',
      jsonb_build_array(
        jsonb_build_object(
          'signatories',
          jsonb_build_array(jsonb_build_object('personnelId', v_personnel.id::text))
        )
      )
    )
  ) THEN
    RETURN 'REFERENCED_BY_REPORTS';
  END IF;

  BEGIN
    DELETE FROM personnel
    WHERE personnel.id = v_personnel.id
      AND NOT personnel.is_active;
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
  EXCEPTION WHEN foreign_key_violation THEN
    GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
    IF v_constraint = 'report_signatories_personnel_id_fkey' THEN
      RETURN 'REFERENCED_BY_REPORTS';
    END IF;
    RAISE;
  END;

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

-- Physicians. Two foreign keys point here: the examination assignments (ON DELETE RESTRICT) and
-- the report reference added above (ON DELETE RESTRICT). Assignments are checked explicitly and
-- first, so a physician holding both is told to clear the assignments - the step the Administrator
-- can actually take. Assignments are never cascaded or cleared here.
--
-- A report names a physician either by the stable reference - decided by its foreign key at the
-- delete - or by printed text with no reference: a report's own Requested By, a legacy session's
-- requesting physician, or a Requested By frozen into a completed snapshot. The text is matched
-- against the physician's CURRENT name as a whole JSON value, never as a substring.
CREATE OR REPLACE FUNCTION delete_inactive_physician(
  p_physician_id uuid,
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
  v_physician physicians%ROWTYPE;
  v_constraint text;
  v_deleted bigint;
BEGIN
  IF p_physician_id IS NULL
     OR p_actor_user_id IS NULL
     OR p_actor_username IS NULL
     OR btrim(p_actor_username) = ''
     OR p_actor_role IS DISTINCT FROM 'Admin'
  THEN
    RAISE EXCEPTION 'INVALID_PAYLOAD: record id and Administrator actor are required'
      USING ERRCODE = 'ST007';
  END IF;

  SELECT *
  INTO v_physician
  FROM physicians
  WHERE physicians.id = p_physician_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'NOT_FOUND';
  END IF;

  IF v_physician.is_active THEN
    RETURN 'STILL_ACTIVE';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM physician_examination_assignments
    WHERE physician_examination_assignments.physician_id = v_physician.id
  ) THEN
    RETURN 'HAS_ASSIGNMENTS';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM laboratory_reports
    WHERE laboratory_reports.encoding_data @> jsonb_build_object('requestedBy', v_physician.full_name)
  ) OR EXISTS (
    SELECT 1
    FROM patient_report_sessions
    WHERE patient_report_sessions.demographics @> jsonb_build_object('requestingPhysician', v_physician.full_name)
  ) OR EXISTS (
    SELECT 1
    FROM patient_report_sessions
    WHERE patient_report_sessions.completed_snapshot @> jsonb_build_object(
      'reports',
      jsonb_build_array(jsonb_build_object('requestedBy', v_physician.full_name))
    )
  ) THEN
    RETURN 'REFERENCED_BY_REPORTS';
  END IF;

  BEGIN
    DELETE FROM physicians
    WHERE physicians.id = v_physician.id
      AND NOT physicians.is_active;
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
  EXCEPTION WHEN foreign_key_violation THEN
    GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
    IF v_constraint = 'laboratory_reports_requesting_physician_id_fkey' THEN
      RETURN 'REFERENCED_BY_REPORTS';
    END IF;
    RAISE;
  END;

  IF v_deleted <> 1 THEN
    RAISE EXCEPTION 'Physician deletion affected % rows', v_deleted;
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
    'PhysicianRecordDeleted',
    p_actor_user_id,
    p_actor_username,
    v_physician.full_name,
    jsonb_build_object('isActive', v_physician.is_active),
    p_actor_role,
    NULL
  );

  RETURN 'DELETED';
END;
$function$;

REVOKE EXECUTE ON FUNCTION delete_inactive_physician(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION delete_inactive_physician(uuid, uuid, text, text) TO service_role;
