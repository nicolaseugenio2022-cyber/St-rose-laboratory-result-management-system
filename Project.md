# PROJECT.md

# St. Rose Laboratory Result Management System

---

# Project Vision

The St. Rose Laboratory Result Management System is a web-based application that digitizes the laboratory report preparation workflow of St. Rose Diagnostic Laboratory.

The application replaces the Microsoft Word-based preparation workflow with a secure, centralized system. The printable laboratory report remains the primary product of the system.

Existing approved laboratory templates and specifications remain authoritative for clinical content, terminology, parameters, reference and evaluation rules, report-specific behavior, omissions, signatory requirements, and validated laboratory workflow. The Native Report Engine may modernize visual presentation as long as it never changes clinical meaning or validated workflow. Pixel-for-pixel reproduction of the historical Word appearance is not required.

The application UI and printable report documents are separate presentation concerns. Both use St. Rose branding, but application-interface styling does not determine report-document layout.

---

# Current Project Status

## Completed and Frozen Foundation

**Milestone 1 — Production Foundation:** Complete and frozen.

The repository contains the domain and workflow implementation covered by passing B1–B5 verification: the 17-report declarative registry, Encoding integration, definition-driven validation and evaluation, and immutable completed-report snapshots.

## Active Phase

**Phase C — Native Report Rendering**

Implemented checkpoints:

- C0 — render ownership and architecture audit
- C1 — shared resolved render model and draft/completed adapters (verified)
- C2 — standard declarative report composition (verified)
- C3 — HIV and Urinalysis specialized declarative composition (verified)
- C4 — Native Live Preview integration for all 17 reports (verified)
- C4.1/C4.2 — visual-system, scale, runtime layout, and spacing refinements (verified)
- Manual C4 visual approval granted; Native approved as the sole production Live Preview renderer
- Post-C4 Native-only Live Preview cleanup: the Experimental and Legacy HTML preview paths removed from Live Preview
- C5.1 — session-level multi-page Native PDF export sharing the Live Preview composition (verified)
- C5.2 — manual Preview/PDF parity approval granted
- C5.3 — transitional legacy PDF infrastructure removed (verified); manually approved

Automated C1, C2, C3, C4, C4.1, C4.2, and C5 verification currently passes. C4, C5.2, and C5.3 have received manual approval.

**Phase C is complete and frozen.** See Milestone 4 for the freeze scope.

## Current Focus

Phase C is closed. Preview, Print, and PDF resolve through one authoritative Native composition.

Remaining project work is tracked under Milestone 5 (Drafts and History) and Milestone 6 (Production Hardening).

---

# Authority Documents and Sources

Authority is separated by concern.

## PROJECT.md

Defines:

- Project vision
- Confirmed system-wide architecture
- Development status and roadmap
- Cross-report rendering policy
- System-wide business and implementation decisions

## Report Specifications

`architecture/report-specifications/` and the approved normalized specification set define:

- Clinical content and terminology
- Parameters and ordering
- Reference and evaluation rules
- Input controls and validation
- Computations
- Remarks and reagent-kit behavior
- Requested By and demographic policies
- Signatory requirements
- Report-specific omissions and conditional behavior
- Versioned static report content

`LABORATORY_TEMPLATE_SPECIFICATION.md` is the index and authority map for the 17 report specifications. Detailed behavior belongs in the individual specification documents rather than being duplicated here.

## Original Templates and Render References

Original DOCX templates and approved render references remain evidence for validated report content and report-specific requirements when normalized specifications are missing or genuinely ambiguous. They are not production artwork and do not require the Native Report Engine to reproduce historical formatting pixel-for-pixel.

## AGENTS.md

Defines AI development workflow, scope control, decision handling, and repository operating rules.

## Repository Source Code

Represents the currently implemented behavior. If documentation and implementation disagree, the conflict must be investigated rather than silently resolved.

---

# Development Principles

- Architecture First
- Milestone-Based Development
- Configuration Over Hardcoding
- Declarative Report Definitions
- Report-Centric Architecture
- Clinical and Workflow Fidelity
- Source-Neutral Rendering
- Immutable Completed Reports
- Production-Ready Code
- No Premature Features

Visual modernization is permitted for report documents. It must remain restrained, professional, print-oriented, and clinically neutral.

---

# Milestone Completion Rules

