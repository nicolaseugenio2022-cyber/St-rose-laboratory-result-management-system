ALTER TABLE audit_logs
  ADD COLUMN actor_role TEXT NULL,
  ADD COLUMN target_role TEXT NULL,
  ADD CONSTRAINT chk_audit_logs_actor_role CHECK (
    actor_role IS NULL OR actor_role IN ('Admin', 'User', 'Developer')
  ),
  ADD CONSTRAINT chk_audit_logs_target_role CHECK (
    target_role IS NULL OR target_role IN ('Admin', 'User', 'Developer')
  );

ALTER TABLE audit_logs
  ADD COLUMN developer_involved BOOLEAN GENERATED ALWAYS AS (
    COALESCE(actor_role = 'Developer', false)
    OR COALESCE(target_role = 'Developer', false)
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_audit_logs_occurred_at_id
  ON audit_logs (occurred_at DESC, id DESC);
