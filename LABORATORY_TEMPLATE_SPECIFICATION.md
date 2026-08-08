# LABORATORY_TEMPLATE_SPECIFICATION.md

# Purpose

This document serves as the authoritative index and authority map for all 17 laboratory report template specifications.

All detailed behavioral definitions, parameters, computations, dropdown values, remarks rules, reagent kit requirements, signatory rules, rendering metadata, and client instructions are fully defined in the individual specification documents located under:

`architecture/specifications/`

---

# Authority Mapping

Visual Authority:
- Official Microsoft Word templates in `Templates/*.docx`

Behavioral & Implementation Authority:
- `architecture/specifications/INDEX.md`
- `architecture/specifications/GLOSSARY.md`
- `architecture/specifications/RENDERING_RULES.md`
- `architecture/specifications/<TEMPLATE_CODE>.md`

---

# Template Specifications Index

| Template Code | Official Template Name | Examination Family | Renderer Family | Specification Document |
|---|---|---|---|---|
| `BLOOD_TYPING` | Blood Typing Report | Blood Bank | SimpleResult | [BLOOD_TYPING.md](file:///c:/Projects/St-rose-laboratory-result-management-system/architecture/specifications/BLOOD_TYPING.md) |
| `CBC` | Complete Blood Count | Hematology | Tabular | [CBC.md](file:///c:/Projects/St-rose-laboratory-result-management-system/architecture/specifications/CBC.md) |
| `CHEM_8` | Chemistry 8 Panel | Clinical Chemistry | Tabular | [CHEM_8.md](file:///c:/Projects/St-rose-laboratory-result-management-system/architecture/specifications/CHEM_8.md) |
| `CHEM_10` | Chemistry 10 Panel | Clinical Chemistry | Tabular | [CHEM_10.md](file:///c:/Projects/St-rose-laboratory-result-management-system/architecture/specifications/CHEM_10.md) |
| `CT_BT` | Clotting & Bleeding Time | Hematology | Tabular | [CT_BT.md](file:///c:/Projects/St-rose-laboratory-result-management-system/architecture/specifications/CT_BT.md) |
| `DENGUE_DUO` | Dengue Duo Rapid Test | Serology & Immunology | SimpleResult | [DENGUE_DUO.md](file:///c:/Projects/St-rose-laboratory-result-management-system/architecture/specifications/DENGUE_DUO.md) |
| `ESR` | Erythrocyte Sedimentation Rate | Hematology | Tabular | [ESR.md](file:///c:/Projects/St-rose-laboratory-result-management-system/architecture/specifications/ESR.md) |
| `FECALYSIS` | Fecalysis Examination | Clinical Microscopy | DiagnosticGrid | [FECALYSIS.md](file:///c:/Projects/St-rose-laboratory-result-management-system/architecture/specifications/FECALYSIS.md) |
| `HBA1C` | HbA1c Report | Clinical Chemistry | SimpleResult | [HBA1C.md](file:///c:/Projects/St-rose-laboratory-result-management-system/architecture/specifications/HBA1C.md) |
| `HBSAG` | Hepatitis B (HBsAg) Screening | Serology & Immunology | SimpleResult | [HBSAG.md](file:///c:/Projects/St-rose-laboratory-result-management-system/architecture/specifications/HBSAG.md) |
| `HDL_LDL` | Lipid Profile Panel (HDL/LDL) | Clinical Chemistry | Tabular | [HDL_LDL.md](file:///c:/Projects/St-rose-laboratory-result-management-system/architecture/specifications/HDL_LDL.md) |
| `HIV_RESULT` | AIDS Free Certificate / HIV Result | Serology & Immunology | NarrativeCertificate | [HIV_RESULT.md](file:///c:/Projects/St-rose-laboratory-result-management-system/architecture/specifications/HIV_RESULT.md) |
| `OGTT` | Oral Glucose Tolerance Test | Clinical Chemistry | Tabular | [OGTT.md](file:///c:/Projects/St-rose-laboratory-result-management-system/architecture/specifications/OGTT.md) |
| `PREG_TEST` | Pregnancy Test (Urine) | Serology & Immunology | SimpleResult | [PREG_TEST.md](file:///c:/Projects/St-rose-laboratory-result-management-system/architecture/specifications/PREG_TEST.md) |
| `RBS` | Random Blood Sugar | Clinical Chemistry | SimpleResult | [RBS.md](file:///c:/Projects/St-rose-laboratory-result-management-system/architecture/specifications/RBS.md) |
| `RPR` | RPR Syphilis Test | Serology & Immunology | SimpleResult | [RPR.md](file:///c:/Projects/St-rose-laboratory-result-management-system/architecture/specifications/RPR.md) |
| `URINALYSIS` | Urinalysis Examination | Clinical Microscopy | DiagnosticGrid | [URINALYSIS.md](file:///c:/Projects/St-rose-laboratory-result-management-system/architecture/specifications/URINALYSIS.md) |

---

# Maintenance Rules

1. Detailed template specifications must be maintained exclusively inside `architecture/specifications/`.
2. Do not duplicate template parameters, computations, or client notes inside this index document.
3. Any changes to template behaviors or client requirements must be updated directly in the corresponding specification document.
