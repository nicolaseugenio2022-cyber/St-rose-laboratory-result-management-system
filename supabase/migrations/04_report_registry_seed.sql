-- Migration Unit 04: Authoritative Report Registry Metadata Seed (17 Templates)
-- St. Rose Laboratory Result Management System
-- Reconciled 100% against individual template specifications under architecture/specifications/*.md

-- 1. Insert 17 Report Templates
INSERT INTO report_templates (template_code, template_title, examination_family, renderer_family, color_palette, supports_remarks, default_remarks, requires_kit_info, is_active)
VALUES
  ('CBC', 'Complete Blood Count', 'Hematology', 'Tabular', '#093982', TRUE, 'TEST/S RECHECKED; RESULT/S VERIFIED', FALSE, TRUE),
  ('CHEM_8', 'Basic Metabolic Panel (Chem 8)', 'Clinical Chemistry', 'Tabular', '#093982', TRUE, 'TEST/S RECHECKED; RESULT/S VERIFIED', FALSE, TRUE),
  ('CHEM_10', 'Comprehensive Metabolic Panel (Chem 10)', 'Clinical Chemistry', 'Tabular', '#093982', TRUE, 'TEST/S RECHECKED; RESULT/S VERIFIED', FALSE, TRUE),
  ('HDL_LDL', 'Lipid Profile (HDL/LDL)', 'Clinical Chemistry', 'Tabular', '#093982', TRUE, 'TEST/S RECHECKED; RESULT/S VERIFIED', FALSE, TRUE),
  ('OGTT', 'Oral Glucose Tolerance Test', 'Clinical Chemistry', 'Tabular', '#093982', FALSE, NULL, FALSE, TRUE),
  ('ESR', 'Erythrocyte Sedimentation Rate', 'Hematology', 'Tabular', '#093982', FALSE, NULL, FALSE, TRUE),
  ('CT_BT', 'Clotting Time & Bleeding Time', 'Hematology', 'Tabular', '#093982', FALSE, NULL, FALSE, TRUE),
  ('BLOOD_TYPING', 'Blood Typing & Rh Factor', 'Blood Bank', 'SimpleResult', '#093982', FALSE, NULL, FALSE, TRUE),
  ('RBS', 'Random Blood Sugar', 'Clinical Chemistry', 'SimpleResult', '#093982', FALSE, NULL, FALSE, TRUE),
  ('HBA1C', 'Glycated Hemoglobin (HbA1c)', 'Clinical Chemistry', 'SimpleResult', '#093982', FALSE, NULL, TRUE, TRUE),
  ('HBSAG', 'HBsAg Screening', 'Serology & Immunology', 'SimpleResult', '#093982', FALSE, NULL, TRUE, TRUE),
  ('RPR', 'RPR Syphilis Screening', 'Serology & Immunology', 'SimpleResult', '#093982', FALSE, NULL, TRUE, TRUE),
  ('PREG_TEST', 'Pregnancy Test', 'Serology & Immunology', 'SimpleResult', '#093982', FALSE, NULL, TRUE, TRUE),
  ('DENGUE_DUO', 'Dengue Duo (NS1 & IgG/IgM)', 'Serology & Immunology', 'SimpleResult', '#093982', FALSE, NULL, TRUE, TRUE),
  ('URINALYSIS', 'Routine Urinalysis', 'Clinical Microscopy', 'DiagnosticGrid', '#093982', TRUE, 'TEST/S RECHECKED; RESULT/S VERIFIED', FALSE, TRUE),
  ('FECALYSIS', 'Routine Fecalysis', 'Clinical Microscopy', 'DiagnosticGrid', '#093982', FALSE, NULL, FALSE, TRUE),
  ('HIV_RESULT', 'AIDS Free Certificate (Anti-HIV 1/2)', 'Serology & Immunology', 'NarrativeCertificate', '#093982', FALSE, NULL, TRUE, TRUE)
ON CONFLICT (template_code) DO UPDATE SET
  template_title = EXCLUDED.template_title,
  examination_family = EXCLUDED.examination_family,
  renderer_family = EXCLUDED.renderer_family,
  color_palette = EXCLUDED.color_palette,
  supports_remarks = EXCLUDED.supports_remarks,
  default_remarks = EXCLUDED.default_remarks,
  requires_kit_info = EXCLUDED.requires_kit_info,
  is_active = EXCLUDED.is_active;

-- 2. Insert 17 Template Signatory Requirements
INSERT INTO template_signatory_requirements (template_code, required_pathologists_count, required_medtechs_count)
VALUES
  ('CBC', 1, 1),
  ('CHEM_8', 1, 1),
  ('CHEM_10', 1, 1),
  ('HDL_LDL', 1, 1),
  ('OGTT', 1, 1),
  ('ESR', 1, 1),
  ('CT_BT', 1, 1),
  ('BLOOD_TYPING', 1, 1),
  ('RBS', 1, 1),
  ('HBA1C', 1, 1),
  ('HBSAG', 1, 1),
  ('RPR', 1, 1),
  ('PREG_TEST', 1, 1),
  ('DENGUE_DUO', 1, 1),
  ('URINALYSIS', 1, 1),
  ('FECALYSIS', 1, 1),
  ('HIV_RESULT', 1, 2)
ON CONFLICT (template_code) DO UPDATE SET
  required_pathologists_count = EXCLUDED.required_pathologists_count,
  required_medtechs_count = EXCLUDED.required_medtechs_count;

-- 3. Insert Reconciled Template Parameters (100% Matched to architecture/specifications/*.md)
INSERT INTO template_parameters (template_code, parameter_code, parameter_name, input_type, unit, default_value, is_required, is_selectable, display_order)
VALUES
  -- CBC (10 parameters per CBC.md)
  ('CBC', 'HEMOGLOBIN', 'Hemoglobin', 'NumericText', 'g/L', '', TRUE, TRUE, 1),
  ('CBC', 'HEMATOCRIT', 'Hematocrit', 'NumericText', 'L/L', '', TRUE, TRUE, 2),
  ('CBC', 'RBC', 'RBC Count', 'NumericText', 'x10^12/L', '', TRUE, TRUE, 3),
  ('CBC', 'WBC', 'WBC Count', 'NumericText', 'x10^9/L', '', TRUE, TRUE, 4),
  ('CBC', 'PLATELET', 'Platelet Count', 'NumericText', 'x10^9/L', '', TRUE, TRUE, 5),
  ('CBC', 'NEUTROPHIL', 'Neutrophil', 'NumericText', NULL, '', TRUE, TRUE, 6),
  ('CBC', 'LYMPHOCYTE', 'Lymphocyte', 'NumericText', NULL, '', TRUE, TRUE, 7),
  ('CBC', 'EOSINOPHIL', 'Eosinophil', 'NumericText', NULL, '', TRUE, TRUE, 8),
  ('CBC', 'MONOCYTE', 'Monocyte', 'NumericText', NULL, '', TRUE, TRUE, 9),
  ('CBC', 'BASOPHIL', 'Basophil', 'NumericText', NULL, '', TRUE, TRUE, 10),

  -- CHEM_8 (6 parameters per CHEM_8.md)
  ('CHEM_8', 'FBS', 'Fasting Blood Sugar (FBS)', 'NumericText', 'mg/dL', '', TRUE, TRUE, 1),
  ('CHEM_8', 'CHOLESTEROL', 'Cholesterol', 'NumericText', 'mg/dL', '', TRUE, TRUE, 2),
  ('CHEM_8', 'TRIGLYCERIDES', 'Triglycerides', 'NumericText', 'mg/dL', '', TRUE, TRUE, 3),
  ('CHEM_8', 'URIC_ACID', 'Uric Acid', 'NumericText', 'mg/dL', '', TRUE, TRUE, 4),
  ('CHEM_8', 'SGPT', 'SGPT / ALT', 'NumericText', 'IU/L', '', TRUE, TRUE, 5),
  ('CHEM_8', 'CREATININE', 'Creatinine', 'NumericText', 'mg/dL', '', TRUE, TRUE, 6),

  -- CHEM_10 (10 parameters per CHEM_10.md)
  ('CHEM_10', 'FBS', 'Fasting Blood Sugar (FBS)', 'NumericText', 'mg/dL', '', TRUE, TRUE, 1),
  ('CHEM_10', 'CHOLESTEROL', 'Cholesterol', 'NumericText', 'mg/dL', '', TRUE, TRUE, 2),
  ('CHEM_10', 'TRIGLYCERIDES', 'Triglycerides', 'NumericText', 'mg/dL', '', TRUE, TRUE, 3),
  ('CHEM_10', 'HDL', 'HDL Cholesterol', 'NumericText', 'mg/dL', '', TRUE, TRUE, 4),
  ('CHEM_10', 'LDL', 'LDL Cholesterol', 'Computed', 'mg/dL', '', TRUE, TRUE, 5),
  ('CHEM_10', 'URIC_ACID', 'Uric Acid', 'NumericText', 'mg/dL', '', TRUE, TRUE, 6),
  ('CHEM_10', 'SGPT_ALT', 'SGPT / ALT', 'NumericText', 'IU/L', '', TRUE, TRUE, 7),
  ('CHEM_10', 'SGOT_AST', 'SGOT / AST', 'NumericText', 'IU/L', '', TRUE, TRUE, 8),
  ('CHEM_10', 'BUN', 'Blood Urea Nitrogen (BUN)', 'NumericText', 'mg/dL', '', TRUE, TRUE, 9),
  ('CHEM_10', 'CREATININE', 'Creatinine', 'NumericText', 'mg/dL', '', TRUE, TRUE, 10),

  -- HDL_LDL (4 parameters per HDL_LDL.md)
  ('HDL_LDL', 'CHOLESTEROL', 'Cholesterol', 'NumericText', 'mg/dL', '', TRUE, TRUE, 1),
  ('HDL_LDL', 'TRIGLYCERIDES', 'Triglycerides', 'NumericText', 'mg/dL', '', TRUE, TRUE, 2),
  ('HDL_LDL', 'HDL', 'HDL Cholesterol', 'NumericText', 'mg/dL', '', TRUE, TRUE, 3),
  ('HDL_LDL', 'LDL', 'LDL Cholesterol', 'Computed', 'mg/dL', '', TRUE, TRUE, 4),

  -- OGTT (3 parameters per OGTT.md)
  ('OGTT', 'FASTING', 'Fasting', 'NumericText', 'mg/dL', '', TRUE, TRUE, 1),
  ('OGTT', 'FIRST_HOUR', '1st Hour', 'NumericText', 'mg/dL', '', TRUE, TRUE, 2),
  ('OGTT', 'SECOND_HOUR', '2nd Hour', 'NumericText', 'mg/dL', '', TRUE, TRUE, 3),

  -- ESR (1 parameter per ESR.md)
  ('ESR', 'ESR', 'Erythrocyte Sedimentation Rate', 'NumericText', 'mm/hr', '', TRUE, TRUE, 1),

  -- CT_BT (2 parameters per CT_BT.md)
  ('CT_BT', 'BLEEDING_TIME', 'Bleeding Time', 'NumericText', 'minutes', '', TRUE, TRUE, 1),
  ('CT_BT', 'CLOTTING_TIME', 'Clotting Time', 'NumericText', 'minutes', '', TRUE, TRUE, 2),

  -- BLOOD_TYPING (2 parameters per BLOOD_TYPING.md)
  ('BLOOD_TYPING', 'BLOOD_GROUP', 'ABO Blood Group', 'SingleSelect', NULL, 'O', TRUE, TRUE, 1),
  ('BLOOD_TYPING', 'RH_FACTOR', 'Rh Factor', 'SingleSelect', NULL, 'Positive', TRUE, TRUE, 2),

  -- RBS (1 parameter per RBS.md)
  ('RBS', 'RBS', 'Random Blood Sugar', 'NumericText', 'mg/dL', '', TRUE, TRUE, 1),

  -- HBA1C (1 parameter per HBA1C.md)
  ('HBA1C', 'HBA1C', 'HbA1c Concentration', 'NumericText', '%', '', TRUE, TRUE, 1),

  -- HBSAG (1 parameter per HBSAG.md)
  ('HBSAG', 'HBSAG', 'HBsAg Result', 'SingleSelect', NULL, 'Nonreactive', TRUE, TRUE, 1),

  -- RPR (1 parameter per RPR.md)
  ('RPR', 'RPR', 'RPR Result', 'SingleSelect', NULL, 'Nonreactive', TRUE, TRUE, 1),

  -- PREG_TEST (1 parameter per PREG_TEST.md)
  ('PREG_TEST', 'PREG_TEST', 'Pregnancy Test Result', 'SingleSelect', NULL, 'Negative', TRUE, TRUE, 1),

  -- DENGUE_DUO (3 parameters per DENGUE_DUO.md)
  ('DENGUE_DUO', 'DENGUE_NS1', 'Dengue NS1 Antigen', 'SingleSelect', NULL, 'Negative', TRUE, TRUE, 1),
  ('DENGUE_DUO', 'IGG', 'Dengue IgG', 'SingleSelect', NULL, 'Negative', TRUE, TRUE, 2),
  ('DENGUE_DUO', 'IGM', 'Dengue IgM', 'SingleSelect', NULL, 'Negative', TRUE, TRUE, 3),

  -- URINALYSIS (14 parameters per URINALYSIS.md)
  ('URINALYSIS', 'COLOR', 'Color', 'Combobox', NULL, 'Yellow', TRUE, TRUE, 1),
  ('URINALYSIS', 'CLARITY', 'Clarity', 'Combobox', NULL, 'Clear', TRUE, TRUE, 2),
  ('URINALYSIS', 'PH', 'pH', 'SingleSelect', NULL, '6.0', TRUE, TRUE, 3),
  ('URINALYSIS', 'SPECIFIC_GRAVITY', 'Specific Gravity', 'SingleSelect', NULL, '1.020', TRUE, TRUE, 4),
  ('URINALYSIS', 'PROTEIN', 'Protein', 'SingleSelect', NULL, 'Negative', TRUE, TRUE, 5),
  ('URINALYSIS', 'GLUCOSE', 'Glucose', 'SingleSelect', NULL, 'Negative', TRUE, TRUE, 6),
  ('URINALYSIS', 'WBC', 'WBC', 'FreeText', '/hpf', '0-2 /HPF', TRUE, TRUE, 7),
  ('URINALYSIS', 'RBC', 'RBC', 'FreeText', '/hpf', '0-2 /HPF', TRUE, TRUE, 8),
  ('URINALYSIS', 'EPITHELIAL_CELLS', 'Epithelial Cells', 'SingleSelect', NULL, 'Rare', TRUE, TRUE, 9),
  ('URINALYSIS', 'BACTERIA', 'Bacteria', 'SingleSelect', NULL, 'Few', TRUE, TRUE, 10),
  ('URINALYSIS', 'MUCUS_THREADS', 'Mucus Threads', 'SingleSelect', NULL, 'Rare', TRUE, TRUE, 11),
  ('URINALYSIS', 'CRYSTAL_TYPE', 'Crystal Type', 'SingleSelect', NULL, 'None', TRUE, TRUE, 12),
  ('URINALYSIS', 'CRYSTAL_SEVERITY', 'Crystal Severity', 'SingleSelect', NULL, 'Rare', FALSE, TRUE, 13),
  ('URINALYSIS', 'OTHER_FINDINGS', 'Other Findings', 'FreeText', NULL, '', FALSE, TRUE, 14),

  -- FECALYSIS (11 parameters per FECALYSIS.md)
  ('FECALYSIS', 'COLOR', 'Color', 'SingleSelect', NULL, 'Brown', TRUE, TRUE, 1),
  ('FECALYSIS', 'CONSISTENCY', 'Consistency', 'SingleSelect', NULL, 'Soft', TRUE, TRUE, 2),
  ('FECALYSIS', 'BLOOD', 'Blood', 'SingleSelect', NULL, 'Negative', TRUE, TRUE, 3),
  ('FECALYSIS', 'MUCUS', 'Mucus', 'SingleSelect', NULL, 'Negative', TRUE, TRUE, 4),
  ('FECALYSIS', 'PH', 'pH', 'SingleSelect', NULL, 'Neutral', TRUE, TRUE, 5),
  ('FECALYSIS', 'FAT_GLOBULES', 'Fat Globules', 'SingleSelect', NULL, 'None', TRUE, TRUE, 6),
  ('FECALYSIS', 'PUS_CELLS', 'Pus Cells', 'SingleSelect', '/hpf', '0-2', TRUE, TRUE, 7),
  ('FECALYSIS', 'RED_CELLS', 'Red Cells', 'SingleSelect', '/hpf', '0-2', TRUE, TRUE, 8),
  ('FECALYSIS', 'BACTERIA', 'Bacteria', 'SingleSelect', NULL, 'Normal Flora', TRUE, TRUE, 9),
  ('FECALYSIS', 'PARASITE', 'Parasite / Ova Findings', 'FreeText', NULL, 'NO INTESTINAL PARASITES OR OVA SEEN', TRUE, TRUE, 10),
  ('FECALYSIS', 'OTHERS', 'Other Findings', 'FreeText', NULL, 'None', TRUE, TRUE, 11),

  -- HIV_RESULT (1 parameter per HIV_RESULT.md)
  ('HIV_RESULT', 'HIV_SCREENING', 'Anti-HIV 1/2 Screening Test', 'SingleSelect', NULL, 'Nonreactive', TRUE, TRUE, 1)
ON CONFLICT (template_code, parameter_code) DO UPDATE SET
  parameter_name = EXCLUDED.parameter_name,
  input_type = EXCLUDED.input_type,
  unit = EXCLUDED.unit,
  default_value = EXCLUDED.default_value,
  display_order = EXCLUDED.display_order;
