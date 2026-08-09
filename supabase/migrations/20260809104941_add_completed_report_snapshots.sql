-- Checkpoint B5: persist report-scoped draft encoding data and immutable
-- completed-session snapshots without rewriting legacy rows.
ALTER TABLE patient_report_sessions
  ADD COLUMN IF NOT EXISTS completed_snapshot JSONB;

ALTER TABLE laboratory_reports
  ADD COLUMN IF NOT EXISTS encoding_data JSONB;

ALTER TABLE laboratory_results
  ADD COLUMN IF NOT EXISTS raw_result_value TEXT,
  ADD COLUMN IF NOT EXISTS formatted_result_value TEXT,
  ADD COLUMN IF NOT EXISTS computation_metadata JSONB;

ALTER TABLE laboratory_results
  DROP CONSTRAINT IF EXISTS laboratory_results_evaluation_outcome_check;

ALTER TABLE laboratory_results
  ADD CONSTRAINT laboratory_results_evaluation_outcome_check
  CHECK (evaluation_outcome IN ('Normal', 'Abnormal', 'Informational', 'NoEvaluation', 'Invalid'));
