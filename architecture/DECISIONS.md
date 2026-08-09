# St. Rose Laboratory Result Management System
## Index of Key Architectural Decisions

---

# 1. Overview & Purpose

This document provides a concise, high-level index of the major architectural decisions established across the **St. Rose Laboratory Result Management System**.

It summarizes key technical and domain decisions, their rationale, consequences, and references to authoritative specification files.

---

# 2. Confirmed Architectural Decisions Index

### DEC-001: Official Word Templates as Visual Authority
- **Decision**: The Microsoft Word document templates located in `Templates/` serve as the supreme visual layout authority for laboratory report output.
- **Why**: Ensures printed reports match the physical paper layouts approved by the laboratory client.
- **Consequence**: HTML/CSS rendering engines must reproduce Word template typography, borders, margins, and headers down to the millimeter.
- **Related Authority**: `PROJECT.md`, `Templates/*.docx`, `REPORT_RENDERING_ARCHITECTURE.md`.

---

### DEC-002: LABORATORY_TEMPLATE_SPECIFICATION.md as Template-Behavior Authority
- **Decision**: `LABORATORY_TEMPLATE_SPECIFICATION.md` is the authoritative specification for parameter lists, input types, reference rules, signatory counts, and remarks configuration across all 17 templates.
- **Why**: Establishes a single frozen source of truth for business requirements, avoiding reliance on external clinical assumptions.
- **Consequence**: No parameter, calculation, or validation rule may be added unless explicitly documented in the specification.
- **Related Authority**: `LABORATORY_TEMPLATE_SPECIFICATION.md`, `REPORT_REGISTRY_ARCHITECTURE.md`.

---

### DEC-003: Report-Centric Architecture
- **Decision**: The entire system is architected around generating, managing, and reproducing official laboratory reports rather than generic EMR records.
- **Why**: Aligns directly with the core operational mission of St. Rose Diagnostic Laboratory.
- **Consequence**: Workflows, domain entities, database tables, and rendering pipelines are optimized for report generation and fidelity.
- **Related Authority**: `PROJECT.md`, `DOMAIN_MODEL.md`.

---

### DEC-004: Patient Report Session as Core Transactional Aggregate
- **Decision**: `PatientReportSession` is the primary aggregate root representing a single patient visit.
- **Why**: Captures patient visit demographics once and groups all selected diagnostic examinations within a unified transactional boundary.
- **Consequence**: Session completion, draft auto-save, retention expiration, and audit logging operate at the session aggregate level.
- **Related Authority**: `DOMAIN_MODEL.md`, `DATABASE_DESIGN.md`.

---

### DEC-005: Shared Patient Demographics Per Visit
- **Decision**: Patient demographic fields (Name, Age, Sex, Address, Status, Physician, Date) are captured once per session.
- **Why**: Eliminates redundant data entry when a patient undergoes multiple tests during a single visit.
- **Consequence**: All selected laboratory reports within the session inherit and display identical patient demographics.
- **Related Authority**: `DOMAIN_MODEL.md`, `UI_ARCHITECTURE.md`.

---

### DEC-006: Configuration-Driven Report Registry
- **Decision**: All template parameter definitions, display ordering, units, input types, reference rules, and remarks support are stored as declarative registry metadata in `report_templates` and `template_parameters`.
- **Why**: Decouples application software code from template-specific business rules.
- **Consequence**: Adding or refining template parameters is driven by registry metadata without modifying application components.
- **Related Authority**: `REPORT_REGISTRY_ARCHITECTURE.md`, `DATABASE_DESIGN.md`.

---

### DEC-007: Renderer Family Architecture
- **Decision**: Every template is assigned to one of four visual Renderer Families (`Tabular`, `SimpleResult`, `DiagnosticGrid`, `NarrativeCertificate`).
- **Why**: Groups similar visual report layouts into reusable rendering engines.
- **Consequence**: `OGTT` is assigned to `Tabular`; `HIV_RESULT` is assigned to `NarrativeCertificate`; `URINALYSIS`/`FECALYSIS` use `DiagnosticGrid`.
- **Related Authority**: `LABORATORY_TEMPLATE_SPECIFICATION.md`, `REPORT_REGISTRY_ARCHITECTURE.md`, `REPORT_RENDERING_ARCHITECTURE.md`.

