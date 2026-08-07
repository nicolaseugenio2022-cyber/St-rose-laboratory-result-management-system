# St. Rose Laboratory Result Management System
## Report Registry Architecture Specification

---

# 1. Purpose & Architectural Status

This document defines the official **Report Registry Architecture Specification** for the **St. Rose Laboratory Result Management System**.

It specifies how the Report Registry acts as the single source of truth for template metadata, parameter definitions, reference rules, signatory requirements, remarks support, reagent kit requirements, and input behaviors across all 17 official laboratory templates.

## 1.1 Authority Hierarchy Alignment

This document operates strictly within the project authority hierarchy:

1. **PROJECT.md**: Authoritative source for project vision, milestone roadmaps, technology stack, and system-wide business rules.
2. **LABORATORY_TEMPLATE_SPECIFICATION.md**: Authoritative specification for official laboratory report templates, parameter definitions, reference rules, signatories, and renderer behavior.
3. **Architecture/DOMAIN_MODEL.md (FROZEN)**: Authoritative business domain specification defining entities, aggregate roots, value objects, domain services, lifecycles, and business invariants.
4. **Architecture/DATABASE_DESIGN.md (FROZEN)**: Authoritative relational database architecture and schema specification.
5. **Current Source Code**: Contextual reference only. Code never overrides architecture specifications.

## 1.2 Non-Inference Rule (Authority Strictness)

**MANDATORY ARCHITECTURAL RULE**: No medical domain knowledge, external clinical guidelines, or standard hospital conventions may be substituted for client-confirmed requirements. The Report Registry models **exclusively** what St. Rose Diagnostic Laboratory requested and confirmed in `LABORATORY_TEMPLATE_SPECIFICATION.md` and `PROJECT.md`.

---

# 2. Architectural Boundary: Registry vs. Renderer

- **Report Registry (WHAT)**: Exposes template metadata — parameter lists, input controls, dropdown options, default values, display units, reference rules, required kit details, signatory counts, and remarks configuration.
- **Report Renderer (HOW)**: Controls visual DOM presentation, typography, borders, headers, logo placement, signature positioning, and A4 page formatting.

The Report Registry provides pure metadata specifications consumed by encoding forms and report renderers.

---

# 3. Renderer Families & Template Mapping

Every official laboratory template is assigned to exactly one **Renderer Family** based strictly on its approved layout structure:

| Renderer Family | Description | Assigned Laboratory Templates |
|---|---|---|
| **Tabular Report Family** | Multi-column ordered parameter tables (Parameter Name, Result Value, Unit, Reference Range). | `CBC`, `CHEM_8`, `CHEM_10`, `HDL_LDL`, `OGTT`, `ESR`, `CT_BT` |
| **Simple Result Family** | Focused single-result or dual-result card layouts with explicit outcome statements. | `BLOOD_TYPING`, `RBS`, `HBA1C`, `HBSAG`, `RPR`, `PREG_TEST`, `DENGUE_DUO` |
| **Diagnostic Grid Family** | Multi-section structured grids dividing physical, chemical, and microscopic examination findings. | `URINALYSIS`, `FECALYSIS` |
| **Narrative Certificate Family** | Official narrative certificate layout with formal certification statements and multi-signatory blocks. | `HIV_RESULT` |

---

# 4. Shared Workflows & Organizational Metadata

## 4.1 Confirmed Shared Chemistry Workflow Grouping

The client explicitly requested a shared workflow/menu for four specific Chemistry templates:
- **`CHEM_8`** (Chemistry 8 Panel)
- **`CHEM_10`** (Chemistry 10 Panel)
- **`HDL_LDL`** (Lipid Profile Panel)
- **`RBS`** (Random Blood Sugar)

Selecting these tests within a session shares common parameters and encoding workflows.

### Standalone Templates:
`HBA1C` and `OGTT` remain independent standalone templates and are **not** part of the shared Chemistry encoding workflow.

---

# 5. Input Controls & Approved Computations

## 5.1 Input Control Styles

Input styles strictly reflect client-confirmed template requirements:

| Input Style | Behavior & Scope | Approved Choices / Scope |
|---|---|---|
| `NumericText` | Numeric input with unit suffix | Hemoglobin, Glucose, Urea, Creatinine, etc. |
| `FreeText` | Open qualitative text entry | Remarks, additional microscopic findings |
| `SingleSelect` | Strict dropdown (fixed choices) | `POSITIVE` / `NEGATIVE` (Pregnancy Test, Dengue Duo)<br>`REACTIVE` / `NON-REACTIVE` (HBsAg, RPR, HIV)<br>`A` / `B` / `AB` / `O` (Blood Group)<br>`Positive` / `Negative` (Rh Factor) |
| `Combobox` | Editable dropdown (choices + manual text) | Urinalysis/Fecalysis qualitative fields where client provided choices + manual entry |
| `Computed` | Derived calculation | Client-confirmed formulas explicitly defined in template spec |

## 5.2 Approved Computed Parameters

Only computations explicitly documented in `LABORATORY_TEMPLATE_SPECIFICATION.md` are supported. External formulas (such as Friedewald LDL or arbitrary VLDL/ratios) are strictly excluded.

