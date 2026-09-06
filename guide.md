# St. Rose System Rebuild — Legacy Reference Guide

## Purpose

This document is the entry point for an AI implementing the new application in the sibling folder:

`../St-Rose-System/`

The repository containing this file is the **legacy reference system**:

`../St-rose-laboratory-result-management-system/`

Use the legacy repository to discover existing behavior, clinical rules, security boundaries, data
contracts, and report-output behavior. Build the new application in `St-Rose-System`. Do not turn the
new application into a runtime wrapper around the legacy folder, and do not modify the legacy source
while implementing the replacement.

This guide is a navigation aid, not a new authority document. It does not replace `AGENTS.md`,
`Project.md`, the approved architecture documents, the clinical specifications, or observed runtime
behavior.

## Repository roles

| Folder | Role | Normal treatment |
|---|---|---|
| `St-rose-laboratory-result-management-system` | Legacy system and evidence source | Read-only during the rebuild, except for an explicitly requested documentation update |
| `St-Rose-System` | New implementation | All new application code, tests, configuration, and target-specific documentation belong here |

The target currently starts clean. Do **not** assume that a milestone marked complete in the legacy
repository is complete in the new repository. Re-establish every target phase with its own evidence.

The legacy `AGENTS.md` governs work performed in the legacy repository. It does not automatically
become the operating authority of the sibling target repository. Read and obey any `AGENTS.md` or
other local instructions created in `St-Rose-System` before editing there.

## Legacy revision inspected for this guide

Recorded on 2026-09-06:

- Current legacy branch: `review/clinic-ui-ux-04a`
- Current legacy `HEAD`: `d24964256714d9e51189c16dd1348cabe4f828c2`
- Published legacy `origin/main`: `dedd19579d1a088888521fe93b680d692884e6c5`
- Ahead/behind relative to `origin/main`: `3/0`
- `St-Rose-System` contained no files at inspection time.

The three commits above `origin/main` are the unmerged 04A focused-clinical-desk work:

1. `1b95585 feat(workspace): introduce focused clinical desk`
2. `65d1980 fix(workspace): restore focus to the docked queue when the drawer retires`
3. `d249642 fix(workspace): restore orphaned focus on the already-retired drawer path`

Therefore:

- Use `origin/main` when inspecting the last merged legacy baseline.
- Inspect `review/clinic-ui-ux-04a` when studying the newer focused Workspace frame, catalog, queue,
  progress signals, responsive drawer, and loading layout.
- Never silently describe branch-only behavior as published behavior.
- Before implementing a target slice, record the exact legacy SHA used as evidence.

## Start every target phase this way

1. Read the target repository's local instructions first.
2. Read this guide.
3. Record target `HEAD`, branch, upstream, ahead/behind count, and every working-tree entry.
4. Record the legacy SHA or branch being consulted.
5. Freeze one bounded phase. Do not attempt the whole system in one change.
6. Make a small evidence table for the phase:
   - user requirement;
   - authoritative legacy document;
   - current legacy source/runtime evidence;
   - target behavior to preserve or intentionally redesign;
   - verification method.
7. Report documentation/runtime conflicts instead of choosing whichever is easier to implement.
8. Keep the legacy repository out of the target's build graph. No cross-repository imports,
   symlinks, runtime reads, or production dependencies.
9. Copy no secret values. In particular, do not inspect, print, commit, or transfer `.env.local`.

## Authority and reading discipline

When studying the legacy system, begin with:

1. `AGENTS.md` — legacy process, scope, verification, security-preservation, Git, and publication
   rules.
2. `architecture/README.md` — the single router to the minimum applicable architecture documents.
3. `Project.md` — legacy project vision, state, milestones, and confirmed system-wide decisions.
4. `README.md` — codebase orientation only; verify its claims against current source.

Authority is separated by concern. Do not flatten it into one universal precedence list:

