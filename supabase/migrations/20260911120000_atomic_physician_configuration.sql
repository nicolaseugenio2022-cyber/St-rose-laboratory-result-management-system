-- Atomic physician configuration: one transaction for the complete physician form save.
--
-- WHY THIS EXISTS. The physician editor saves a record AND that record's complete
-- examination-assignment set in a single operator action. Until this migration those were four
-- independent PostgREST statements - insert/update the physician, delete its assignment rows,
-- clear the incumbent default on every template it was about to take over, insert the
-- replacement rows - and each committed on its own. A failure part-way therefore left a
-- physician created but unassigned, or an assignment set half replaced, or - the worst case -
-- ANOTHER physician's default cleared on a template while the operator was told the save had
-- failed. No constraint could catch that: every intermediate state is individually legal.
--
-- 20260910120000_physician_examination_assignments.sql argued that a function was unnecessary
-- because the dangerous state (two defaults for one examination) is unrepresentable regardless of
-- ordering. That argument still holds and is not being reversed: the partial unique index is
-- still what forbids two defaults. What it did not cover is PARTIAL CONFIGURATION - a set of
-- individually legal rows that together are not what the operator asked for, and that no index
-- can reject. That is the gap this function closes, and it closes it the only way a multi-row
-- invariant can be closed: one transaction that commits or rolls back as a unit.
--
-- FORWARD-ONLY AND NON-DESTRUCTIVE. Neither applied migration is edited. This file adds one
-- function and its two privilege statements. APPLYING it executes no DROP, no TRUNCATE, no
-- DELETE, no ALTER, no CREATE TABLE, no CREATE INDEX and no seed, so it changes no row and no
-- pre-existing object. The one DELETE in this file is INSIDE the function body, runs only when an
-- Administrator saves a physician, and is bounded to that physician's own assignment rows by
-- `WHERE physician_id = v_physician_id` - it removes no `physicians` row and can reach no other
-- physician's rows.
--
-- `physicians` and `physician_examination_assignments` keep their RLS enablement, their
-- grants, the UNIQUE (physician_id, template_code) constraint and the partial unique index that
-- admits at most one default per examination - this function relies on all four and replaces
-- none of them.
--
-- SECURITY POSTURE, matching allocate_accession_number(), save_draft_session(),
-- complete_patient_report_session() and replace_completed_session() exactly:
-- SECURITY INVOKER, never SECURITY DEFINER, so the function carries no privilege of its own and
-- can read and write only what its caller already could; a fixed `search_path` of
-- `public, pg_temp` so no schema injected onto a caller's path can shadow a referenced object;
-- EXECUTE revoked from PUBLIC and from both browser roles and granted only to service_role, the
-- role the server-only Supabase credential authenticates as. The application server remains the
-- authoritative authorization boundary (SECURITY_MODEL.md 8.0): the Administrator check happens
-- in `savePhysicianConfigurationAction` BEFORE the payload is parsed, and this function is a
-- transaction boundary, not an authorization boundary. It nevertheless re-decides every payload
-- rule below, because a transaction boundary reachable by service_role must not depend on the
-- caller having validated anything.