A milestone or checkpoint is complete only when its approved acceptance criteria pass. Depending on scope, this includes:

1. Focused regression verification.
2. TypeScript compilation.
3. ESLint with zero errors.
4. Production build success.
5. Required manual verification or client approval.
6. Architecture freeze when explicitly approved.
7. No unauthorized work from a later checkpoint.

Automated verification does not substitute for required manual visual approval.

---

# Development Roadmap and History

## ✅ Milestone 1 — Production Foundation (Complete and Frozen)

Implemented:

- Next.js App Router, React, TypeScript, Tailwind CSS, and ESLint
- Shared domain types and validation foundations
- Service abstractions
- Application shell, navigation, branding, and reusable UI components
- Authentication and user-management foundation
- Dashboard and administrative foundation

## Milestone 2 — Laboratory Domain Foundation

The domain foundation required by the current application has been implemented through Phase B, including:

- Patient Report Session domain
- Exactly 17 declarative clinical report definitions
- Report Registry and parameter specifications
- Reference and evaluation policies
- Report-scoped demographic and Requested By policies
- Signatory configuration
- Chemistry computed-result policies
- Versioned render-contract metadata

This records completed subsequent work; it does not rewrite Milestone 1 history.

## Milestone 3 — Laboratory Workflow

Implemented in source and covered by passing B1–B5 verification:

- Definition-driven Encoding for all 17 reports
- Shared demographic handling
- Result controls, suffixes, conditional fields, and repeatable findings
- Definition-driven immediate evaluation
- Completion validation
- Saveable incomplete drafts
- Frozen completed-session/report snapshots
- Legacy draft and completed-report compatibility

## Milestone 4 — Report Engine (Complete and Frozen)

Implemented:

- Source-neutral resolved render model
- Draft adapter using current session state
- Completed adapter using frozen completed snapshots without clinical recomputation
- Versioned static render contracts
- Native millimetre-based primitives and flow composition
- Four declarative layout families
- Native Live Preview production routing for all 17 reports
- True A4 preview geometry and selectable native text
- Actionable upper-half overflow enforcement
- Manual C4 visual approval; Native confirmed as the sole production Live Preview renderer
- Removal of the Experimental and Legacy HTML comparison preview paths
- Session-level multi-page Native PDF export emitting one A4 page per report in session order
- Manual C5.2 Preview/PDF parity approval
- Removal of the transitional legacy PDF infrastructure

Milestone 4 is complete. No Report Engine work remains outstanding.

### Report Engine Architecture Freeze

The Report Engine architecture is frozen. The following invariant is authoritative:

`Preview + Print + PDF → one authoritative resolved rendering model and Native composition engine`

Future milestones may integrate with the Report Engine and fix defects in it. Without explicit
approval they must not:

- Redesign the Report Engine architecture
- Introduce a second report-composition path
- Restore retired Legacy or Experimental rendering infrastructure

## Milestone 5 — Drafts and History

Draft persistence, completed snapshots, history, and re-rendering foundations exist as supporting application work.

Approved scope:

- Completed-report replacement correction: reopen in Replacement Mode, re-completion producing a new frozen snapshot, atomic database replacement, immutable retention anchor
- Personnel Directory: Admin-managed Pathologist and Medical Technologist records feeding the Workspace signatory dropdowns
- Draft autosave with accidental-refresh protection
- Completed History persistence and system-wide visibility within the retention policy

## Milestone 6 — Production Hardening

Pending:

- Security hardening:
  - Migration-state preflight and schema provisioning
  - Application-owned authentication with irreversible credential storage
  - Canonical username semantics
  - Server-only protected data access; removal of browser-direct database access
  - Developer least-privilege boundary
  - One-time protected Developer bootstrap
  - Persistent, database-enforced append-only audit logging
  - Self-service password recovery based on username and the configured security question
- Performance validation
- Accessibility validation
- Monitoring
- Deployment validation
- Client acceptance testing

---

# Technology Stack

## Application

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- shadcn-style reusable UI components

## Data and Infrastructure

- Application-owned authentication: username and password with salted one-way scrypt hashing; no email or phone identifier is collected
- Server-verified application session cookies
- Supabase PostgreSQL, accessed from server code only; browser clients do not query protected tables directly
- Supabase Storage, including personnel signature assets, served through authenticated server endpoints
- Repository/service abstractions, with some development services retaining local or in-memory behavior