| Concern | Legacy source to consult |
|---|---|
| Current implemented behavior | Current source and a running legacy application |
| Client-reported requirements | `architecture/report-specifications/Summary.md` |
| Exact clinical/report behavior | `LABORATORY_TEMPLATE_SPECIFICATION.md` and `architecture/specifications/<TEMPLATE_CODE>.md` |
| UI behavior | `architecture/UI_ARCHITECTURE.md`, then current route/component source |
| Authentication, authorization, privacy, audit | `architecture/SECURITY_MODEL.md` and applicable ADRs |
| Schema, persistence, RLS | Ordered files in `supabase/migrations/`, then `architecture/DATABASE_DESIGN.md` |
| Registry metadata and form behavior | `architecture/REPORT_REGISTRY_ARCHITECTURE.md` and `src/domain/definitions/` |
| Preview, Print, and PDF | `architecture/REPORT_RENDERING_ARCHITECTURE.md`, `architecture/specifications/RENDERING_RULES.md`, and `architecture/PDF_VALIDATION_CHECKLIST.md` |
| Domain lifecycle and invariants | `architecture/DOMAIN_MODEL.md` and `src/domain/` |
| Architectural decisions | `architecture/DECISIONS.md` and the applicable `architecture/ADR/` record |
| Historical completed output | The frozen completed snapshot itself |

Documentation explains intended behavior. Source/runtime shows current behavior. If they differ,
record a conflict; neither category silently cancels the other.

The user-approved target brief and target roadmap govern what should be redesigned in
`St-Rose-System`. Legacy visual choices are evidence, not automatic target requirements. Clinical
meaning, security controls, permissions, retention, snapshot semantics, and report-output contracts
remain preserved unless the user explicitly approves a change through the proper phase.

## Fast source map

### Application routes

| Route | Primary legacy source |
|---|---|
| `/` | `src/app/page.tsx` |
| `/login` | `src/app/login/`, `src/app/_components/AuthShell.tsx` |
| `/forgot-password` | `src/app/forgot-password/`, `src/features/auth/forgotPasswordActions.ts` |
| `/first-login/password` | `src/app/first-login/password/`, `src/app/first-login/_components/FirstLoginForm.tsx` |
| `/first-login/recovery` | `src/app/first-login/recovery/`, `src/app/first-login/_components/FirstLoginForm.tsx` |
| `/dashboard` | `src/app/(app)/dashboard/` |
| `/workspace` | `src/app/(dashboard)/workspace/` |
| `/history` | `src/app/(app)/history/` |
| `/audit` | `src/app/(app)/audit/` |
| `/users` | `src/app/(app)/users/` |
| `/developer/accounts` | `src/app/(app)/developer/accounts/` |
| `/personnel` | `src/app/(app)/personnel/` |

### Main layers

| Path | What to learn from it |
|---|---|
| `src/app/` | Route composition, server/client boundaries, loading/error states, and route-local UI |
| `src/app/(app)/_components/` | General authenticated shell, header, sidebar, page container, and mobile drawer |
| `src/app/(dashboard)/_components/` | Workspace-specific shell, compact rail, drawer, and unsaved-navigation guard |
| `src/components/shadcn/` | Current shared shadcn primitives |
| `src/components/ui/` | Older shared UI primitives still used by the application |
| `src/config/navigation.ts` | Current role-aware navigation destinations and labels |
| `src/config/roles.ts` | Presentation labels for authentication roles |
| `src/domain/` | Aggregates, report definitions, calculations, evaluation policy, and completion snapshots |
| `src/features/server-boundary/` | Server actions, input validation, authorization calls, safe transport shapes, and audit emission |
| `src/lib/` | Sessions, password hashing, guards, Supabase clients, rate limits, validation, and safe errors |
| `src/repositories/` | Supabase persistence implementations |
| `src/services/` | Registry, users, audit, evaluation, suggestions, dashboard health, and application services |
| `src/rendering/` | Resolved render model, Native A4 composition, Live Preview, Print, and PDF |
| `supabase/migrations/` | Intended database evolution in timestamp/order sequence |
| `scripts/` | Durable regression and boundary verifiers |

## Current role and route behavior

Treat navigation visibility as presentation only. Reproduce authorization at the server boundary.

| Capability | Admin | Laboratory User (`User`) | Developer | Primary evidence |
|---|---:|---:|---:|---|
| Dashboard | Yes | Yes | Yes, with technical monitoring composition | dashboard route and compositions |
| Workspace and clinical mutations | Yes | Yes | No | `navigation.ts`, `requireOperationalCaller()` in `server-actions.ts` |
| Completed History | Yes, system-wide | Yes, system-wide | No routine access | `SECURITY_MODEL.md` §6 and `server-actions.ts` |
| Audit Logs | Yes, filtered to preserve Developer confidentiality | No | Yes | `audit-read-service.ts`, `audit-actions.ts` |
| Ordinary-account directory | Full authorized view | No | Restricted `username`/`role`/`status` projection | `/users`, `ordinary-account-guard.ts` |
| Ordinary-account writes/password reset | Yes | No | No | `ordinary-account-guard.ts`, `user-account-actions.ts` |
| Developer-account management | No | No | Yes, with last-active/current-account safeguards | `developer-guard.ts`, `developer-account-actions.ts` |
| Personnel directory read | Yes | No | Yes | `personnel-guard.ts`, `personnel-actions.ts` |
| Personnel/signature writes | Yes | No | No | `requirePersonnelAdmin()`, personnel signature actions |

