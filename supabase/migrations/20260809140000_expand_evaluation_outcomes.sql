-- Encoding evaluation correction: retain legacy outcomes and permit the
-- definition-driven Low, High, and Entered draft states.
ALTER TABLE laboratory_results
  DROP CONSTRAINT IF EXISTS laboratory_results_evaluation_outcome_check;

ALTER TABLE laboratory_results
  ADD CONSTRAINT laboratory_results_evaluation_outcome_check
  CHECK (
    evaluation_outcome IN (
      'Low',
      'Normal',
      'High',
      'Entered',
      'Abnormal',
      'Informational',
      'NoEvaluation',
      'Invalid'
    )
  );
