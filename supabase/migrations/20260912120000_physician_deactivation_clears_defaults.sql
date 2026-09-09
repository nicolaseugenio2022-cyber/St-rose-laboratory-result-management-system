-- Deactivating a physician clears that physician's default examinations, atomically.
--
-- THE INVARIANT. A deactivated physician is not offered for new work: the workspace resolves its
-- "Requested By" choices from the ACTIVE roster only. A default is the one slot that fills itself
-- in without anybody choosing it, so a default held by a deactivated physician is a name the
-- roster refuses to suggest being pre-selected anyway. `save_physician_configuration` already
-- refuses to WRITE that state - it raises PHYSICIAN_INACTIVE (ST004) - but refusing to write a
-- state is not the same as preventing it from ARISING, and it could still arise from the other
-- direction: take a physician who legitimately holds defaults, and deactivate them.
--
-- WHY A TRIGGER AND NOT A SERVER ACTION. Three server-side paths can set `physicians.is_active`:
-- `togglePhysicianStatusAction`, `updatePhysicianAction`, and `save_physician_configuration`
-- itself. Fixing the first one leaves the second and third free to produce the same state, and
-- leaves every path added later free too. The invariant is a property of the ROW TRANSITION
-- active -> inactive, so it is enforced where that transition happens and nowhere else. Every
-- caller gets it for free, including a manual UPDATE, and no caller can forget it.
--
-- ATOMIC BY CONSTRUCTION. A row trigger runs inside the transaction of the statement that fired
-- it. The physician's status change and the clearing of their defaults therefore commit together
-- or not at all - there is no window in which a physician is inactive while still holding a
-- default, and a rolled-back deactivation leaves every default exactly where it was.
--
-- WHAT IS DELIBERATELY NOT DONE.
--   * ASSIGNMENTS ARE PRESERVED. Only `is_default` is cleared. The physician stays assigned to
--     every examination they were assigned to, so reactivating them restores a working
--     configuration rather than an empty one, and the Administrator's assignment work survives.
--     This is why the statement sets a flag and does not delete a row.
--   * REACTIVATION RESTORES NOTHING. The trigger fires on the active -> inactive transition
--     ONLY. There is no inverse trigger and no memory of which defaults were cleared, because
--     restoring them silently would re-establish, without anybody deciding it, a pre-selection
--     that may since have been given to another physician. After a reactivation the examination
--     simply has no default until an Administrator chooses one - a state the schema already
--     permits and three seeded examinations already occupy.
--   * NO NEW DEFAULT IS CHOSEN. Clearing this physician's flag leaves the examination with zero
--     defaults, never with a substitute picked by the database.
--
-- FORWARD-ONLY AND NON-DESTRUCTIVE. No applied migration is edited. APPLYING this file executes
-- no DROP, no TRUNCATE, no DELETE, no CREATE TABLE, no CREATE INDEX and no seed, and its one
-- ALTER is none at all - it adds one function and one trigger. It changes no existing row: the
-- UPDATE below lives in the function body and runs only when a physician is actually
-- deactivated. `physicians` and `physician_examination_assignments` keep their RLS enablement,
-- their grants, the UNIQUE (physician_id, template_code) constraint and the partial unique index
-- that admits at most one default per examination. Clearing a flag only REMOVES entries from that
-- partial index, so this trigger can never collide with it.
--
-- SECURITY POSTURE, matching save_physician_configuration() and allocate_accession_number():
-- SECURITY INVOKER, never SECURITY DEFINER, so the trigger body writes with the privileges of
-- whoever performed the UPDATE and grants nobody anything they did not already have; a fixed
-- `search_path` of `public, pg_temp` so no schema injected onto a caller's path can shadow the
-- table it writes; and EXECUTE revoked from PUBLIC and both browser roles. A trigger fires
-- regardless of EXECUTE privilege, so that revoke buys one specific thing: it stops the function
-- being CALLED directly by a role that should not have it, which is the same posture every other
-- function in this feature carries.

CREATE OR REPLACE FUNCTION clear_physician_defaults_on_deactivation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $function$
BEGIN
  -- `AND is_default` is not redundant. Without it this statement would touch every assignment row
  -- the physician holds and bump each one's updated_at through the shared trigger, rewriting the
  -- history of rows nothing actually changed. With it, only the rows that really lose a flag are
  -- written.
  UPDATE physician_examination_assignments
  SET is_default = FALSE
  WHERE physician_id = NEW.id
    AND is_default;

  -- AFTER FOR EACH ROW: the return value is ignored, and NULL is the conventional value to
  -- return. It cannot suppress the UPDATE that fired this trigger.
  RETURN NULL;
END;
$function$;

REVOKE EXECUTE ON FUNCTION clear_physician_defaults_on_deactivation() FROM PUBLIC, anon, authenticated;

-- The catalogue is consulted rather than DROP TRIGGER IF EXISTS, exactly as in
-- 20260909120000_physician_directory.sql and 20260910120000_physician_examination_assignments.sql:
-- PostgreSQL has no CREATE TRIGGER IF NOT EXISTS, and a DROP would put a destructive statement
-- into a migration that must contain none.
--
-- AFTER, not BEFORE: the physician row has already taken its new status by the time the child
-- rows are touched, so this cannot interact with the BEFORE UPDATE updated_at trigger the
-- physicians table already carries.
--
-- THE WHEN CLAUSE IS THE WHOLE DIRECTIONALITY OF THE RULE. `OLD.is_active AND NOT NEW.is_active`
-- fires on deactivation and on nothing else - not on reactivation, not on a rename, not on an
-- UPDATE that leaves the status alone. It is evaluated by the database before the body runs, so a
-- reactivation does not even enter the function.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'trg_physicians_clear_defaults_on_deactivation'
          AND tgrelid = 'physicians'::regclass
    ) THEN
        CREATE TRIGGER trg_physicians_clear_defaults_on_deactivation
        AFTER UPDATE OF is_active ON physicians
        FOR EACH ROW
        WHEN (OLD.is_active AND NOT NEW.is_active)
        EXECUTE FUNCTION clear_physician_defaults_on_deactivation();
    END IF;
END
$$;