---

### DEC-008: Shared Preview / Print / PDF Rendering Pipeline
- **Decision**: Screen Preview, Browser Print, and PDF Output MUST originate from the exact same shared rendering engine.
- **Why**: Prevents visual layout drift between on-screen previewing, paper printing, and digital PDF generation.
- **Consequence**: What laboratory staff see in Preview is 100% identical to printed paper and exported PDF files.
- **Related Authority**: `PROJECT.md`, `REPORT_RENDERING_ARCHITECTURE.md`.

---

### DEC-009: One Selected Laboratory Report = One Physical A4 Page
- **Decision**: Every selected examination in a session renders on exactly one independent physical A4 page (`210mm x 297mm`).
- **Why**: Enforces standard physical paper distribution for multi-test patient visits.
- **Consequence**: Multi-page sessions enforce strict page breaks (`break-after: page;`) between test reports; content never bleeds onto secondary pages.
- **Related Authority**: `PROJECT.md`, `REPORT_RENDERING_ARCHITECTURE.md`.

---

### DEC-010: Application Branding vs. Laboratory Report Branding Separation
- **Decision**: The application UI theme (St. Rose circular logo, `#093982` primary blue) is completely independent of laboratory report output branding (`report_templates.color_palette`).
- **Why**: Allows modern application UI enhancements without altering approved official medical document colors.
- **Consequence**: System UI branding applies to AppShell and forms; report templates retain their individual official colors.
- **Related Authority**: `PROJECT.md`, `REPORT_RENDERING_ARCHITECTURE.md`, `UI_ARCHITECTURE.md`.

---

### DEC-011: Authentication Users vs. Personnel Separation
- **Decision**: System login identities (`user_profiles`) and PRC-licensed medical professionals (`personnel`) are 100% decoupled with zero foreign key constraints.
- **Why**: A system user (e.g., reception staff) is not a medical signatory, while a Pathologist may sign reports without needing a software login account.
- **Consequence**: License numbers, credentials, and signature PNG assets belong strictly to `personnel`.
- **Related Authority**: `DOMAIN_MODEL.md`, `DATABASE_DESIGN.md`, `SECURITY_MODEL.md`.

---

### DEC-012: Supabase Auth Ownership of Credentials
- **Decision**: Passwords, identity authentication, and token issuance are managed exclusively by Supabase Auth (`auth.users`).
- **Why**: Guarantees industry-standard identity security and prevents credential leaks.
- **Consequence**: The application database stores **zero** password hashes. `user_profiles` references `auth.users(id)` via 1:1 primary key.
- **Related Authority**: `DATABASE_DESIGN.md`, `SECURITY_MODEL.md`.

---

### DEC-013: Personnel Signatory Model
- **Decision**: Medical signatories (Pathologists and Medical Technologists) are maintained in the `personnel` master table with PRC license numbers, professional titles, and signature PNG references.
- **Why**: Ensures full legal medical compliance and signature traceability on printed laboratory reports.
- **Consequence**: Pathologist signature images are stored in protected non-public storage and rendered over name lines during output generation.
- **Related Authority**: `DOMAIN_MODEL.md`, `REPORT_RENDERING_ARCHITECTURE.md`, `SECURITY_MODEL.md`.

---

### DEC-014: Template-Specific Signatory Requirements
- **Decision**: `HIV_RESULT` requires **3 signatories** (1 Pathologist + 2 MedTechs); all other 16 templates require **2 signatories** (1 Pathologist + 1 MedTech).
- **Why**: Complies with official Philippine health regulations for confidential HIV testing.
- **Consequence**: Signatory validation and signatory block rendering dynamically enforce template-specific requirements.
- **Related Authority**: `LABORATORY_TEMPLATE_SPECIFICATION.md`, `REPORT_REGISTRY_ARCHITECTURE.md`, `REPORT_RENDERING_ARCHITECTURE.md`.

---