## Report Rendering

- Native millimetre-based resolved composition model
- Browser-native selectable text for Live Preview
- jsPDF native primitives render the production PDF export directly from the resolved composition
- PDF export emits one A4 page per report as selectable vector text, with no DOM rasterization
- `html2canvas` is no longer used by the application; it remains only as an unused optional transitive dependency of jsPDF

## Deployment Target

- Vercel

---

# User Roles

## Administrator

Responsible for:

- User Management
- Personnel Management
- Report Registry Management
- Optional Pathologist signature management
- System Configuration

## Developer

Responsible for:

- System health monitoring
- Database health and status
- Diagnostics and technical maintenance information
- Audit and technical information review

Developer is an authentication role. It holds no routine operational or administrative write privileges and no routine patient or report access.

## Laboratory User

Responsible for:

- Patient Report Sessions
- Laboratory Result Encoding
- Personnel Selection
- Report Preview
- Printing and export workflows
- Draft and completed report management

---

# Confirmed Architecture

## Report-Centric Architecture

The laboratory report is the primary product of the system. Architecture must preserve clinical meaning, validated workflow, and finalized report data while allowing an approved professional visual presentation.

## Patient Report Session

One Patient Report Session represents one laboratory visit. Shared demographics are entered once and used by selected reports according to each report's declarative policy.

Patient Status is not collected or required by Encoding. CBC retains its declared static printed `Status` label without a dynamic patient-status value.

## Authentication and Personnel

Authentication users are independent from laboratory personnel. Authentication controls system access; personnel records supply report signatory identity.

Supported personnel roles include Pathologist and Medical Technologist, with report-specific semantic slots such as HIV Examiner and Verifier.

Authentication roles are Admin, User, and Developer. Personnel classifications are Pathologist and Medical Technologist. Pathologist and Medical Technologist are never authentication roles, and authentication roles never confer signatory authority.

Account creation collects username, password, and a security question. The account holder sets the recovery answer during first-login setup, so the administrator never knows it. Password recovery is username and security-question based. No email address or phone number is collected.

## Data Access Boundary

Protected application data is accessed only from server code. Client components call server actions or route handlers, which verify the application session, resolve the caller's role, and enforce authorization before any database operation. Browser clients hold no database credentials or privileges. Database grants and row-level policies provide defense against unauthorized direct access; they are not the per-user authorization mechanism.

Verification of this boundary uses two distinct checks. Schema availability is verified through the authorized server path. Denial of browser access is verified separately using the browser/anon credential, where any successful read of a protected table is a security failure.

## Declarative Report Registry

The Report Registry contains exactly 17 authoritative report definitions. It determines:

- Renderer/layout family
- Parameters and ordering
- Input controls and selection behavior
- Reference and evaluation rules
- Computed-result policy
- Requested By and demographic behavior
- Remarks, kit information, and repeatable findings
- Signatory slots and ordering
- Static-content and render-contract versions
- Conditional omission behavior

Generic Encoding and rendering infrastructure must not contain report-code if/else chains for presentation behavior. Report-specific behavior belongs in declarative definitions and versioned contracts.

## Completed Snapshot Authority

Draft rendering may resolve current Encoding state through approved domain resolvers.

Completed reports render from frozen completed snapshots. Frozen formatted values, reference displays, evaluation outcomes, computations, demographics, Requested By values, remarks, kit information, findings, and signatory identities are output-authoritative and must not be clinically recomputed from current definitions.

Snapshot v2 freezes `renderContractVersion`, `printedTitle`, and `staticContentVersion`. Legacy snapshot v1 remains readable under its documented compatibility policy.

Replacement within the retention window does not weaken this authority. A completed report is replaced only by re-completion, which composes a new frozen snapshot through the normal completion rules and atomically replaces the current one. Frozen snapshots are never mutated in place, the retention anchor is never restarted, and render-time clinical recomputation remains forbidden.

## Shared Resolved Render Model

The production Native rendering paths are:

`Live Preview: SharedRenderingEngine → resolveSessionRenderModel → NativeLivePreviewPage → live-preview-composer → layout-family composer → native primitives`

`PDF export: SharedRenderingEngine → resolveSessionRenderModel → createNativeSessionPdf → live-preview-composer → layout-family composer → native primitives → jsPDF`