CREATE OR REPLACE FUNCTION save_physician_configuration(payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_physician_id uuid;
  v_full_name text;
  v_is_active boolean;
  v_template_codes text[];
  v_default_codes text[];
  v_unknown_template text;
  v_written_rows bigint;
BEGIN
  -- ── Concurrency ──────────────────────────────────────────────────────────────────────────
  -- Every physician configuration save serializes behind one transaction-scoped advisory lock,
  -- released automatically on commit or rollback.
  --
  -- The lock is not what makes the write atomic - the transaction is. It removes the one
  -- remaining interleaving that is correct but useless to an operator: two concurrent saves each
  -- taking the default for the same examination. Without it, the second save's clear-the-
  -- incumbent UPDATE cannot see the first's uncommitted default row, so its INSERT blocks on the
  -- partial unique index and then fails with 23505 once the first commits - a whole transaction
  -- rolled back and reported as a duplicate-assignment refusal that the operator did nothing to
  -- deserve. With the lock, the second save simply waits and then reads the committed state.
  --
  -- Serializing costs nothing here: this is an Administrator maintenance write on a directory of
  -- three physicians, not a request-path operation. The key is a fixed literal rather than
  -- hashtext() of a name, so it cannot drift with a rename and depends on no internal function.
  PERFORM pg_advisory_xact_lock(4207250911120000);

  -- ── Strict payload shape ─────────────────────────────────────────────────────────────────
  -- Shape is re-decided here in full. The server action parses the same payload with a strict
  -- Zod schema first; this is the copy that holds when something reaches the function without
  -- having gone through that action.
  IF jsonb_typeof(payload) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'INVALID_PAYLOAD: payload must be a JSON object' USING ERRCODE = 'ST007';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_object_keys(payload) AS keys(key)
    WHERE keys.key NOT IN (
      'id', 'full_name', 'is_active', 'template_codes', 'default_template_codes'
    )
  ) THEN
    RAISE EXCEPTION 'INVALID_PAYLOAD: unexpected key' USING ERRCODE = 'ST007';
  END IF;

  IF NOT (
    payload ? 'full_name'
    AND payload ? 'is_active'
    AND payload ? 'template_codes'
    AND payload ? 'default_template_codes'
  ) THEN
    RAISE EXCEPTION 'INVALID_PAYLOAD: missing required key' USING ERRCODE = 'ST007';
  END IF;

  IF jsonb_typeof(payload -> 'full_name') IS DISTINCT FROM 'string'
     OR jsonb_typeof(payload -> 'is_active') IS DISTINCT FROM 'boolean'
     OR jsonb_typeof(payload -> 'template_codes') IS DISTINCT FROM 'array'
     OR jsonb_typeof(payload -> 'default_template_codes') IS DISTINCT FROM 'array'
     OR (payload ? 'id' AND jsonb_typeof(payload -> 'id') NOT IN ('string', 'null'))
  THEN
    RAISE EXCEPTION 'INVALID_PAYLOAD: wrong value type' USING ERRCODE = 'ST007';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(payload -> 'template_codes') AS assigned(element)
    WHERE jsonb_typeof(assigned.element) IS DISTINCT FROM 'string'
  ) OR EXISTS (
    SELECT 1
    FROM jsonb_array_elements(payload -> 'default_template_codes') AS defaulted(element)
    WHERE jsonb_typeof(defaulted.element) IS DISTINCT FROM 'string'
  ) THEN
    RAISE EXCEPTION 'INVALID_PAYLOAD: examination code must be a string' USING ERRCODE = 'ST007';
  END IF;

  v_physician_id := NULLIF(payload ->> 'id', '')::uuid;
  v_full_name := btrim(payload ->> 'full_name');
  v_is_active := (payload ->> 'is_active')::boolean;

  -- The same bound the directory's own schema carries. The name prints verbatim on a report.
  IF char_length(v_full_name) = 0 OR char_length(v_full_name) > 150 THEN
    RAISE EXCEPTION 'INVALID_PAYLOAD: physician name is empty or too long' USING ERRCODE = 'ST007';
  END IF;

  SELECT COALESCE(array_agg(assigned.value), ARRAY[]::text[])
  INTO v_template_codes
  FROM jsonb_array_elements_text(payload -> 'template_codes') AS assigned(value);

  SELECT COALESCE(array_agg(defaulted.value), ARRAY[]::text[])
  INTO v_default_codes
  FROM jsonb_array_elements_text(payload -> 'default_template_codes') AS defaulted(value);

  IF COALESCE(array_length(v_template_codes, 1), 0) > 64
     OR COALESCE(array_length(v_default_codes, 1), 0) > 64 THEN
    RAISE EXCEPTION 'INVALID_PAYLOAD: too many examinations' USING ERRCODE = 'ST007';
  END IF;

  -- Duplicates are refused here rather than left to the unique constraint, so a malformed payload
  -- is named as malformed instead of surfacing as a collision the operator cannot act on.
  IF (SELECT count(DISTINCT code) FROM unnest(v_template_codes) AS code) IS DISTINCT FROM
     COALESCE(array_length(v_template_codes, 1), 0)::bigint
     OR (SELECT count(DISTINCT code) FROM unnest(v_default_codes) AS code) IS DISTINCT FROM
     COALESCE(array_length(v_default_codes, 1), 0)::bigint THEN
    RAISE EXCEPTION 'INVALID_PAYLOAD: an examination is listed twice' USING ERRCODE = 'ST007';
  END IF;

  -- ── The three domain rules, re-decided ───────────────────────────────────────────────────
  -- A default must also be assigned. Structural in the table - the flag lives on the assignment
  -- row - but the payload could still ask for a default whose assignment it never listed.
  IF EXISTS (
    SELECT 1
    FROM unnest(v_default_codes) AS defaulted(code)
    WHERE defaulted.code <> ALL (v_template_codes)
  ) THEN
    RAISE EXCEPTION 'DEFAULT_NOT_ASSIGNED' USING ERRCODE = 'ST005';
  END IF;

  -- A deactivated physician is not offered for new work, so they never hold a default.
  IF NOT v_is_active AND COALESCE(array_length(v_default_codes, 1), 0) > 0 THEN
    RAISE EXCEPTION 'PHYSICIAN_INACTIVE' USING ERRCODE = 'ST004';
  END IF;

  -- Every code must name a maintained examination. The column's foreign key would refuse an
  -- unknown code anyway, as 23503; naming it here keeps the refusal typed and keeps the
  -- transaction from reaching the insert to discover it.
  SELECT code
  INTO v_unknown_template
  FROM unnest(v_template_codes) AS code
  WHERE NOT EXISTS (
    SELECT 1 FROM report_templates WHERE report_templates.template_code = code
  )
  LIMIT 1;

  IF v_unknown_template IS NOT NULL THEN
    RAISE EXCEPTION 'UNKNOWN_TEMPLATE' USING ERRCODE = 'ST006';
  END IF;

  -- ── The physician record ─────────────────────────────────────────────────────────────────
  -- The identifier is produced and returned SERVER-SIDE. Before this function, a newly created
  -- physician had to be found again by name through a second round trip, because the create path
  -- returned nothing; that lookup is gone.
  IF v_physician_id IS NULL THEN
    BEGIN
      INSERT INTO physicians (full_name, is_active)
      VALUES (v_full_name, v_is_active)
      RETURNING id INTO v_physician_id;
    EXCEPTION WHEN unique_violation THEN
      RAISE EXCEPTION 'PHYSICIAN_DUPLICATE_NAME' USING ERRCODE = 'ST001';
    END;
  ELSE
    BEGIN
      UPDATE physicians
      SET full_name = v_full_name,
          is_active = v_is_active
      WHERE id = v_physician_id;
      GET DIAGNOSTICS v_written_rows = ROW_COUNT;
    EXCEPTION WHEN unique_violation THEN
      RAISE EXCEPTION 'PHYSICIAN_DUPLICATE_NAME' USING ERRCODE = 'ST001';
    END;

    IF v_written_rows < 1 THEN
      RAISE EXCEPTION 'PHYSICIAN_NOT_FOUND' USING ERRCODE = 'ST003';
    END IF;
  END IF;

  -- ── The complete assignment set ──────────────────────────────────────────────────────────
  -- THE STATEMENT ORDER IS STILL A CORRECTNESS REQUIREMENT. Being inside one transaction does
  -- not relax it: the partial unique index is checked PER STATEMENT, so a statement that
  -- transiently produces two default rows for one examination fails even when the end state
  -- would have been legal.
  --
  --   1. clear this physician's own rows, so the (physician_id, template_code) uniqueness
  --      constraint has room for the replacement set;
  --   2. clear the incumbent default on every template this physician is about to take over,
  --      BEFORE any default row of theirs exists;
  --   3. insert the replacement set, now that both constraints have room.
  --
  -- What is new is that all three, and the physician write above them, either all commit or all
  -- disappear. Step 2 is the statement that used to be able to strand another physician's
  -- examination with no default when a later step failed.
  DELETE FROM physician_examination_assignments
  WHERE physician_id = v_physician_id;

  IF COALESCE(array_length(v_default_codes, 1), 0) > 0 THEN
    UPDATE physician_examination_assignments
    SET is_default = FALSE
    WHERE template_code = ANY (v_default_codes)
      AND is_default;
  END IF;

  IF COALESCE(array_length(v_template_codes, 1), 0) > 0 THEN
    BEGIN
      INSERT INTO physician_examination_assignments (physician_id, template_code, is_default)
      SELECT v_physician_id, code, code = ANY (v_default_codes)
      FROM unnest(v_template_codes) AS code;
    EXCEPTION WHEN unique_violation THEN
      RAISE EXCEPTION 'PHYSICIAN_DUPLICATE_ASSIGNMENT' USING ERRCODE = 'ST002';
    END;
  END IF;

  RETURN v_physician_id;
END;
$function$;

-- The browser roles get nothing, exactly as for every other function in this schema. service_role
-- is the only grantee: it is the role the server-only secret credential authenticates as, and the
-- server action that calls this function has already established that the caller is an
-- Administrator.
REVOKE EXECUTE ON FUNCTION save_physician_configuration(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION save_physician_configuration(jsonb) TO service_role;
