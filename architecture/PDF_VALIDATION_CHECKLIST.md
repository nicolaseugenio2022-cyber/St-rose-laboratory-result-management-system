# Official PDF & Rendering Validation Checklist (17 Laboratory Templates)

This document establishes the official verification checklist for all 17 laboratory report templates in the St. Rose Laboratory Result Management System.

---

## 1. Universal A4 Page Layout & Rendering Standards

Every template output rendered via `SharedRenderingEngine` and exported as PDF must satisfy the following 13 universal layout criteria:

1. **Header & Logo Alignment**: St. Rose Laboratory header, address, contact details, and logo (`28mm x 28mm`) aligned with configured implementation targets.
2. **Patient Information Placement**: Patient Name, Age, Sex, Accession Number, Examination Date, Requesting Physician, and Address rendered accurately without text overflow.
3. **Typography & Font Sizes**: Font hierarchy (Header Title: 14pt Bold, Table Labels: 10pt Bold, Values: 10pt Regular).
4. **Table Borders & Spacing**: Clean 1px solid slate borders (`#cbd5e1`) with zero cell clipping.
5. **Parameter Alignment**: Parameter Name aligned left, Reference Values centered/right, Results aligned mono-space bold.
6. **Remarks Section**: Rendered conditionally when `supportsRemarks === true`; default remarks text matches template specification.
7. **Reagent Kit Section**: Rendered conditionally when `requiresKitInfo === true` (`kitBrand`, `lotNumber`, `expirationDate`).
8. **Signatory Placement**: Signatory signature images (`45mm x 18mm`), printed names, credentials, and PRC license numbers aligned at document footer.
9. **A4 Margins**: Physical A4 page dimensions (`210mm x 297mm`) with exact 15mm top/bottom and 12mm left/right margins (printable width `186mm`).
10. **Page Breaks**: Multi-page sessions split cleanly at document boundaries using CSS `break-after: page`.
11. **Multi-Page Behavior**: Header and patient demographics re-stated cleanly on page headers if session spans multiple physical pages.
12. **Print Scaling at 100%**: Zero browser print distortion or horizontal scrollbars at 100% zoom scale.
13. **Visual Comparison vs. Official Source**: Visual and structural alignment against official Microsoft Word `.docx` templates located in `Templates/`.

---

## 2. Template-Specific Validation Checklist Matrix (75 Reconciled Parameters)

| Template Code | Official Template Name | Family | Renderer Family | Authoritative Params | Remarks Support | Kit Info Required | Signatories Count | Word Template Status |
|---|---|---|---|---|---|---|---|---|
| **CBC** | Complete Blood Count | Hematology | Tabular | 10 | ✅ Yes | ❌ No | 2 | ✅ PHASE 2A VERIFIED |
| **ESR** | Erythrocyte Sedimentation Rate | Hematology | Tabular | 1 | ❌ No | ❌ No | 2 | ✅ PHASE 2A VERIFIED |
| **CT_BT** | Clotting & Bleeding Time | Hematology | Tabular | 2 | ❌ No | ❌ No | 2 | SOURCE AVAILABLE — VALIDATION PENDING |
| **CHEM_8** | Chemistry 8 Panel | Clinical Chemistry | Tabular | 6 | ✅ Yes | ❌ No | 2 | ✅ PHASE 2A VERIFIED |
| **CHEM_10** | Chemistry 10 Panel | Clinical Chemistry | Tabular | 10 | ✅ Yes | ❌ No | 2 | ✅ PHASE 2A VERIFIED |
| **HDL_LDL** | Lipid Profile (HDL/LDL) | Clinical Chemistry | Tabular | 4 | ✅ Yes | ❌ No | 2 | ✅ PHASE 2A VERIFIED |
| **OGTT** | Oral Glucose Tolerance Test | Clinical Chemistry | Tabular | 3 | ❌ No | ❌ No | 2 | SOURCE AVAILABLE — VALIDATION PENDING |
| **RBS** | Random Blood Sugar | Clinical Chemistry | SimpleResult | 1 | ❌ No | ❌ No | 2 | SOURCE AVAILABLE — VALIDATION PENDING |
| **HBA1C** | HbA1c Report | Clinical Chemistry | SimpleResult | 1 | ❌ No | ✅ Yes | 2 | SOURCE AVAILABLE — VALIDATION PENDING |
| **URINALYSIS** | Urinalysis Examination | Clinical Microscopy | DiagnosticGrid | 14 | ✅ Yes | ❌ No | 2 | SOURCE AVAILABLE — VALIDATION PENDING |
| **FECALYSIS** | Fecalysis Examination | Clinical Microscopy | DiagnosticGrid | 11 | ❌ No | ❌ No | 2 | SOURCE AVAILABLE — VALIDATION PENDING |
| **HBSAG** | Hepatitis B Screening | Serology | SimpleResult | 1 | ❌ No | ✅ Yes | 2 | SOURCE AVAILABLE — VALIDATION PENDING |
| **RPR** | RPR Syphilis Test | Serology | SimpleResult | 1 | ❌ No | ✅ Yes | 2 | SOURCE AVAILABLE — VALIDATION PENDING |
| **PREG_TEST** | Pregnancy Test | Serology | SimpleResult | 1 | ❌ No | ✅ Yes | 2 | SOURCE AVAILABLE — VALIDATION PENDING |
| **DENGUE_DUO** | Dengue Duo Rapid Test | Serology | SimpleResult | 3 | ❌ No | ✅ Yes | 2 | SOURCE AVAILABLE — VALIDATION PENDING |
| **HIV_RESULT** | AIDS Free / HIV Result | Serology | NarrativeCertificate | 1 | ❌ No | ✅ Yes | 3 | SOURCE AVAILABLE — VALIDATION PENDING |
| **BLOOD_TYPING** | Blood Typing Report | Blood Bank | SimpleResult | 2 | ❌ No | ❌ No | 2 | SOURCE AVAILABLE — VALIDATION PENDING |

---

## 3. Individual Template Verification Protocols

For each of the 17 templates, the following objective validation deliverables are used during QA audit:

1. **Validation Checklist File**: Dedicated Markdown checklist verifying all 13 layout criteria.
2. **Overlay Comparison Tool**: Interactive comparison via `PrintFidelityValidationOverlay.tsx` against `Templates/*.docx`.
3. **Deviation Register**: Detailed list of layout deviations (if any).
4. **Pass/Fail Result**: Final validation verdict.
5. **Client Approval Record**: Documented sign-off record.