Both paths consume the identical composed page. PDF export must never introduce a second composition path.

The composer consumes the source-neutral resolved model and declarative physical metadata. It does not own formulas, clinical evaluation, mutable session behavior, or reference resolution.

## Native Layout Families

All 17 reports resolve through four production layout families:

- `StandardAdaptiveTabular` — 6 reports
- `CompactResultGrid` — 9 reports
- `MicroscopyTwoColumn` — 1 report
- `Certificate` — 1 report

CBC has one production native path: `StandardAdaptiveTabular`. The obsolete CBC-only native pilot has been removed from the repository.

## Native Live Preview Geometry

- One A4 portrait page per report: `210 × 297 mm`
- Approximately `15 mm` side margins
- One preview scale owner
- `100%` preview equals native scale `1`
- `75%` preview equals native scale `0.75`
- The A4 page is never horizontally compressed; a narrow viewport scrolls
- Exactly one selected Native page is visibly mounted in normal Live Preview
- Actual report content must remain at or above `148.5 mm`
- Variable content flows naturally without stretching sparse reports
- Overflow fails with an actionable composition error rather than clipping or spilling into the lower half
- No page numbers
- Report titles render only when declared

## Native Visual Direction

The approved Native report direction is modern, restrained, professional, and print-oriented, using the St. Rose teal visual language.

It should avoid:

- Historical spreadsheet-style presentation
- Obsolete purple/lavender CBC pilot styling
- Unnecessary decorative cards
- Excessive whitespace
- Visual treatments that imply unapproved clinical meaning

Visual modernization must never alter content, terminology, values, references, computations, omissions, or signatory policy.

## Results, References, Units, and Suffixes

For `StandardAdaptiveTabular`, the declared presentation is:

`EXAMINATION | RESULT | NORMAL VALUES`

`CompactResultGrid` retains its declarative headings, currently `TEST | RESULT | REFERENCE VALUES` by default.

Across native layouts:

- `formattedValue` owns the printed result
- `referenceDisplay` owns the printed normal/reference value
- `unitDisplay` does not create a fourth visual pseudo-column
- Fixed suffixes such as `%` and `/HPF` render exactly once
- Conditional and optional omitted rows reserve no output space
- Repeatable findings render only populated entries in resolved order
- CBC does not render abnormal indicators or abnormal-driven styling

## Signatory and Signature Policy

- Pathologist textual identity always renders when applicable
- A Pathologist signature image is optional
- Missing, blank, malformed, inaccessible, or load-failed Pathologist signatures degrade to a blank image area without blocking rendering
- No fallback or invented signature is permitted
- Medical Technologists are textual only; no Medical Technologist signature image primitive is created
- Standard signatory order is Pathologist followed by Medical Technologist
- HIV signatory order is Examiner → Verifier → Pathologist

## Assets

- Canonical report logo: `/st-rose-logo-official.png`
- The logo is a required native report asset
- Optional signatures use omission-on-failure behavior
- Historical DOCX/PNG references are not production report backgrounds

## Preview, Print, and PDF Architecture

The target principle is realized:

`Preview + Print + PDF → one authoritative resolved rendering model and Native composition engine`

Current condition:

- Native Live Preview is the sole production renderer for all 17 reports
- There is no user-selectable renderer mode
- PDF export composes through the same Native composition as Live Preview, emitting one A4 page per report in session order
- Browser Print uses the application print workflow over the Native Live Preview output
- The experimental Template Engine preview path has been removed
- The legacy HTML rendering infrastructure and its rasterized PDF route have been removed

Native PDF migration is complete: C5.1 implemented and verified, C5.2 parity manually approved, C5.3 legacy removal verified and manually approved.

## Future Extensibility

Adding a report should primarily require:

- Registering one declarative clinical report definition
- Defining its versioned render metadata and static content where applicable
- Selecting an existing layout family or adding a genuinely reusable family

Generic rendering infrastructure should not require report-code-specific presentation branches.

---

# Current Objective

Phase C is complete. Preview, Print, and PDF resolve through one authoritative Native composition model, verified by automated checkpoints C1–C5 and approved by manual C4, C5.2, and C5.3 review.

Remaining project work is tracked under Milestone 5 (Drafts and History) and Milestone 6 (Production Hardening).
