CREATE OR REPLACE FUNCTION complete_patient_report_session(payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $function$
DECLARE
  target_session_id uuid := (payload -> 'session' ->> 'id')::uuid;
  target_report_id uuid;
  report_payload jsonb;
  result_payload jsonb;
  signatory_payload jsonb;
  written_session_count bigint;
  written_report_count bigint;
  written_result_count bigint;
  written_signatory_count bigint;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(payload -> 'reports', '[]'::jsonb))
      AS report_rows(report_element)
    GROUP BY (report_element ->> 'id')::uuid
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Payload contains a duplicate report id';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(payload -> 'reports', '[]'::jsonb))
      AS report_rows(report_element)
    CROSS JOIN LATERAL jsonb_array_elements(
      COALESCE(report_element -> 'results', '[]'::jsonb)
    ) AS result_rows(result_element)
    GROUP BY (result_element ->> 'id')::uuid
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Payload contains a duplicate result id';
  END IF;

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
    payload -> 'session' ->> 'accession_number',
    'Completed',
    payload -> 'session' -> 'demographics',
    (payload -> 'session' ->> 'created_by_user_id')::uuid,
    (payload -> 'session' ->> 'created_at')::timestamptz,
    (payload -> 'session' ->> 'completed_at')::timestamptz,
    (payload -> 'session' ->> 'expires_at')::timestamptz,
    NULLIF(payload -> 'session' -> 'completed_snapshot', 'null'::jsonb)
  )
  ON CONFLICT (id) DO UPDATE SET
    accession_number = EXCLUDED.accession_number,
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

  FOR report_payload IN
    SELECT report_element
    FROM jsonb_array_elements(COALESCE(payload -> 'reports', '[]'::jsonb))
      AS report_rows(report_element)
  LOOP
    -- Every child parent key is derived from the payload nesting.
    target_report_id := (report_payload ->> 'id')::uuid;

    INSERT INTO laboratory_reports (
      id,
      session_id,
      template_code,
      template_title,
      renderer_family,
      reagent_kit_info,
      remarks,
      encoding_data
    )
    VALUES (
      target_report_id,
      target_session_id,
      report_payload ->> 'template_code',
      report_payload ->> 'template_title',
      report_payload ->> 'renderer_family',
      NULLIF(report_payload -> 'reagent_kit_info', 'null'::jsonb),
      NULLIF(report_payload ->> 'remarks', ''),
      NULLIF(report_payload -> 'encoding_data', 'null'::jsonb)
    )
    ON CONFLICT (id) DO UPDATE SET
      session_id = EXCLUDED.session_id,
      template_code = EXCLUDED.template_code,
      template_title = EXCLUDED.template_title,
      renderer_family = EXCLUDED.renderer_family,
      reagent_kit_info = EXCLUDED.reagent_kit_info,
      remarks = EXCLUDED.remarks,
      encoding_data = EXCLUDED.encoding_data
    WHERE laboratory_reports.session_id = target_session_id;

    GET DIAGNOSTICS written_report_count = ROW_COUNT;
    IF written_report_count < 1 THEN
      RAISE EXCEPTION 'Report % belongs to a different session', target_report_id;
    END IF;

    FOR result_payload IN
      SELECT result_element
      FROM jsonb_array_elements(COALESCE(report_payload -> 'results', '[]'::jsonb))
        AS result_rows(result_element)
    LOOP
      IF result_payload -> 'result_value' IS NOT NULL
        AND result_payload -> 'result_value' <> 'null'::jsonb
        AND result_payload -> 'result_value' <> '""'::jsonb
        AND result_payload -> 'result_value' <> '0'::jsonb
        AND result_payload -> 'result_value' <> 'false'::jsonb THEN
        INSERT INTO laboratory_results (
          id,
          report_id,
          parameter_code,
          parameter_name,
          result_value,
          raw_result_value,
          formatted_result_value,
          unit,
          evaluation_outcome,
          reference_rule_snapshot,
          computation_metadata,
          display_order
        )
        VALUES (
          (result_payload ->> 'id')::uuid,
          target_report_id,
          result_payload ->> 'parameter_code',
          result_payload ->> 'parameter_name',
          result_payload ->> 'result_value',
          result_payload ->> 'raw_result_value',
          result_payload ->> 'formatted_result_value',
          NULLIF(result_payload ->> 'unit', ''),
          result_payload ->> 'evaluation_outcome',
          NULLIF(result_payload -> 'reference_rule_snapshot', 'null'::jsonb),
          NULLIF(result_payload -> 'computation_metadata', 'null'::jsonb),
          (result_payload ->> 'display_order')::integer
        )
        ON CONFLICT (id) DO UPDATE SET
          report_id = EXCLUDED.report_id,
          parameter_code = EXCLUDED.parameter_code,
          parameter_name = EXCLUDED.parameter_name,
          result_value = EXCLUDED.result_value,
          raw_result_value = EXCLUDED.raw_result_value,
          formatted_result_value = EXCLUDED.formatted_result_value,
          unit = EXCLUDED.unit,
          evaluation_outcome = EXCLUDED.evaluation_outcome,
          reference_rule_snapshot = EXCLUDED.reference_rule_snapshot,
          computation_metadata = EXCLUDED.computation_metadata,
          display_order = EXCLUDED.display_order
        WHERE laboratory_results.report_id = target_report_id;

        GET DIAGNOSTICS written_result_count = ROW_COUNT;
        IF written_result_count < 1 THEN
          RAISE EXCEPTION 'Result % belongs to a different report', result_payload ->> 'id';
        END IF;
      END IF;
    END LOOP;

    FOR signatory_payload IN
      SELECT signatory_element
      FROM jsonb_array_elements(COALESCE(report_payload -> 'signatories', '[]'::jsonb))
        AS signatory_rows(signatory_element)
    LOOP
      INSERT INTO report_signatories (
        report_id,
        personnel_id,
        role,
        printed_full_name,
        printed_credentials,
        printed_prc_license_number,
        signature_image_url,
        display_order
      )
      VALUES (
        target_report_id,
        (signatory_payload ->> 'personnel_id')::uuid,
        signatory_payload ->> 'role',
        signatory_payload ->> 'printed_full_name',
        signatory_payload ->> 'printed_credentials',
        signatory_payload ->> 'printed_prc_license_number',
        NULLIF(signatory_payload ->> 'signature_image_url', ''),
        (signatory_payload ->> 'display_order')::integer
      );

      GET DIAGNOSTICS written_signatory_count = ROW_COUNT;
      IF written_signatory_count < 1 THEN
        RAISE EXCEPTION 'Signatory for report % was not written', target_report_id;
      END IF;
    END LOOP;
  END LOOP;
END;
$function$;

REVOKE EXECUTE ON FUNCTION complete_patient_report_session(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION complete_patient_report_session(jsonb) TO service_role;
