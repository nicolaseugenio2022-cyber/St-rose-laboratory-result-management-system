-- Migration Unit 05: Row-Level Security (RLS) Policies and Security Helpers
-- St. Rose Laboratory Result Management System

-- 1. Security Helper Functions
CREATE OR REPLACE FUNCTION is_active_user()
RETURNS BOOLEAN AS $$
DECLARE
    active_cnt INT;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN FALSE;
    END IF;

    SELECT COUNT(*) INTO active_cnt
    FROM user_profiles
    WHERE id = auth.uid() AND status = 'Active';

    RETURN active_cnt > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_admin_user()
RETURNS BOOLEAN AS $$
DECLARE
    admin_cnt INT;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN FALSE;
    END IF;

    SELECT COUNT(*) INTO admin_cnt
    FROM user_profiles
    WHERE id = auth.uid() AND status = 'Active' AND role = 'Admin';

    RETURN admin_cnt > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Enable Row-Level Security (RLS) on all 10 Database Tables
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

-- 3. RLS Policies: user_profiles
CREATE POLICY p_user_profiles_select ON user_profiles
    FOR SELECT TO authenticated USING (is_active_user());

CREATE POLICY p_user_profiles_admin_write ON user_profiles
    FOR ALL TO authenticated USING (is_admin_user());

-- 4. RLS Policies: personnel
CREATE POLICY p_personnel_select ON personnel
    FOR SELECT TO authenticated USING (is_active_user());

CREATE POLICY p_personnel_admin_write ON personnel
    FOR ALL TO authenticated USING (is_admin_user());

-- 5. RLS Policies: auto_suggestions
CREATE POLICY p_auto_suggestions_select ON auto_suggestions
    FOR SELECT TO authenticated USING (is_active_user());

CREATE POLICY p_auto_suggestions_write ON auto_suggestions
    FOR ALL TO authenticated USING (is_active_user());

-- 6. RLS Policies: report_templates & metadata
CREATE POLICY p_report_templates_select ON report_templates
    FOR SELECT TO authenticated USING (is_active_user());

CREATE POLICY p_report_templates_admin_write ON report_templates
    FOR ALL TO authenticated USING (is_admin_user());

CREATE POLICY p_template_parameters_select ON template_parameters
    FOR SELECT TO authenticated USING (is_active_user());

CREATE POLICY p_template_parameters_admin_write ON template_parameters
    FOR ALL TO authenticated USING (is_admin_user());

CREATE POLICY p_template_signatory_reqs_select ON template_signatory_requirements
    FOR SELECT TO authenticated USING (is_active_user());

CREATE POLICY p_template_signatory_reqs_admin_write ON template_signatory_requirements
    FOR ALL TO authenticated USING (is_admin_user());

-- 7. RLS Policies: patient_report_sessions
CREATE POLICY p_patient_report_sessions_select ON patient_report_sessions
    FOR SELECT TO authenticated USING (is_active_user());

CREATE POLICY p_patient_report_sessions_write ON patient_report_sessions
    FOR ALL TO authenticated USING (is_active_user());

-- 8. RLS Policies: laboratory_reports
CREATE POLICY p_laboratory_reports_select ON laboratory_reports
    FOR SELECT TO authenticated USING (is_active_user());

CREATE POLICY p_laboratory_reports_write ON laboratory_reports
    FOR ALL TO authenticated USING (is_active_user());

-- 9. RLS Policies: laboratory_results
CREATE POLICY p_laboratory_results_select ON laboratory_results
    FOR SELECT TO authenticated USING (is_active_user());

CREATE POLICY p_laboratory_results_write ON laboratory_results
    FOR ALL TO authenticated USING (is_active_user());

-- 10. RLS Policies: report_signatories
CREATE POLICY p_report_signatories_select ON report_signatories
    FOR SELECT TO authenticated USING (is_active_user());

CREATE POLICY p_report_signatories_write ON report_signatories
    FOR ALL TO authenticated USING (is_active_user());