### DEC-015: Metadata-Driven Input Controls
- **Decision**: Dynamic form generation is driven by parameter metadata styles (`NumericText`, `FreeText`, `SingleSelect`, `Combobox`, `Computed`).
- **Why**: Avoids hardcoding React form components for individual templates.
- **Consequence**: Qualitatively variable fields (Urinalysis/Fecalysis) use editable comboboxes; fixed results use strict single-choice dropdowns.
- **Related Authority**: `REPORT_REGISTRY_ARCHITECTURE.md`, `UI_ARCHITECTURE.md`.

---

### DEC-016: Selectable Examination Parameters
- **Decision**: Laboratory staff can toggle individual parameter selection (`is_selected`).
- **Why**: Allows customizing panel test items based on physician requests.
- **Consequence**: Deselected parameters (`is_selected = false`) disable input, skip validation/abnormal evaluation, and are scrubbed from database storage and printed reports.
- **Related Authority**: `DOMAIN_MODEL.md`, `DATABASE_DESIGN.md`, `REPORT_REGISTRY_ARCHITECTURE.md`.

---

### DEC-017: Authority-Defined Computations Only
- **Decision**: System computations are supported **only** when explicitly defined in authority documents (e.g. `HDL_LDL` / `CHEM_10` formulas).
- **Why**: Prevents introducing unapproved clinical formulas or arbitrary ratio calculations.
- **Consequence**: Unapproved Friedewald LDL formulas, arbitrary VLDL, and Absolute Granulocyte counts are strictly excluded.
- **Related Authority**: `LABORATORY_TEMPLATE_SPECIFICATION.md`, `REPORT_REGISTRY_ARCHITECTURE.md`.

---

### DEC-018: Template-Specific Reagent Kit Information
- **Decision**: Diagnostic rapid test templates (`DENGUE_DUO`, `HIV_RESULT`, `HBSAG`, `RPR`, `PREG_TEST`) enforce reagent kit tracking (`requires_kit_info = TRUE`).
- **Why**: Ensures diagnostic reagent batch traceability.
- **Consequence**: Encoding forms and report outputs capture and display Kit Brand, Lot Number, and Expiration Date.
- **Related Authority**: `LABORATORY_TEMPLATE_SPECIFICATION.md`, `REPORT_REGISTRY_ARCHITECTURE.md`.

---

### DEC-019: Reference-Rule Architecture
- **Decision**: Reference rule evaluation uses deterministic strategy objects (`NumericRange`, `LessThan`, `GreaterThan`, `ExpectedValue`, `AllowedValues`, `Informational`, `NoEvaluation`).
- **Why**: Standardizes normal/abnormal evaluation without hardcoding rules inside UI components.
- **Consequence**: Evaluation outcomes trigger visual warning badges in encoding forms without altering printed report layouts.
- **Related Authority**: `REPORT_REGISTRY_ARCHITECTURE.md`, `UI_ARCHITECTURE.md`.

---

### DEC-020: Historical Signatory & Reference Snapshots
- **Decision**: Session submission freezes printed signatory details (`printed_full_name`, `printed_credentials`, `printed_prc_license_number`, `signature_image_url`) and parameter reference rules into session records.
- **Why**: Guarantees that reopening or reprinting a completed report reproduces the exact printed credentials executed at submission time, even if master records change later.
- **Consequence**: Historical report fidelity is permanently preserved without complex version history tables.
- **Related Authority**: `DOMAIN_MODEL.md`, `DATABASE_DESIGN.md`, `REPORT_RENDERING_ARCHITECTURE.md`.

---

### DEC-021: Draft Auto-Save & Recovery UX
- **Decision**: Active session encoding auto-saves transient draft state; reopening an unfinished session displays a Draft Recovery Banner.
- **Why**: Prevents accidental data loss during network disruptions or browser navigation.
- **Consequence**: Staff can seamlessly resume unfinished drafts or discard them to start fresh.
- **Related Authority**: `DOMAIN_MODEL.md`, `UI_ARCHITECTURE.md`.

---

### DEC-022: 30-Day Completed Report Retention
- **Decision**: Completed Patient Report Sessions are retained for exactly **30 days** (`expires_at = completed_at + 30 days`).
- **Why**: Fulfills the client's confirmed 30-day active record retention requirement.
- **Consequence**: Expired sessions (`expires_at < NOW()`) are purged by automated background execution mechanisms.
- **Related Authority**: `PROJECT.md`, `DOMAIN_MODEL.md`, `DATABASE_DESIGN.md`, `SECURITY_MODEL.md`.

