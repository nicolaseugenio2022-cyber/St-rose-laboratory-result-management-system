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
    RAISE EXCEPTION 'Session % has passed its 30-day retention window and is permanently immutable', target_session_id;
  END IF;
END;
$function$;

REVOKE EXECUTE ON FUNCTION assert_session_within_retention(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION assert_session_within_retention(uuid) TO service_role;

CREATE OR REPLACE FUNCTION save_draft_session(payload jsonb)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $function$
DECLARE
  target_session_id uuid := (payload -> 'session' ->> 'id')::uuid;
  v_accession text;
  written_session_count bigint;
BEGIN
  PERFORM assert_session_within_retention(target_session_id);

  v_accession := resolve_session_accession_number(target_session_id);

  INSERT INTO patient_report_sessions (
    id,
    accession_number,
    status,
    demographics,
    created_by_user_id,
    created_at,
    expires_at
  )
  VALUES (
    target_session_id,
    v_accession,
    'Draft',
    payload -> 'session' -> 'demographics',
    (payload -> 'session' ->> 'created_by_user_id')::uuid,
    (payload -> 'session' ->> 'created_at')::timestamptz,
    NULL
  )
  ON CONFLICT (id) DO UPDATE SET
    -- The accession number is assigned once and immutable thereafter.
    status = EXCLUDED.status,
    demographics = EXCLUDED.demographics,
    created_by_user_id = EXCLUDED.created_by_user_id,
    created_at = EXCLUDED.created_at,
    expires_at = EXCLUDED.expires_at;

  GET DIAGNOSTICS written_session_count = ROW_COUNT;
  IF written_session_count < 1 THEN
    RAISE EXCEPTION 'Session % was not written', target_session_id;
  END IF;

  PERFORM persist_session_report_tree(
    target_session_id,
    COALESCE(payload -> 'reports', '[]'::jsonb),
    false,
    false
  );

  RETURN v_accession;
END;
$function$;

REVOKE EXECUTE ON FUNCTION save_draft_session(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION save_draft_session(jsonb) TO service_role;

CREATE OR REPLACE FUNCTION complete_patient_report_session(payload jsonb)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $function$
DECLARE
  target_session_id uuid := (payload -> 'session' ->> 'id')::uuid;
  v_accession text;
  written_session_count bigint;
BEGIN
  PERFORM assert_session_within_retention(target_session_id);

  v_accession := resolve_session_accession_number(target_session_id);

  INSERT INTO patient_report_sessions (
    id,
    accession_number,
    status,
    demographics,
    created_by_user_id,
    created_at,
    completed_at,
    expires_at,
    completed_snapshot
  )
  VALUES (
    target_session_id,
    v_accession,
    'Completed',
    payload -> 'session' -> 'demographics',
    (payload -> 'session' ->> 'created_by_user_id')::uuid,
    (payload -> 'session' ->> 'created_at')::timestamptz,
    (payload -> 'session' ->> 'completed_at')::timestamptz,
    (payload -> 'session' ->> 'expires_at')::timestamptz,
    NULLIF(payload -> 'session' -> 'completed_snapshot', 'null'::jsonb)
  )
  ON CONFLICT (id) DO UPDATE SET
    status = EXCLUDED.status,
    demographics = EXCLUDED.demographics,
    created_by_user_id = EXCLUDED.created_by_user_id,
    created_at = EXCLUDED.created_at,
    completed_at = EXCLUDED.completed_at,
    expires_at = EXCLUDED.expires_at,
    completed_snapshot = EXCLUDED.completed_snapshot;

  GET DIAGNOSTICS written_session_count = ROW_COUNT;
  IF written_session_count < 1 THEN
    RAISE EXCEPTION 'Session % was not written', target_session_id;
  END IF;

  PERFORM persist_session_report_tree(
    target_session_id,
    COALESCE(payload -> 'reports', '[]'::jsonb),
    true,
    true
  );

  RETURN v_accession;
END;
$function$;

REVOKE EXECUTE ON FUNCTION complete_patient_report_session(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION complete_patient_report_session(jsonb) TO service_role;
