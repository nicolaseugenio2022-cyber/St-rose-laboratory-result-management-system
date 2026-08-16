CREATE OR REPLACE FUNCTION replace_completed_session(payload jsonb)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $function$
DECLARE
  target_session_id uuid := (payload -> 'session' ->> 'id')::uuid;
  v_accession patient_report_sessions.accession_number%TYPE;
  v_completed_at patient_report_sessions.completed_at%TYPE;
  v_expires_at patient_report_sessions.expires_at%TYPE;
  v_status patient_report_sessions.status%TYPE;
  written_session_count bigint;
BEGIN
  PERFORM assert_session_within_retention(target_session_id);

  SELECT accession_number, completed_at, expires_at, status
  INTO v_accession, v_completed_at, v_expires_at, v_status
  FROM patient_report_sessions
  WHERE id = target_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Completed session % does not exist', target_session_id;
  END IF;

  IF v_status <> 'Completed' THEN
    RAISE EXCEPTION 'Session % is not completed and cannot be replaced', target_session_id;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(payload -> 'reports', '[]'::jsonb))
      AS report_rows(report_element)
    WHERE report_element ->> 'id' IS NULL
  ) THEN
    RAISE EXCEPTION 'Payload contains a report with a null id';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(payload -> 'reports', '[]'::jsonb))
      AS report_rows(report_element)
    CROSS JOIN LATERAL jsonb_array_elements(
      COALESCE(report_element -> 'results', '[]'::jsonb)
    ) AS result_rows(result_element)
    WHERE result_element ->> 'id' IS NULL
  ) THEN
    RAISE EXCEPTION 'Payload contains a result with a null id';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(payload -> 'reports', '[]'::jsonb))
      AS report_rows(report_element)
    CROSS JOIN LATERAL jsonb_array_elements(
      COALESCE(report_element -> 'signatories', '[]'::jsonb)
    ) AS signatory_rows(signatory_element)
    WHERE signatory_element ->> 'personnel_id' IS NULL
  ) THEN
    RAISE EXCEPTION 'Payload contains a signatory with a null personnel_id';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(payload -> 'reports', '[]'::jsonb))
      AS report_rows(report_element)
    WHERE EXISTS (
      SELECT 1
      FROM jsonb_array_elements(
        COALESCE(report_element -> 'signatories', '[]'::jsonb)
      ) AS signatory_rows(signatory_element)
      GROUP BY (signatory_element ->> 'personnel_id')::uuid
      HAVING count(*) > 1
    )
  ) THEN
    RAISE EXCEPTION 'Payload contains a duplicate signatory personnel id within a report';
  END IF;

  UPDATE patient_report_sessions
  SET demographics = payload -> 'session' -> 'demographics',
      completed_snapshot = NULLIF(payload -> 'session' -> 'completed_snapshot', 'null'::jsonb),
      last_replaced_at = now()
  WHERE id = target_session_id;

  GET DIAGNOSTICS written_session_count = ROW_COUNT;
  IF written_session_count < 1 THEN
    RAISE EXCEPTION 'Session % was not replaced', target_session_id;
  END IF;

  DELETE FROM laboratory_reports AS stored_report
  WHERE stored_report.session_id = target_session_id
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(payload -> 'reports', '[]'::jsonb))
        AS report_rows(report_element)
      WHERE (report_element ->> 'id')::uuid = stored_report.id
    );

  DELETE FROM laboratory_results AS stored_result
  USING laboratory_reports AS stored_report
  WHERE stored_result.report_id = stored_report.id
    AND stored_report.session_id = target_session_id
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(payload -> 'reports', '[]'::jsonb))
        AS report_rows(report_element)
      CROSS JOIN LATERAL jsonb_array_elements(
        COALESCE(report_element -> 'results', '[]'::jsonb)
      ) AS result_rows(result_element)
      WHERE (report_element ->> 'id')::uuid = stored_report.id
        AND (result_element ->> 'id')::uuid = stored_result.id
    );

  DELETE FROM report_signatories AS stored_signatory
  USING laboratory_reports AS stored_report
  WHERE stored_signatory.report_id = stored_report.id
    AND stored_report.session_id = target_session_id;

  PERFORM persist_session_report_tree(
    target_session_id,
    COALESCE(payload -> 'reports', '[]'::jsonb),
    true,
    true
  );

  RETURN v_accession;
END;
$function$;

REVOKE EXECUTE ON FUNCTION replace_completed_session(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION replace_completed_session(jsonb) TO service_role;