- **Chemistry 10 (`CHEM_10`) & Lipid Profile (`HDL_LDL`)**:
  - `HDL_LDL` uses the **SAME** client-confirmed computation behavior explicitly documented for `CHEM_10`.
  - No external clinical formulas or unapproved ratios (`CHOL_HDL_RATIO`, etc.) are introduced.

---

# 6. Template Metadata & Special Behaviors

## 6.1 Urinalysis — Amorphous Urates / Phosphates Behavior
The Urinalysis crystal selection is **user-controlled** (not automatically inferred from pH):
- Options: `None` | `Amorphous Urates` | `Amorphous Phosphates`
- **If `None`**: The crystal row is **completely omitted** from the rendered report output.
- **If `Amorphous Urates` or `Amorphous Phosphates`**: The selected label renders on the report alongside its entered severity/value.

## 6.2 Hide-When-Empty Behavior
Unselected parameters (`is_selected = false`) or optional fields left blank do not validate, do not trigger reference evaluation, and are **omitted from persistence and report rendering**.

## 6.3 Reagent Kit Information Traceability
Templates requiring diagnostic reagent tracking (`DENGUE_DUO`, `HIV_RESULT`, `HBSAG`, `RPR`, `PREG_TEST`) specify `requires_kit_info = TRUE`.

The registry enforces collection of:
- Kit Brand / Name
- Kit Lot Number
- Kit Expiration Date

## 6.4 Signatory Requirements

| Template Code | Required Pathologists | Required MedTechs | Total Signatories |
|---|---|---|---|
| `HIV_RESULT` | 1 | **2** | **3** (Dual MedTech Signatories) |
| All Other 16 Templates | 1 | 1 | 2 |

---

# 7. Complete Template Registry Specifications (17 Templates)

| Template Code | Template Title | Renderer Family | Input Controls | Remarks | Kit Info | Signatories |
|---|---|---|---|---|---|---|
| `BLOOD_TYPING` | Blood Typing Report | `SimpleResult` | Dropdowns (Group A/B/AB/O, Rh +/-) | Yes | No | 1 Path / 1 MT |
| `CBC` | Complete Blood Count | `Tabular` | Numeric + % Suffix | Yes | No | 1 Path / 1 MT |
| `CHEM_8` | Chemistry 8 Panel | `Tabular` | Numeric + Units | Yes | No | 1 Path / 1 MT |
| `CHEM_10` | Chemistry 10 Panel | `Tabular` | Numeric + Units | Yes | No | 1 Path / 1 MT |
| `CT_BT` | Clotting / Bleeding Time | `Tabular` | Numeric (Mins/Secs) | Yes | No | 1 Path / 1 MT |
| `DENGUE_DUO` | Dengue Duo Rapid Test | `SimpleResult` | Dropdowns (POS/NEG) | Yes | Yes | 1 Path / 1 MT |
| `ESR` | Erythrocyte Sed. Rate | `Tabular` | Numeric (mm/hr) | Yes | No | 1 Path / 1 MT |
| `FECALYSIS` | Fecalysis Examination | `DiagnosticGrid` | Comboboxes + FreeText | Yes | No | 1 Path / 1 MT |
| `HBA1C` | HbA1c Report | `SimpleResult` | Numeric (% unit) | Yes | No | 1 Path / 1 MT |
| `HDL_LDL` | Lipid Profile (HDL/LDL) | `Tabular` | Numeric + Client Formula | Yes | No | 1 Path / 1 MT |
| `HIV_RESULT` | HIV Result Form | `NarrativeCertificate` | Dropdown (REACT/NON-REACT) | Yes | Yes | **1 Path / 2 MT** |
| `OGTT` | Oral Glucose Tolerance | `Tabular` | Ordered Fasting/1hr/2hr Rows | Yes | No | 1 Path / 1 MT |
| `PREG_TEST` | Pregnancy Test | `SimpleResult` | Dropdown (POS/NEG) | Yes | Yes | 1 Path / 1 MT |
| `RBS` | Random Blood Sugar | `SimpleResult` | Numeric (mg/dL or mmol/L) | Yes | No | 1 Path / 1 MT |
| `RPR` | RPR Serology Test | `SimpleResult` | Dropdown (REACT/NON-REACT) | Yes | Yes | 1 Path / 1 MT |
| `URINALYSIS` | Urinalysis Examination | `DiagnosticGrid` | Comboboxes + User Urates/Phosph | Yes | No | 1 Path / 1 MT |
| `HBSAG` | Hepatitis B (HBsAg) | `SimpleResult` | Dropdown (REACT/NON-REACT) | Yes | Yes | 1 Path / 1 MT |

---

# 8. Refined Configuration-Only Extensibility Strategy

1. **Configuration-Only Extensibility**: Adding a new template using an existing Renderer Family (`Tabular`, `SimpleResult`, `DiagnosticGrid`, `NarrativeCertificate`), supported input styles, and standard reference rules requires **only SQL `INSERT` statements** into `report_templates`, `template_parameters`, and `template_signatory_requirements`.
2. **Code-Supported Extensibility**: Required **only** if introducing a brand new visual renderer family layout engine, novel UI widget, or new calculation function.
3. **Isolation Rule**: Adding a new template must **never** require modifying existing templates or their configurations.
