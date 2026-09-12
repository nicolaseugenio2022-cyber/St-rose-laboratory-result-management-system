-- HISTORY-DELETION-INTEGRITY-R1: completed-session deletion and its success audit, one transaction.
--
-- THE DEFECT THIS CLOSES. `deleteCompletedSessionAction` used to issue two independent PostgREST
-- requests: a DELETE on `patient_report_sessions`, which committed on its own, and then a separate
-- INSERT into `audit_logs`. A fault on the second one left the session, its reports, its results
-- and its signatories permanently destroyed with NO record of who destroyed them, and told the
-- operator the operation had failed. Deleting a clinical record without an audit trail is the one
-- outcome this operation must never produce, so the two writes move into one function body and
-- therefore into one transaction: either both land, or neither does.
--
-- WHY A FUNCTION AND NOT A CLIENT TRANSACTION. PostgREST gives each request its own implicit
-- transaction and exposes no multi-statement one, so a sequence of dependent client calls cannot be
-- made atomic from TypeScript. This is the same answer ADR-006 already required for replacement -
-- "the transactional boundary is a server-side database function invoked exclusively from the
-- application server boundary after session and role authorization" - and the same shape as
-- `delete_inactive_personnel` in 20260914120000, which this file follows deliberately.
--
-- AUTHORIZATION IS STILL THE SERVER ACTION'S. The Administrator check happens at the server
-- boundary, where the caller identity is resolved from the session cookie and can be trusted. This
-- function re-decides it as defence in depth from arguments it cannot verify, so the actor it
-- audits and the actor it admits are the same value; it never becomes the authorization boundary.
-- A User or Developer is refused before the action ever reaches this function, and EXECUTE is
-- revoked from PUBLIC, anon and authenticated so no browser role can call it at all.
--
-- RETENTION IS DELIBERATELY NOT CHECKED. `assert_session_within_retention` guards the three WRITE
-- paths - `save_draft_session`, `complete_patient_report_session`, `replace_completed_session` -
-- because an expired report is immutable. Deletion is the opposite case: an expired completed
-- session is exactly what an Administrator is entitled to remove, and calling the retention guard
-- here would make the expired records the least deletable ones in the system. Stated explicitly so
-- the omission reads as a decision rather than an oversight.
--
-- THE CASCADE IS THE SESSION'S OWN TREE AND NOTHING ELSE. One DELETE on `patient_report_sessions`
-- removes `laboratory_reports` (session_id ON DELETE CASCADE), then `laboratory_results` and
-- `report_signatories` (report_id ON DELETE CASCADE). The frozen completion snapshot is a column on
-- the session row and goes with it. Every other foreign key on those tables points OUTWARD to a
-- shared record - `user_profiles`, `report_templates`, `physicians`, `personnel_identities` - and is
-- RESTRICT or NO ACTION, so a cascade cannot traverse one. `audit_logs` has no foreign key to any
-- of them, which is why the row written here survives the deletion it records.
--
-- THE COUNT IS CAPTURED BEFORE THE DELETE, because after it there is nothing left to count. The row
-- is locked FOR UPDATE first, so the count, the status decision and the delete all describe the
-- same version of the row and a concurrent replacement cannot slip between them.
--
-- DUPLICATE CALLS CANNOT PRODUCE A DUPLICATE SUCCESS. The second caller blocks on the lock, then
-- finds no row and answers NOT_FOUND. It writes nothing and audits nothing.
--
-- WHAT IT RETURNS. One word from a closed set - DELETED, NOT_FOUND or NOT_COMPLETED - and nothing
-- else. No accession, no identifier, no count crosses back to the caller, and the three words
-- collapse into a single operator-facing sentence at the boundary, so no caller can learn whether a
-- given session exists by asking to delete it. A refusal is RETURNED rather than raised because it
-- decides nothing and writes nothing; only an unmodelled state raises.
--
-- PREPARED, NOT APPLIED - AND THE ORDER MATTERS. The repository now calls this function
-- unconditionally, so between publishing that code and applying this file every completed-session
-- deletion fails: PostgREST answers "function not found", the repository rethrows it, and the
-- action reports an unexpected failure. History already exposes the control, so the capability is
-- UNREACHABLE until this migration runs. Apply this migration FIRST, then deploy. Live acceptance
-- is deferred to that point and is the only place the rollback can be observed against real rows,
-- because the abort proved here is proved structurally, from the shape of this function.
--
-- DO NOT APPLY THIS FILE BY RUNNING EVERY PENDING MIGRATION. Two files sort BEFORE it and are
-- both unapplied, so an in-order runner executes them first:
--
--   20260915120000_seven_day_completed_retention_reconciliation.sql - ARMED. Its UPDATE rewrites
--     completed-session expiry to completed_at + 7 days. By its own measured impact that
--     immediately expires EIGHT existing completed sessions - SR-20260815-0006, -0007, -0008,
--     SR-20260817-0009, -0010, SR-20260820-0012, SR-20260823-0013, SR-20260824-0021. It deletes
--     nothing itself, but purgeExpiredSessions() then treats those eight as purgeable, and the
--     next POST /api/purge would permanently remove them and their dependent rows. That is
--     recoverable by arithmetic only until a purge has run. Read that file's own header before
--     applying it; it is waiting on an operator decision.
--   20260916120000_retention_window_agnostic_wording.sql - safe, no data change. It only replaces
--     an exception message.
--
-- This file is independent of both. Apply it ALONE, by name, unless the operator has separately
-- decided to apply the reconciliation as well.