Authentication has three distinct flows that must not be collapsed:

- normal username/password login;
- first-login password and recovery-answer setup gates;
- forgot-password username/security-question recovery.

Sessions are HMAC-signed, HTTP-only cookies tied to the account's `token_version`. Every protected
operation resolves the persisted account server-side and checks active status, first-login state,
and role. Client-supplied roles, actors, signatory authority, or authorization flags are never
trusted.

## Phase-to-legacy lookup for the new redesign

Use this table to locate evidence for each target phase. It is a lookup map, not permission to copy
all listed files into one change.

| Target phase | Start with these legacy sources |
|---|---|
| Visual foundation and Authentication | `src/app/globals.css`; root/auth layouts; `AuthShell.tsx`; login, forgot-password, and first-login components; `src/features/auth/`; session/password/rate-limit modules under `src/lib/` |
| Application Shell and Navigation | `src/app/(app)/_components/`; `src/config/navigation.ts`; `src/config/roles.ts`; authenticated route-group layouts; Workspace shell/rail as a second shell precedent |
| Role-Specific Dashboards | `src/app/(app)/dashboard/_components/compositions/`; dashboard primitives; `DashboardView.tsx`; recent-work logic; `developer-dashboard-service.ts` |
| Focused Clinical Desk Frame, Catalog, and Work Queue | On branch `review/clinic-ui-ux-04a`: `GuidedWorkspace.tsx`, `ExaminationCatalog.tsx`, `SelectedReportsPanel.tsx`, `encoding-progress.ts`, and `workspace/loading.tsx` |
| Result Worksheet and Encoding Details | Remaining files under `src/app/(dashboard)/workspace/_components/`; `controls/`; `_lib/encoding/`; `src/features/workspace/`; declarative definitions under `src/domain/definitions/` |
| Live Preview Workspace Interface | `src/rendering/native/NativeReportPreview.tsx`, `NativeLivePreviewPage.tsx`, `live-preview-composer.ts`, session PDF exporter, Native theme/types, and A4 styles |
| History and Audit Logs | Route-local History/Audit components; `server-actions.ts`; `audit-actions.ts`; audit services/repository; completed-session snapshot and retention code |
| Account Management | `/users` and `/developer/accounts` route-local components; account projections; guards; account actions; `userService.ts`; user API routes |
| Personnel Directory | `/personnel` route-local components; `personnel-actions.ts`; `personnel-signature-actions.ts`; `personnel-guard.ts`; signature proxy; personnel repository |
| Consolidation and Legacy Cleanup | Target-only dependency/import analysis after all target modules have migrated; never delete legacy evidence as part of target cleanup |
| Whole-System Acceptance | All relevant verifiers, role journeys, desktop/mobile/keyboard/accessibility checks, complete Workspace flow, and Preview/Print/PDF parity |

## Clinical and report contracts that must survive the rebuild

The system has exactly 17 registered report codes:

`BLOOD_TYPING`, `CBC`, `CHEM_8`, `CHEM_10`, `CT_BT`, `DENGUE_DUO`, `ESR`, `FECALYSIS`, `HBA1C`,
`HBSAG`, `HDL_LDL`, `HIV_RESULT`, `OGTT`, `PREG_TEST`, `RBS`, `RPR`, and `URINALYSIS`.

Do not retype their detailed parameters from a summary. For each report, read the maintained
`architecture/specifications/<TEMPLATE_CODE>.md` and then verify the current declarative definition
under `src/domain/definitions/`.

Preserve these system-wide invariants:

1. One patient report session represents one visit.
2. Demographics are captured once and shared according to each report's declarative policy.
3. At least one report remains selected.
4. Deselected parameters do not validate, evaluate, persist, or render.
5. Authentication users and medical personnel remain independent.
6. A report cannot complete until its required signatories are satisfied.
7. Auto-suggestions learn only after successful completion, never from drafts.
8. Completed sessions retain an immutable 30-day expiry anchor; replacement re-completes and
   atomically replaces the current report without version history.
