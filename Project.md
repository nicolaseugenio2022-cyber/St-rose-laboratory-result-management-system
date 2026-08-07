# PROJECT.md

# Project

**St. Rose Laboratory Result Management System**

---

# Current Phase

Phase 0 — Technical and Architecture Validation

## Active Milestone
**P0.0 — Project Foundation**

---

# Milestone Exit Criteria & Operational Rules

A milestone is considered complete **only** when:
1. All milestone acceptance criteria pass.
2. TypeScript compiles without errors (`npx tsc --noEmit`).
3. ESLint passes (`npm run lint`).
4. Manual verification checklist passes.
5. The architecture for that milestone is frozen.
6. **No functionality from future milestones is implemented prematurely.**

---

# Roadmap Architecture

## Phase 0 — Technical and Architecture Validation [CURRENT PHASE]
*Purpose: Eliminate rendering risks (template reproduction, A4 page boundaries, multi-page layout, browser print, Vercel PDF generation, single Report Engine reuse) using static mock data.*

- [ ] **P0.0 — Project Foundation** *(ACTIVE MILESTONE)*: Initialize production project structure, Next.js (App Router), TypeScript, Tailwind CSS, ESLint, global CSS, basic A4 print baseline, shared type folders, and Report Engine folder structure.
- [ ] **P0.1 — CBC Tabular Renderer**: Add CBC renderer and validate tabular layout family using static mock data.
- [ ] **P0.2 — Urinalysis Diagnostic Grid Renderer**: Add Urinalysis renderer and validate 2-column diagnostic grid layout family using static mock data.
- [ ] **P0.3 — HIV Narrative Certificate Renderer**: Add HIV Result Form renderer and validate narrative certificate layout, reagent metadata block, and dual Medical Technologist signatories (**Performed By** & **Verified By**).
- [ ] **P0.4 — Preview, Browser Print, and Vercel PDF Validation**: Validate single-source `<SingleSourceReport />` engine across Preview modal, Browser Print (`@media print`), and serverless PDF export (`puppeteer-core` + `@sparticuz/chromium`).

---

## Production Application Roadmap [FUTURE WORK]
*Commences after Phase 0 is approved. Production application development is executed in separate, sequential milestones:*

- [ ] **App Milestone 1 — Production Foundation:** App Router project structure, module boundaries, shared types/validation, logo-based UI design system, production Report Registry, ADRs, env configs.
- [ ] **App Milestone 2 — Backend and Data Foundation:** Supabase integration, PostgreSQL DDL migrations, Auth, Admin/User roles, RLS policies, Personnel records, Private Pathologist signature storage, test template/parameter data strategy, reference-rule model, seed data review.
- [ ] **App Milestone 3 — Domain and Server Logic:** Patient Report Session rules, multi-test session behavior, template-specific signatory validation, selected-examination persistence, abnormal-result evaluation, auto-suggestion server logic, Completed Report History, 30-day cleanup, server-side validation/auth.
- [ ] **App Milestone 4 — Interactive Application UI:** Patient demographic form, Add Laboratory Test dialog, searchable Report Registry picker, lab test tabs/cards, dynamic result-entry forms, Select All & individual checkboxes, warning indicators, personnel selectors, per-test Remarks input.
- [ ] **App Milestone 5 — Report Engine Integration:** Connect production session data to validated Report Engine, multi-page preview, 1 A4 page per test, browser print, multi-page PDF generation, Pathologist signature rendering.
- [ ] **App Milestone 6 — Recovery and History:** Draft Auto-Save & Session Recovery, 30-day Completed Report History, Replace Current Report editing model, reprinting & PDF regeneration, auto-suggestion recording, automatic expiration & cleanup.
- [ ] **App Milestone 7 — Production Hardening:** Security review, performance testing, accessibility review, error handling, monitoring/logging, Vercel deployment validation, Supabase production policy review, client acceptance testing.

---

# Technology Stack

## Framework

- Next.js (App Router)
- React
- TypeScript

## UI

- shadcn/ui
- Tailwind CSS

## Backend Services (Future Work - App Milestone 2 & 7)

- Supabase PostgreSQL
- Supabase Auth
- Supabase Storage (Private)

## Deployment

- Vercel

---

# Confirmed User Roles (Target Specification)

## Admin
- Manage users (Create, update, deactivate)
- Manage Pathologist records (Full Name, PRC License Number, optional PNG signature)
- Manage Medical Technologist records (Full Name, PRC License Number, credentials)

## User
- Encode patient demographic information once per session
- Add laboratory test templates to a Patient Report Session
- Select examination rows per test template
- Encode laboratory test results
- Select Pathologist and Medical Technologist(s)
- Preview multi-page laboratory reports
- Generate PDF & Print reports
- Access 30-day Completed Report History for reprinting/editing

