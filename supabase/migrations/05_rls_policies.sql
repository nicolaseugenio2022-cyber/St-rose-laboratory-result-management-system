-- The application server is the authoritative authorization boundary (SECURITY_MODEL.md 8.0).
-- RLS is defense-in-depth only; privileged server access uses the server-only secret credential, which bypasses RLS.

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE personnel ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_signatory_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_report_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE laboratory_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE laboratory_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_signatories ENABLE ROW LEVEL SECURITY;
