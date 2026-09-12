-- Retention enforcement keeps its behaviour and loses the hard-coded window from its message.
--
-- WHY A NEW MIGRATION. `assert_session_within_retention` was defined in
-- 20260815200000_atomic_expiry_enforcement.sql, which is already applied. An applied migration is
-- history and is never edited in place, so the correction arrives forward, as its own file.
--
-- WHAT CHANGES: the exception text, and nothing else. The predicate is untouched and was already
-- window-agnostic - it compares the session's stored `expires_at` against `now()` and says nothing
-- about how long the window is. The old message named "30-day", which stopped being true when the
-- client reduced the completed-session window to seven days, and the duration lives entirely in
-- application code (SYSTEM_CONSTANTS.RETENTION.COMPLETED_REPORT_DAYS) where no SQL can read it. So
-- the message now states the fact it can actually know - that the window has passed - and names no
-- number at all, which is what stops it going stale the next time the window moves.
--
-- WHAT IS CARRIED FORWARD VERBATIM: the signature, `LANGUAGE plpgsql`, `SECURITY INVOKER`, the
-- `SET search_path = public, pg_temp` pin, the body, and the callers (`save_draft_session`,
-- `complete_patient_report_session`, `replace_completed_session`). Checkpoint B5 pins that
-- declaration shape, so it is reproduced exactly rather than restated in another valid spelling.
-- `CREATE OR REPLACE` preserves existing privileges, and the REVOKE/GRANT pair is restated anyway so
-- this file is correct on its own and cannot widen execute rights by omission.
--
-- Safe to apply on its own; it carries no data change. It is independent of
-- 20260915120000_seven_day_completed_retention_reconciliation.sql, which is armed locally and has
-- not been applied. That file deletes nothing itself - it only rewrites completed-session expiry
-- metadata - but applying it would immediately expire eight existing completed sessions, and a
-- later purge run could then permanently delete those expired sessions.

CREATE OR REPLACE FUNCTION assert_session_within_retention(target_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM patient_report_sessions
    WHERE id = target_session_id
      AND status = 'Completed'
      AND expires_at IS NOT NULL
      AND expires_at < now()
  ) THEN
    RAISE EXCEPTION 'Session % has passed its retention window and is permanently immutable', target_session_id;
  END IF;
END;
$function$;

REVOKE EXECUTE ON FUNCTION assert_session_within_retention(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION assert_session_within_retention(uuid) TO service_role;
