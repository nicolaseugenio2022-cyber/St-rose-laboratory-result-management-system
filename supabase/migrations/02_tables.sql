-- Migration Unit 02: 10 Application Database Tables
-- St. Rose Laboratory Result Management System

-- 1. user_profiles (Decoupled system login identity metadata)
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL CHECK (role IN ('Admin', 'User', 'Developer')),
    status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
    password_hash TEXT NOT NULL,
    security_question TEXT NOT NULL,
    security_answer_hash TEXT NULL,
    must_change_password BOOLEAN NOT NULL DEFAULT TRUE,
    must_set_recovery BOOLEAN NOT NULL DEFAULT TRUE,
    token_version INTEGER NOT NULL DEFAULT 1,
    password_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_user_profiles_canonical_username CHECK (
        char_length(username) BETWEEN 3 AND 50
        AND username ~ '^[a-z0-9][a-z0-9._-]*[a-z0-9]$'
        AND username !~ '[._-]{2}'
    )
);

-- 2. personnel (Independent PRC-licensed medical professional directory)
CREATE TABLE IF NOT EXISTS personnel (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    middle_initial TEXT,
    credentials TEXT NOT NULL,
    prc_license_number TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL CHECK (role IN ('Pathologist', 'MedicalTechnologist')),
    signature_image_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. auto_suggestions (Auto-learning dictionary for demographics inputs)
CREATE TABLE IF NOT EXISTS auto_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL CHECK (category IN ('physician', 'referrer', 'company')),
    suggestion_text TEXT NOT NULL,
    usage_count INT NOT NULL DEFAULT 1,
    last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_category_suggestion UNIQUE (category, suggestion_text)
);

-- 4. report_templates (Primary Report Registry template definitions)
CREATE TABLE IF NOT EXISTS report_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_code TEXT NOT NULL UNIQUE,
    template_title TEXT NOT NULL,
    examination_family TEXT NOT NULL CHECK (
        examination_family IN ('Hematology', 'Clinical Chemistry', 'Clinical Microscopy', 'Serology & Immunology', 'Blood Bank')
    ),
    renderer_family TEXT NOT NULL CHECK (
        renderer_family IN ('Tabular', 'SimpleResult', 'DiagnosticGrid', 'NarrativeCertificate')
    ),
    color_palette TEXT NOT NULL DEFAULT '#093982',
    supports_remarks BOOLEAN NOT NULL DEFAULT TRUE,
    default_remarks TEXT,
    requires_kit_info BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. template_parameters (Parameter definitions per template)
CREATE TABLE IF NOT EXISTS template_parameters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_code TEXT NOT NULL REFERENCES report_templates(template_code) ON DELETE CASCADE,
    parameter_code TEXT NOT NULL,
    parameter_name TEXT NOT NULL,
    input_type TEXT NOT NULL CHECK (
        input_type IN ('NumericText', 'FreeText', 'SingleSelect', 'MultiSelect', 'Combobox', 'Computed')
    ),
    unit TEXT,
    default_value TEXT,
    options JSONB,
    reference_rule JSONB,
    computed_formula JSONB,
    is_required BOOLEAN NOT NULL DEFAULT TRUE,
    is_selectable BOOLEAN NOT NULL DEFAULT TRUE,
    display_order INT NOT NULL DEFAULT 0,
    CONSTRAINT uq_template_param UNIQUE (template_code, parameter_code)
);

-- 6. template_signatory_requirements (Signatory requirement count per template)
CREATE TABLE IF NOT EXISTS template_signatory_requirements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_code TEXT NOT NULL UNIQUE REFERENCES report_templates(template_code) ON DELETE CASCADE,
    required_pathologists_count INT NOT NULL DEFAULT 1,
    required_medtechs_count INT NOT NULL DEFAULT 1
);

-- 7. patient_report_sessions (Root visit session aggregate)
CREATE TABLE IF NOT EXISTS patient_report_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    accession_number TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL CHECK (status IN ('Draft', 'Completed')),
    demographics JSONB NOT NULL,
    created_by_user_id UUID NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    last_replaced_at TIMESTAMPTZ NULL
);

-- 8. laboratory_reports (Selected report within a visit session)
CREATE TABLE IF NOT EXISTS laboratory_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES patient_report_sessions(id) ON DELETE CASCADE,
    template_code TEXT NOT NULL REFERENCES report_templates(template_code),
    template_title TEXT NOT NULL,
    renderer_family TEXT NOT NULL,
    reagent_kit_info JSONB,
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. laboratory_results (Encoded parameter result values)
CREATE TABLE IF NOT EXISTS laboratory_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES laboratory_reports(id) ON DELETE CASCADE,
    parameter_code TEXT NOT NULL,
    parameter_name TEXT NOT NULL,
    result_value TEXT NOT NULL,
    unit TEXT,
    evaluation_outcome TEXT NOT NULL CHECK (
        evaluation_outcome IN ('Normal', 'Abnormal', 'Informational', 'NoEvaluation')
    ),
    reference_rule_snapshot JSONB,
    display_order INT NOT NULL DEFAULT 0
);

-- 10. report_signatories (Frozen medical professional signatories snapshot)
CREATE TABLE IF NOT EXISTS report_signatories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES laboratory_reports(id) ON DELETE CASCADE,
    personnel_id UUID NOT NULL REFERENCES personnel(id),
    role TEXT NOT NULL CHECK (role IN ('Pathologist', 'MedicalTechnologist')),
    printed_full_name TEXT NOT NULL,
    printed_credentials TEXT NOT NULL,
    printed_prc_license_number TEXT NOT NULL,
    signature_image_url TEXT,
    display_order INT NOT NULL DEFAULT 1
);
