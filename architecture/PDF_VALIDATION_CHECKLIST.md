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
13. **Visual Comparison vs. Official Source** *(historical criterion — not currently executable)*: this step compared output against the official Microsoft Word `.docx` templates, which are historical source material and are **not present in the repository**. Current visual acceptance runs against criteria 1–12 above, `REPORT_RENDERING_ARCHITECTURE.md`, and the approved deterministic rendering contracts.

---

## 2. Template-Specific Validation Checklist Matrix (74 Reconciled Parameters)

| Template Code | Official Template Name | Family | Renderer Family | Authoritative Params | Remarks Support | Kit Info Required | Signatories Count | Validation Status |
|---|---|---|---|---|---|---|---|---|
| **CBC** | Complete Blood Count | Hematology | Tabular | 10 | ✅ Yes | ❌ No | 2 | ✅ PHASE 2A VERIFIED |
| **ESR** | Erythrocyte Sedimentation Rate | Hematology | SimpleResult | 1 | ✅ Yes | ❌ No | 2 | ✅ PHASE 2A VERIFIED |
| **CT_BT** | Clotting & Bleeding Time | Hematology | SimpleResult | 2 | ✅ Yes | ❌ No | 2 | VALIDATION PENDING |
| **CHEM_8** | Chemistry 8 Panel | Clinical Chemistry | Tabular | 6 | ✅ Yes | ❌ No | 2 | ✅ PHASE 2A VERIFIED |
| **CHEM_10** | Chemistry 10 Panel | Clinical Chemistry | Tabular | 10 | ✅ Yes | ❌ No | 2 | ✅ PHASE 2A VERIFIED |
| **HDL_LDL** | Lipid Profile (HDL/LDL) | Clinical Chemistry | Tabular | 8 | ✅ Yes | ❌ No | 2 | ✅ PHASE 2A VERIFIED |
| **OGTT** | Oral Glucose Tolerance Test | Clinical Chemistry | Tabular | 3 | ✅ Yes | ❌ No | 2 | VALIDATION PENDING |
| **RBS** | Random Blood Sugar | Clinical Chemistry | SimpleResult | 1 | ✅ Yes | ❌ No | 2 | VALIDATION PENDING |
| **HBA1C** | HbA1c Report | Clinical Chemistry | SimpleResult | 1 | ✅ Yes | ✅ Yes | 2 | VALIDATION PENDING |
| **URINALYSIS** | Urinalysis Examination | Clinical Microscopy | DiagnosticGrid | 12 | ✅ Yes | ❌ No | 2 | VALIDATION PENDING |
| **FECALYSIS** | Fecalysis Examination | Clinical Microscopy | Tabular | 11 | ✅ Yes | ❌ No | 2 | VALIDATION PENDING |
| **HBSAG** | Hepatitis B Screening | Serology | SimpleResult | 1 | ✅ Yes | ✅ Yes | 2 | VALIDATION PENDING |
| **RPR** | RPR Syphilis Test | Serology | SimpleResult | 1 | ✅ Yes | ✅ Yes | 2 | VALIDATION PENDING |
| **PREG_TEST** | Pregnancy Test | Serology | SimpleResult | 1 | ✅ Yes | ✅ Yes | 2 | VALIDATION PENDING |
| **DENGUE_DUO** | Dengue Duo Rapid Test | Serology | SimpleResult | 3 | ✅ Yes | ✅ Yes | 2 | VALIDATION PENDING |
| **HIV_RESULT** | AIDS Free / HIV Result | Serology | Dedicated Certificate | 1 | ✅ Yes | ✅ Yes | 3 | VALIDATION PENDING |
| **BLOOD_TYPING** | Blood Typing Report | Blood Bank | SimpleResult | 2 | ✅ Yes | ❌ No | 2 | VALIDATION PENDING |

---

## 3. Individual Template Verification Protocols

For each of the 17 templates, the following objective validation deliverables are used during QA audit:

1. **Validation Checklist File**: Dedicated Markdown checklist verifying all 13 layout criteria.
2. **Overlay Comparison Tool**: Interactive comparison via `PrintFidelityValidationOverlay.tsx`. The `Templates/*.docx` overlay source is historical and is no longer available in the repository; the tool is used against the approved geometry constants in §1.
3. **Deviation Register**: Detailed list of layout deviations (if any).
4. **Pass/Fail Result**: Final validation verdict.
5. **Client Approval Record**: Documented sign-off record.
