-- CLIENT-HISTORY-DELETE-RETENTION: reconcile stored completed-session expiry to the seven-day window.
--
-- PREPARED, NOT APPLIED. Nothing in the application needs this migration to behave correctly: the
-- retention duration lives entirely in application code (SYSTEM_CONSTANTS.RETENTION.
-- COMPLETED_REPORT_DAYS), no SQL computes an expiry, and every completion from this candidate
-- forward already stamps `completed_at + 7 days`. This file exists only to bring sessions completed
-- BEFORE the change into line with the new window, and it must not be applied until the operator has
-- seen the measured impact below and decided.
--
-- WHAT IT DOES. Expiry metadata only, for completed sessions only. It sets
-- `expires_at = completed_at + interval '7 days'`. It does not delete, purge, archive or touch a
-- single report, result, signatory, snapshot or audit row, and it never writes a draft (a draft's
-- `expires_at` is NULL by design and stays NULL).
--
-- MEASURED IMPACT, read from the live database on 2026-09-11 before this file was written:
--
--   completed sessions                                      14
--   drafts, every one holding a NULL expiry, untouched       84
--   would REMAIN retained under completed_at + 7 days         6
--   would become EXPIRED IMMEDIATELY by this migration        8
--   the eight: SR-20260815-0006, SR-20260815-0007, SR-20260815-0008, SR-20260817-0009,
--              SR-20260817-0010, SR-20260820-0012, SR-20260823-0013, SR-20260824-0021
--
-- So applying this file immediately removes EIGHT completed sessions from the retained history view
-- and makes them immutable. It deletes nothing by itself. But note the consequence that follows:
-- `purgeExpiredSessions()` deletes every session whose `expires_at` has lapsed, so the next purge run
-- - `POST /api/purge`, an Administrator action - WOULD permanently delete those eight sessions and
-- their 115 dependent rows. That is the decision this file is waiting on, and it is why no purge is
-- performed here.
--
-- REVERSIBILITY. The previous window is recoverable arithmetically while the rows still exist:
--
--   UPDATE patient_report_sessions
--      SET expires_at = completed_at + interval '30 days'
--    WHERE status = 'Completed' AND completed_at IS NOT NULL;
--
-- That is exact, because every stored expiry was itself computed as `completed_at + 30 days`. It
-- stops being recoverable once a purge has run, which is the other reason the purge is not here.

-- ARMED, UNDER EXPLICIT USER AUTHORIZATION. An earlier revision kept this statement commented out
-- pending a decision about existing records. The client has since decided that History's lifecycle
-- is seven days for existing completed sessions as well as new ones, and the measured impact below
-- was reported and accepted before the statement was armed.
--
-- NOT YET APPLIED BY THE AGENT. Running it was attempted and refused by this environment's own
-- permission boundary for shared-resource writes - not declined on authority grounds. So it ships
-- as a migration to run, and until it runs History keeps showing whatever expiry is actually
-- stored: the view reads the stored `expires_at` and never a recomputed one, so what the operator
-- sees stays true at every moment.
--
-- VERIFIED BEFORE ARMING: all 84 drafts hold a NULL `expires_at`, and the predicate excludes them,
-- so no draft can acquire a completed-session expiry from this file.

UPDATE patient_report_sessions
   SET expires_at = completed_at + interval '7 days'
 WHERE status = 'Completed'
   AND completed_at IS NOT NULL;