---

### DEC-023: Replace Current Report with No Version History
- **Decision**: Reopening and editing a completed session within the 30-day window overwrites the active report record and freezes new snapshots without version branching.
- **Why**: Adheres strictly to single-record replacement semantics confirmed by the client.
- **Consequence**: Avoids unnecessary schema complexity while keeping report replacement straightforward.
- **Related Authority**: `PROJECT.md`, `DOMAIN_MODEL.md`, `DATABASE_DESIGN.md`.

---

### DEC-024: Auto-Suggestions Learned Only After Successful Completion
- **Decision**: `AutoSuggestionLearningService` extracts new Requesting Physician, Referrer, and Company names **only** upon successful session completion.
- **Why**: Prevents polluting autocomplete suggestion dictionaries with unverified or draft text.
- **Consequence**: Autocomplete choices improve organically as valid reports are completed.
- **Related Authority**: `DOMAIN_MODEL.md`, `DATABASE_DESIGN.md`, `UI_ARCHITECTURE.md`.

---

### DEC-025: Security Enforcement Beyond the UI
- **Decision**: Security controls are enforced at Server API Authorizers and PostgreSQL Row-Level Security (RLS) policies across all 10 database tables.
- **Why**: Ensures defense-in-depth even if client-side UI controls are bypassed.
- **Consequence**: Non-admin users cannot execute admin operations or access unauthorized data regardless of API payload tampering.
- **Related Authority**: `DATABASE_DESIGN.md`, `SECURITY_MODEL.md`.

---

### DEC-026: Configuration-First Extensibility for Future Templates
- **Decision**: Adding a new template using existing renderer families, input styles, and reference rules requires **only SQL `INSERT` statements**.
- **Why**: Maximizes system maintainability and future template expansion without code changes.
- **Consequence**: Zero frontend or backend code modifications required for standard template additions.
- **Related Authority**: `REPORT_REGISTRY_ARCHITECTURE.md`, `DATABASE_DESIGN.md`.

---

### DEC-027: Shared Validation & Clinical Evaluation Pipeline Architecture
- **Decision**: The system adopts the Single State Discriminator model (**Model A**), extending `EvaluationOutcome` to include `"Invalid"`.
- **Why**: Syntactic input validation must occur before clinical evaluation. Non-numeric or malformed text entered into numeric fields returns `"Invalid"` immediately and is **never** clinically evaluated against reference ranges or flagged as `ABNORMAL`.
- **Consequence**: Preserves 100% compatibility with existing domain contracts, renderer interfaces, DTOs, database schemas, and PDF generators while establishing clear visual separation between validation errors and medical findings.
- **Related Authority**: `ADR-008`, `DOMAIN_MODEL.md`, `REPORT_RENDERING_ARCHITECTURE.md`.

---

# 3. Unresolved Open Decisions

> [!WARNING]
> **OPEN POLICY DECISION 01: Completed Report Visibility & Edit Scope Across Standard Users**
> - **Status**: **Awaiting Client Confirmation**.
> - **Recorded Statement**: *"Completed Report visibility and edit scope across different users requires client confirmation."*
> - **Details**: Current authority documents establish that `Admin` users have full system-wide administrative access. However, they do not state whether standard `User` accounts may view/edit **all completed laboratory reports system-wide** or **only Patient Report Sessions they originally created**.
> - **Constraint**: To preserve requirements integrity, this scope is **NOT** inferred or hardcoded in architecture. The database RLS architecture permits either policy once client confirmation is provided.

---

# 4. Architectural Verification Matrix

