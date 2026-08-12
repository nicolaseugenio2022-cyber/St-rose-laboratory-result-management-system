-- Migration Unit 03: Performance Indexes and Automated Triggers
-- St. Rose Laboratory Result Management System

-- Automated updated_at triggers
CREATE TRIGGER trg_user_profiles_updated_at
BEFORE UPDATE ON user_profiles
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_personnel_updated_at
BEFORE UPDATE ON personnel
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_report_templates_updated_at
BEFORE UPDATE ON report_templates
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_patient_report_sessions_updated_at
BEFORE UPDATE ON patient_report_sessions
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- B-Tree Performance Indexes for high-frequency repository lookups
CREATE INDEX IF NOT EXISTS idx_patient_report_sessions_accession_number
ON patient_report_sessions(accession_number);

CREATE INDEX IF NOT EXISTS idx_patient_report_sessions_status
ON patient_report_sessions(status);

CREATE INDEX IF NOT EXISTS idx_patient_report_sessions_expires_at
ON patient_report_sessions(expires_at) WHERE expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_laboratory_reports_session_id
ON laboratory_reports(session_id);

CREATE INDEX IF NOT EXISTS idx_laboratory_reports_template_code
ON laboratory_reports(template_code);

CREATE INDEX IF NOT EXISTS idx_laboratory_results_report_id
ON laboratory_results(report_id);

CREATE INDEX IF NOT EXISTS idx_report_signatories_report_id
ON report_signatories(report_id);

CREATE INDEX IF NOT EXISTS idx_template_parameters_template_code
ON template_parameters(template_code);
