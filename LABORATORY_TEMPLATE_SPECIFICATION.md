# LABORATORY_TEMPLATE_SPECIFICATION.md

# Purpose

This document serves as the authoritative index and authority map for all 17 laboratory report template specifications.

All detailed behavioral definitions, parameters, computations, dropdown values, remarks rules, reagent kit requirements, signatory rules, rendering metadata, and client instructions are fully defined in the individual specification documents located under:

`architecture/specifications/`

---

# Authority Mapping

Visual Authority (corrected under SHADCN-06D):
- `architecture/report-specifications/Summary.md` — explicit client acceptance requirements
- The maintained detailed specification for the report
- `architecture/REPORT_RENDERING_ARCHITECTURE.md` — pipeline, geometry and signatory placement
- `architecture/PDF_VALIDATION_CHECKLIST.md` — universal layout criteria and geometry constants
- The approved deterministic rendering contracts and completed snapshots

The original Microsoft Word templates (`Templates/*.docx`) are **historical source material and are
not present in the repository**. They are not a current, repository-accessible authority.

Behavioral & Implementation Authority:
- `architecture/specifications/RENDERING_RULES.md`
- `architecture/specifications/<TEMPLATE_CODE>.md`

---

# Template Specifications Index

The **Renderer Family** column below is the **declarative / native composition** value carried by
`src/domain/definitions/` — the layer these maintained specifications describe.

A second, **persisted** vocabulary exists: `report_templates.renderer_family`, constrained by
`supabase/migrations/02_tables.sql` to `Tabular` · `SimpleResult` · `DiagnosticGrid` ·
`NarrativeCertificate`. It cannot hold `Dedicated Certificate`. The two layers meet in
`LAYOUT_FAMILIES` (`src/rendering/model/render-model-adapters.ts`), which accepts both spellings.

> **UNRESOLVED — do not treat this table as settling it.** For `HIV_RESULT` the two vocabularies
> converge (`NarrativeCertificate` and `Dedicated Certificate` both resolve to `Certificate`), so the
> difference is cosmetic. For **`CT_BT`, `ESR` and `FECALYSIS` they resolve to *different* layout
> families**, and drafts resolve from the declarative value while completed reports resolve from the
> frozen snapshot's persisted value. That is a **runtime** question, not a documentation one; it is
> recorded here and deferred to **SHADCN-07A**. Do not reconcile it by editing documentation.

| Template Code | Official Template Name | Examination Family | Renderer Family (declarative / native) | Specification Document |
|---|---|---|---|---|
| `BLOOD_TYPING` | Blood Typing Report | Blood Bank | SimpleResult | [BLOOD_TYPING.md](architecture/specifications/BLOOD_TYPING.md) |
| `CBC` | Complete Blood Count | Hematology | Tabular | [CBC.md](architecture/specifications/CBC.md) |
| `CHEM_8` | Chemistry 8 Panel | Clinical Chemistry | Tabular | [CHEM_8.md](architecture/specifications/CHEM_8.md) |
| `CHEM_10` | Chemistry 10 Panel | Clinical Chemistry | Tabular | [CHEM_10.md](architecture/specifications/CHEM_10.md) |
| `CT_BT` | Clotting & Bleeding Time | Hematology | SimpleResult | [CT_BT.md](architecture/specifications/CT_BT.md) |
| `DENGUE_DUO` | Dengue Duo Rapid Test | Serology & Immunology | SimpleResult | [DENGUE_DUO.md](architecture/specifications/DENGUE_DUO.md) |
| `ESR` | Erythrocyte Sedimentation Rate | Hematology | SimpleResult | [ESR.md](architecture/specifications/ESR.md) |
| `FECALYSIS` | Fecalysis Examination | Clinical Microscopy | Tabular | [FECALYSIS.md](architecture/specifications/FECALYSIS.md) |
| `HBA1C` | HbA1c Report | Clinical Chemistry | SimpleResult | [HBA1C.md](architecture/specifications/HBA1C.md) |
| `HBSAG` | Hepatitis B (HBsAg) Screening | Serology & Immunology | SimpleResult | [HBSAG.md](architecture/specifications/HBSAG.md) |
| `HDL_LDL` | Lipid Profile Panel (HDL/LDL) | Clinical Chemistry | Tabular | [HDL_LDL.md](architecture/specifications/HDL_LDL.md) |
| `HIV_RESULT` | AIDS Free Certificate / HIV Result | Serology & Immunology | Dedicated Certificate | [HIV_RESULT.md](architecture/specifications/HIV_RESULT.md) |
| `OGTT` | Oral Glucose Tolerance Test | Clinical Chemistry | Tabular | [OGTT.md](architecture/specifications/OGTT.md) |
| `PREG_TEST` | Pregnancy Test (Urine) | Serology & Immunology | SimpleResult | [PREG_TEST.md](architecture/specifications/PREG_TEST.md) |
| `RBS` | Random Blood Sugar | Clinical Chemistry | SimpleResult | [RBS.md](architecture/specifications/RBS.md) |
| `RPR` | RPR Syphilis Test | Serology & Immunology | SimpleResult | [RPR.md](architecture/specifications/RPR.md) |
| `URINALYSIS` | Urinalysis Examination | Clinical Microscopy | DiagnosticGrid | [URINALYSIS.md](architecture/specifications/URINALYSIS.md) |

---

# Maintenance Rules

1. Detailed template specifications must be maintained exclusively inside `architecture/specifications/`.
2. Do not duplicate template parameters, computations, or client notes inside this index document.
3. Any changes to template behaviors or client requirements must be updated directly in the corresponding specification document.