| Decision ID | Decision Title | Verification against Authority Baseline | Status |
|---|---|---|---|
| **DEC-001** | Word Templates Visual Authority | Aligns 100% with `PROJECT.md` & `REPORT_RENDERING_ARCHITECTURE.md` | ✅ Verified |
| **DEC-002** | Template Spec Authority | Aligns 100% with `LABORATORY_TEMPLATE_SPECIFICATION.md` | ✅ Verified |
| **DEC-003** | Report-Centric Architecture | Aligns 100% with `PROJECT.md` & `DOMAIN_MODEL.md` | ✅ Verified |
| **DEC-004** | Patient Report Session Aggregate | Aligns 100% with frozen `DOMAIN_MODEL.md` | ✅ Verified |
| **DEC-005** | Shared Patient Demographics | Aligns 100% with frozen `DOMAIN_MODEL.md` & `UI_ARCHITECTURE.md` | ✅ Verified |
| **DEC-006** | Configuration-Driven Registry | Aligns 100% with frozen `REPORT_REGISTRY_ARCHITECTURE.md` | ✅ Verified |
| **DEC-007** | Renderer Family Architecture | Aligns 100% with frozen `REPORT_REGISTRY_ARCHITECTURE.md` | ✅ Verified |
| **DEC-008** | Shared Rendering Engine | Aligns 100% with frozen `REPORT_RENDERING_ARCHITECTURE.md` | ✅ Verified |
| **DEC-009** | 1 Test = 1 Physical A4 Page | Aligns 100% with frozen `REPORT_RENDERING_ARCHITECTURE.md` | ✅ Verified |
| **DEC-010** | Dual Branding Separation | Aligns 100% with frozen `UI_ARCHITECTURE.md` | ✅ Verified |
| **DEC-011** | Auth User vs Personnel Decoupling | Aligns 100% with frozen `DOMAIN_MODEL.md` & `SECURITY_MODEL.md` | ✅ Verified |
| **DEC-012** | Supabase Auth Ownership | Aligns 100% with frozen `DATABASE_DESIGN.md` & `SECURITY_MODEL.md` | ✅ Verified |
| **DEC-013** | Personnel Signatory Model | Aligns 100% with frozen `DOMAIN_MODEL.md` & `SECURITY_MODEL.md` | ✅ Verified |
| **DEC-014** | Template Signatory Requirements | Aligns 100% with `LABORATORY_TEMPLATE_SPECIFICATION.md` | ✅ Verified |
| **DEC-015** | Metadata Input Controls | Aligns 100% with frozen `REPORT_REGISTRY_ARCHITECTURE.md` | ✅ Verified |
| **DEC-016** | Selectable Parameters | Aligns 100% with frozen `DOMAIN_MODEL.md` & `DATABASE_DESIGN.md` | ✅ Verified |
| **DEC-017** | Authority-Defined Computations | Aligns 100% with `LABORATORY_TEMPLATE_SPECIFICATION.md` | ✅ Verified |
| **DEC-018** | Reagent Kit Information | Aligns 100% with `LABORATORY_TEMPLATE_SPECIFICATION.md` | ✅ Verified |
| **DEC-019** | Reference Rule Architecture | Aligns 100% with frozen `REPORT_REGISTRY_ARCHITECTURE.md` | ✅ Verified |
| **DEC-020** | Historical Snapshots | Aligns 100% with frozen `DATABASE_DESIGN.md` & `DOMAIN_MODEL.md` | ✅ Verified |
| **DEC-021** | Draft Auto-Save UX | Aligns 100% with frozen `UI_ARCHITECTURE.md` & `DOMAIN_MODEL.md` | ✅ Verified |
| **DEC-022** | 30-Day Retention | Aligns 100% with `PROJECT.md` & frozen `DATABASE_DESIGN.md` | ✅ Verified |
| **DEC-023** | Replace Current Report | Aligns 100% with `PROJECT.md` & frozen `DOMAIN_MODEL.md` | ✅ Verified |
| **DEC-024** | Completion Auto-Suggestions | Aligns 100% with frozen `DOMAIN_MODEL.md` | ✅ Verified |
| **DEC-025** | Defense-in-Depth Security | Aligns 100% with frozen `SECURITY_MODEL.md` | ✅ Verified |
| **DEC-026** | Configuration-First Expansion | Aligns 100% with frozen `REPORT_REGISTRY_ARCHITECTURE.md` | ✅ Verified |
| **DEC-027** | Shared Validation & Clinical Evaluation Pipeline | Single State Discriminator (`EvaluationOutcome` including `Invalid`); syntactic validation precedes clinical reference evaluation | ✅ Verified |
| **OPEN-01** | Standard User Report Visibility | Recorded as explicit open decision awaiting client confirmation | ⚠️ Recorded |