9. Printed `HIGH`/`LOW` markers come only from the already-resolved evaluation outcome. Rendering
   never clinically recomputes a result.
10. Report colors/layout are independent from application-interface branding.

Special cases include, but are not limited to:

- HIV uses one Pathologist and two Medical Technologists with its dedicated semantic positions.
- Standard reports use Pathologist on the left and Medical Technologist on the right.
- Urinalysis crystal selection controls whether the amorphous crystal row is omitted.
- Repeatable findings, Requested By, extra demographics, remarks, kit fields, formulas, defaults,
  and omission rules are definition/specification driven.
- HDL/LDL Auto/Manual behavior and formula provenance are governed by DEC-028 and ADR-009.

## Completed output, Preview, Print, and PDF

The printable laboratory report is a primary system product. Application UI redesign does not
authorize a report redesign.

- One selected report produces one physical A4 page.
- Draft output may resolve current definitions and encoding state.
- Completed output renders from its frozen completed snapshot.
- Current personnel, parameters, formulas, or reference rules must not rewrite historical output.
- Snapshot v2 freezes render metadata; legacy snapshot v1 remains readable under its compatibility
  contract.
- Live Preview and PDF share the Native millimetre-based composition model.
- PDF is built from vector/selectable-text primitives rather than a rasterized DOM capture.
- Signatures preserve aspect ratio and transparency. Never substitute a script font when an image
  is unavailable.

The roadmap freezes A4 report content, native composition, Print/PDF output, snapshots, geometry,
and signatories during the Live Preview interface phase. Treat those as out of scope unless the user
explicitly opens a separate report-output change.

## Data and security boundaries

The intended persistence model is defined by the ordered migrations, not by guessing from TypeScript
interfaces. Core tables include:

- `user_profiles`
- `auth_attempts`
- `audit_logs`
- `personnel`
- `report_templates`
- `template_parameters`
- `template_signatory_requirements`
- `patient_report_sessions`
- `laboratory_reports`
- `laboratory_results`
- `report_signatories`
- `auto_suggestions`

Important boundaries:

- Protected Supabase data is accessed from server code only.
- The browser/anon role has no protected-table privileges.
- A server-only Supabase secret may never enter a `NEXT_PUBLIC_*` variable, client bundle, log,
  committed file, documentation, test fixture, or external prompt.
- Do not copy any legacy environment value to the target. Recreate only approved variable names and
  obtain target values through the user's secure configuration path.
- Passwords and recovery answers use salted one-way scrypt hashes; no plaintext or reversible form
  is stored.
- Signature assets live in a non-public bucket and are delivered through an authenticated boundary.
- Never expose `signatureImageUrl` as client selection authority. The browser may receive only the
  minimum render-only channel needed to paint an authorized preview.
- Audit events are append-only. Preserve event type, category, actor derivation,
  `target_reference`, details shape, and Developer-confidential visibility.
- A UI-hidden control is not an authorization control.
- No AI applies production SQL or performs a live data mutation without the exact target repository
  authority, required independent review, explicit user authorization, and pre/post evidence.

## Known legacy conflicts and stale statements

Do not copy these contradictions into the new system or silently decide them:

1. `architecture/UI_ARCHITECTURE.md` names the retired `public/st-rose-logo.png`. The legacy
   `AGENTS.md` declares `public/st-rose-logo-official.png` the sole branding source of truth.
2. `architecture/UI_ARCHITECTURE.md` and parts of `README.md` contain stale route-role descriptions.
   Current navigation and server guards exclude Developer from routine Workspace/History access,
   allow Developer restricted `/users` read access, and allow Developer read-only Personnel access.
3. Runtime and maintained specifications require reagent-kit information for six reports, including
   `HBA1C`; older registry/decision text lists five.
4. Report renderer-family vocabulary differs between declarative definitions and persisted registry
   values for `CT_BT`, `ESR`, and `FECALYSIS`, potentially affecting draft/completed layout family
   resolution.
5. Page margins conflict: one rendering document states 15 mm left/right while the validation
   corpus/checklist states 12 mm.
6. Parameter totals of 65, 72, and 75 appear in different legacy documents.
7. Blood Typing maintained printed labels and runtime parameter names differ.
8. Live production schema confirmation and several `DATABASE_DESIGN.md` residuals remain separate
   work; documentation is not proof of deployed state.