CREATE OR REPLACE FUNCTION delete_completed_session(
  p_session_id uuid,
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
  v_session patient_report_sessions%ROWTYPE;
  v_report_count integer;
  v_deleted bigint;
BEGIN
  IF p_session_id IS NULL
     OR p_actor_user_id IS NULL
     OR p_actor_username IS NULL
     OR btrim(p_actor_username) = ''
     OR p_actor_role IS DISTINCT FROM 'Admin'
  THEN
    RAISE EXCEPTION 'INVALID_PAYLOAD: session id and Administrator actor are required'
      USING ERRCODE = 'ST007';
  END IF;

  SELECT *
  INTO v_session
  FROM patient_report_sessions
  WHERE patient_report_sessions.id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'NOT_FOUND';
  END IF;

  IF v_session.status IS DISTINCT FROM 'Completed' THEN
    RETURN 'NOT_COMPLETED';
  END IF;

  SELECT count(*)
  INTO v_report_count
  FROM laboratory_reports
  WHERE laboratory_reports.session_id = v_session.id;

  DELETE FROM patient_report_sessions
  WHERE patient_report_sessions.id = v_session.id
    AND patient_report_sessions.status = 'Completed';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  -- The row is locked and was Completed, so exactly one row is deleted. Anything else is not a
  -- state this function can explain, and it must not be audited as a deletion.
  IF v_deleted <> 1 THEN
    RAISE EXCEPTION 'Completed session deletion affected % rows', v_deleted;
  END IF;

  -- Identifiers and a count only: no demographics, no result value, no signatory, no signature
  -- path, no frozen snapshot, no credential material. The accession number is the target
  -- reference, exactly as every other session-lifecycle event records it.
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
    'SessionReport',
    'SessionCompletedDeleted',
    p_actor_user_id,
    p_actor_username,
    v_session.accession_number,
    jsonb_build_object(
      'sessionId', v_session.id,
      'reportCount', v_report_count,
      'deletedAt', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    ),
    p_actor_role,
    NULL
  );

  RETURN 'DELETED';
END;
$function$;

REVOKE EXECUTE ON FUNCTION delete_completed_session(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION delete_completed_session(uuid, uuid, text, text) TO service_role;