---

# Confirmed Functional Requirements & Architecture

## Multi-Test Patient Report Session Architecture
- System is centered around a **Patient Report Session** (`REPORT_SESSION` parent transaction holding 1-to-many `LAB_REPORT` child entries).
- Patient demographics are encoded **once** per session.

## Remarks Per Laboratory Test
- Remarks belong to an individual `lab_report` (`lab_reports.remarks`), **not** to the parent `report_session`.
- Each selected test maintains its own independent Remarks value.
- Restored by Draft Auto-Save & stored in Completed Report History.
- Appears in Preview, Print, and PDF **only in the proper location defined by that test's official template** (never combined across tests).
- Treated as optional unless client explicitly confirms required.

## Auto-Suggestion Case-Insensitive Composite Uniqueness
- `field_suggestions` contains `id`, `field_name`, `value`, `normalized_value`, `use_count`, `last_used_at`.
- Constraint: `UNIQUE (field_name, normalized_value)`. Original display value preserved, normalized value used for deduplication.

## Output Fidelity & Page Boundaries
- Preview, Browser Print, and PDF generation must use the same report component structure and maintain consistent A4 page boundaries, content, styling, colors, and signature placement.
- Each selected laboratory test template generates its own standalone A4 report page (e.g., Page 1: CBC).
- No single page may contain multiple different laboratory test templates.

## Pathologist Electronic Signature Behavior
- Optional PNG upload stored in Private Supabase Storage (`pathologist-signatures`).
- When uploaded: Displays automatically above printed name, preserving transparency and aspect ratio without distortion.
- When NOT uploaded: Renders report without signature graphic while still displaying Pathologist name, title (`MD, DPSP`), and license number in template position. Fake handwritten text substitutes are prohibited.

## Template Preservation Philosophy
- Official laboratory documents follow official templates in `Templates/`.
- Faithful reproduction of layout, colors, typography, tables, borders, margins, and signature placement without modernizing redesign or color normalization.

## Decoupled Application UI Theme & Laboratory Report Rendering
- Application UI theme and branding are completely independent from laboratory report rendering.
- Application UI branding follows official St. Rose Diagnostic Laboratory color branding (flexible implementation without embedding logo assets until official logo file is provided).
- Laboratory reports must faithfully reproduce official Microsoft Word templates.
- Each laboratory template remains the authoritative source for its own layout, typography, colors, borders, spacing, labels, and signature placement.
- Future changes to the application theme must never affect Preview, Print, or PDF output.

## Official Application Branding Guidelines & Design Tokens
1. **Centralized Branding Location**:
   - Application branding is defined in `src/app/globals.css` using CSS Custom Properties (`:root` variables) and mapped into Tailwind CSS (`tailwind.config.ts`).
2. **Semantic Design Tokens**:
   - `--color-primary` / `--color-primary-hover` / `--color-primary-foreground`: Primary interactive brand color (Medical Emerald).
   - `--color-secondary` / `--color-secondary-hover` / `--color-secondary-foreground`: Dark neutral accent color.
   - `--color-background` / `--color-surface` / `--color-surface-hover`: Viewport, card/modal panel surfaces, and interactive hover backgrounds.
   - `--color-border` / `--color-border-subtle`: Structural boundaries and interior dividers.
   - `--color-text` / `--color-text-muted` / `--color-text-subtle`: High-legibility typography hierarchy.
   - `--color-success` / `--color-warning` / `--color-danger` / `--color-info`: Semantic account and system state indicators.
   - `--color-sidebar` / `--color-sidebar-active` / `--color-sidebar-active-text` / `--color-sidebar-text`: Navigation drawer states.
   - `--color-card` / `--color-card-border`: Container card styling.
   - `--color-focus-ring`: Accessibility focus outline indicator.
3. **Updating Future Client Branding**:
   - When official logo assets and brand guidelines arrive, update ONLY the hex values in `src/app/globals.css`. Do NOT edit individual component CSS or markup.
4. **Architectural Isolation**:
   - Application theme tokens apply ONLY to web application UI components (AppShell, Dashboard, User Management). Laboratory report rendering components consume template-specific styling and remain 100% independent.

---

# Current Objective (Active Milestone: P0.0)

Establish **P0.0 — Project Foundation**:
1. Initialize Next.js (App Router), TypeScript, Tailwind CSS, ESLint.
2. Establish clean project folder structure (`src/app/`, `src/components/report-engine/`, `src/types/`, `public/`).
3. Define global CSS and basic A4 print baseline rules (`@page`, `@media print`).
4. Establish shared type definitions and Report Engine directory structure.
5. Zero report rendering, zero business logic, zero mock report data, zero Supabase, zero authentication.