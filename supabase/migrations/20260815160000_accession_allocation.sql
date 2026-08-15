CREATE TABLE IF NOT EXISTS accession_sequences (
  year_key INTEGER PRIMARY KEY,
  next_seq INTEGER NOT NULL
);

INSERT INTO accession_sequences (year_key, next_seq)
SELECT y, m FROM (
  SELECT substring(accession_number from 4 for 4)::int AS y,
         MAX(substring(accession_number from 13)::int) AS m
  FROM patient_report_sessions
  WHERE accession_number ~ '^SR-\d{8}-\d+$'
  GROUP BY 1
) s
ON CONFLICT (year_key) DO UPDATE
SET next_seq = GREATEST(accession_sequences.next_seq, EXCLUDED.next_seq);

ALTER TABLE accession_sequences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON accession_sequences FROM PUBLIC;
REVOKE ALL ON accession_sequences FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON accession_sequences TO service_role;

CREATE OR REPLACE FUNCTION allocate_accession_number()
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_day date;
  v_year integer;
  v_seq integer;
BEGIN
  v_day := (timezone('Asia/Manila', now()))::date;
  v_year := extract(year from v_day)::int;

  INSERT INTO accession_sequences (year_key, next_seq)
  VALUES (v_year, 1)
  ON CONFLICT (year_key) DO UPDATE
  SET next_seq = accession_sequences.next_seq + 1
  RETURNING next_seq INTO v_seq;

  RETURN 'SR-' || to_char(v_day, 'YYYYMMDD') || '-' ||
    CASE
      WHEN length(v_seq::text) >= 4 THEN v_seq::text
      ELSE lpad(v_seq::text, 4, '0')
    END;
END;
$$;

REVOKE EXECUTE ON FUNCTION allocate_accession_number() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION allocate_accession_number() TO service_role;
