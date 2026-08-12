DO $$
DECLARE unowned BIGINT;
BEGIN
  SELECT count(*) INTO unowned FROM patient_report_sessions WHERE created_by_user_id IS NULL;
  IF unowned > 0 THEN
    RAISE EXCEPTION 'Cannot enforce session ownership: % row(s) have NULL created_by_user_id', unowned;
  END IF;
END $$;

ALTER TABLE patient_report_sessions ALTER COLUMN created_by_user_id SET NOT NULL;