When one of these enters the active target slice, report the exact sources and ask for the needed
decision. Do not search unrelated documents for a convenient tiebreaker.

## Assets

- `public/st-rose-logo-official.png` is the current sole application-brand logo source.
- `public/report-assets/` contains report-only assets and must not be confused with application UI
  branding.
- Personnel signature images are sensitive data, not decorative assets.
- Do not redraw, regenerate, substitute, or "improve" the official logo.

Copy an asset into the target only when the active phase needs it and its authority and privacy
classification are clear. Record its legacy path and source SHA.

## Verification reference

The legacy project uses Node directly because PowerShell may block `npm`/`npx` shims:

```powershell
node node_modules/typescript/bin/tsc --noEmit
node node_modules/next/dist/bin/next lint
node node_modules/next/dist/bin/next build
node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/<name>.ts
```

Four markup-rendering verifiers must run **without** `--conditions=react-server`:

- `verify-checkpoint-b4.ts`
- `verify-checkpoint-c4.ts`
- `verify-checkpoint-c4-1.ts`
- `verify-checkpoint-c4-2.ts`

Legacy verifier families help locate load-bearing contracts:

- B1–B3: formulas, report definitions, controls, ordering, defaults, and all-17 coverage.
- B4: Workspace Encoding integration.
- B5: completion validation and immutable snapshots.
- C1–C5: resolved render model, Native composition, Live Preview, and PDF.
- M6 and named verifiers: authentication, authorization, transport, dashboards, audit, personnel,
  signatures, recovery, caching, and accessibility/presentation boundaries.

Do not claim target verification because a legacy verifier passes. Port or rewrite the relevant
behavioral assertion in `St-Rose-System`, prove it can fail, and run it against the exact target
candidate. A verifier that fails to start proves nothing.

For UI phases, also perform Playwright/manual checks at representative desktop, tablet, and mobile
widths. Verify keyboard flow, focus return, focus trapping, drawer retirement at breakpoints,
loading/error/empty states, responsive overflow, and unsaved-navigation handling. Visual acceptance
belongs to the user.

## Target delivery workflow

For each target redesign phase, follow the user-approved workflow:

```text
Updated target main
→ Create the phase branch
→ Implement only the approved scope
→ Run targeted checks and Playwright
→ Stop at an uncommitted candidate
→ Codex review
→ User visual acceptance
→ User authorizes commit and phase-branch push
→ Open PR to target main
→ Request CodeRabbit full review
→ Fix valid in-scope findings
→ Continue until CodeRabbit approves, all threads are resolved, and checks are green
→ Complete an independent review when required by the target authority
→ Implementing agent stops without merging
→ User manually merges
→ Start the next phase from updated target main
```

No AI pushes directly to `main` or merges a PR. No commit or phase-branch push occurs before the
user's authorization.

## Definition of a successful migration slice

A target slice is ready for its review gate only when:

- its scope matches the approved phase and excludes later-phase work;
- every preserved behavior has a named legacy evidence source;
- intentional UX differences trace to the target brief;
- clinical, report, security, retention, audit, and snapshot boundaries are unchanged unless
  explicitly authorized;
- loading, empty, error, invalid, success, and responsive states in scope are implemented;
- target-native tests and relevant Playwright journeys pass on the exact candidate;
- no target code depends on the legacy repository at build time or runtime;
- no secret or sensitive signature/patient data has crossed repositories;
- the exact diff has been reviewed; and
- the candidate remains uncommitted until the user reaches the commit gate.

## What not to do

- Do not copy the whole legacy repository into `St-Rose-System` and call it a redesign.
- Do not treat old UI styling as a clinical or security requirement.
- Do not rewrite clinical values, parameter names, ranges, formulas, or signatory rules from memory.
- Do not recompute completed output from current master data.
- Do not trust route visibility, disabled buttons, or client payloads as authorization.
- Do not import legacy modules across the sibling boundary.
- Do not copy `.git`, `.next`, `node_modules`, scratch files, caches, build artifacts, or `.env*`.
- Do not "clean up" the legacy repository during a target implementation phase.
- Do not weaken or delete a verifier merely because the new architecture is different; preserve the
  invariant with a target-native test.
- Do not claim parity based only on type-check, lint, or build results. Exercise the behavior.

