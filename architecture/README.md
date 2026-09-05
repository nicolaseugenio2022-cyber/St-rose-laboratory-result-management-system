# Architecture Documentation — Navigation and Authority Map

The single entry point for `architecture/`. It routes a task to the smallest set of documents that
can answer it. It carries no requirements of its own: every rule lives in the document named here,
and where this file and that document disagree, **the named document wins**.

---

## 1. Start Here

1. Read the repository-root `AGENTS.md` first. It is the project operating authority.
2. Read this file second.
3. Open **only** the documents the task router below sends you to.

The active direction is the SHADCN migration, documentation consolidation, and **SHADCN-07A** — the
backend, API, reliability and performance review, which also owns live production-schema confirmation.

Do not scan `architecture/` document by document. If the router does not cover your task, say so and
ask rather than reading everything.

---

## 2. Authority by Concern

Authority is **separated by concern** (`Project.md`, "Authority is separated by concern"; `AGENTS.md`
§1.2). There is no universal precedence ladder, and this table must never be read as one.

| Concern | Authority |
|---|---|
| Client requirements and acceptance expectations | `architecture/report-specifications/Summary.md` — for the requirements it **explicitly records** |
| Exact clinical and report detail | The maintained detailed specification `specifications/<TEMPLATE_CODE>.md` (§4), wherever `Summary.md` is silent |
| Architecture decisions | `DECISIONS.md` (DEC-001…DEC-028) and the applicable ADR under `ADR/` |
| Security, authentication, authorization, privacy, audit confidentiality | `SECURITY_MODEL.md` |
| Database, schema, persistence, RLS | `DATABASE_DESIGN.md` together with `supabase/migrations/` |
| Rendering, Preview, Print, PDF | `REPORT_RENDERING_ARCHITECTURE.md` |
| Report metadata, renderer families, input controls, computed formulas | `REPORT_REGISTRY_ARCHITECTURE.md` |
| Domain entities, aggregates, lifecycles, INV-001…INV-010 | `DOMAIN_MODEL.md` |
| UI behavior | `UI_ARCHITECTURE.md`. The UI/UX plan is delivered historical guidance (§6), not a live handoff |
| Deployment, environments, backup, rollback | `PRODUCTION_DEPLOYMENT_ARCHITECTURE.md` |
| What the system currently **does** | Repository and runtime truth — the code, not a document |
| Historical completed output | The completed snapshots themselves |

`Summary.md` never silently alters a formula, reference range, security rule, database contract, or
completed snapshot. Where it conflicts with an older document on a requirement it explicitly records,
the older document is reconciled to it — except where the conflict touches one of those five, which
is a stop-and-ask (§5).

---

## 3. Minimum-Reading Task Router

| Task | Read, in this order |
|---|---|
| Client correction or "the client asked for X" | `report-specifications/Summary.md` → the maintained `specifications/<TEMPLATE_CODE>.md` |
| Clinical parameter, reference range, or evaluation issue | The maintained `specifications/<TEMPLATE_CODE>.md` → `REPORT_REGISTRY_ARCHITECTURE.md` → `DOMAIN_MODEL.md` (INV-001…INV-010) |
| Computed formulas — HDL / LDL, calculation modes | `DECISIONS.md` DEC-028 → `ADR/ADR-009-Optional-Manual-Override-and-LDL-Calculation.md` → `REPORT_REGISTRY_ARCHITECTURE.md` |
| Report layout, rendering, Preview / Print / PDF | `REPORT_RENDERING_ARCHITECTURE.md` → `specifications/RENDERING_RULES.md` → `PDF_VALIDATION_CHECKLIST.md` (geometry constants) → the maintained `specifications/<TEMPLATE_CODE>.md` |
| Authentication or authorization | `SECURITY_MODEL.md` → `ADR/ADR-005-Authentication-vs-Personnel.md` |
| Database, schema, migration, Supabase | `supabase/migrations/` (**the migrations define the intended schema**) → `DATABASE_DESIGN.md` |
| Workspace UI or encoding flow | `UI_ARCHITECTURE.md` → the workspace source under `src/app/(dashboard)/workspace/` (`_components/`, `_lib/`) — runtime is authoritative for current behaviour |
| Management modules (users, developer accounts, audit, history) | `SECURITY_MODEL.md` → `UI_ARCHITECTURE.md` → `ADR/ADR-005-Authentication-vs-Personnel.md` |
| API, backend, performance, reliability | `PRODUCTION_DEPLOYMENT_ARCHITECTURE.md` → `SECURITY_MODEL.md` → `DATABASE_DESIGN.md` |
| Completed-session replacement or retention | `ADR/ADR-006-Completed-Report-Retention.md` → `DOMAIN_MODEL.md` → `DATABASE_DESIGN.md` |
| Personnel or signatures | `SECURITY_MODEL.md` → `ADR/ADR-005-Authentication-vs-Personnel.md` → the source guards and actions (`src/lib/personnel-guard.ts`, `src/features/server-boundary/personnel-*.ts`) |


**Optional provenance only.** The delivered historical plans in §6 — the UI/UX improvement plan and the two
`personnel-backend/` handoffs — are **not** required reading for active work. Open one only when you genuinely
need the historical implementation context behind a decision, and treat its paths, line numbers and quoted
evidence as describing the tree as it was.

---

## 4. Specification Lookup

- **`architecture/specifications/<TEMPLATE_CODE>.md` — the maintained detailed specification set.**
  Indexed by the root `LABORATORY_TEMPLATE_SPECIFICATION.md` and cited as the *Specification Source*
  by every `architecture/validation-evidence/<TEMPLATE_CODE>/validation-summary.md` record. This is the
  set that is corrected and kept current. Read it for parameters, demographics, signatories, dropdowns,
  defaults, validation and rendering metadata.
- **`architecture/report-specifications/Summary.md` — authoritative for the client requirements it
  explicitly records.** Start here for any client-reported issue.
- **`architecture/report-specifications/<test>.md` — a preserved historical archive** of verbatim client
  notes and implementation-source records. Not maintained, and not the specification of record. Read it
  for original client wording and provenance only.

Under SHADCN-06D the maintained set was reconciled to verified runtime behaviour recorded in
`src/domain/definitions/`. Where the archive and the maintained set still differ, the maintained set and
the runtime govern; where `Summary.md` speaks, `Summary.md` governs. Anything genuinely unproven is
listed in §7 — do not guess, stop and ask (§5).

---

## 5. Conflict Rule

If two authorities disagree, **stop and report the exact conflict** — naming both documents, the
exact lines, and the decision needed. Do not scan unrelated documents hunting for a tiebreaker, and
do not silently pick a winner.

If documentation and the running system disagree, that is a reportable defect requiring
investigation, resolved in neither direction by default (`AGENTS.md` §1.3).

---

## 6. Historical Documents

These record what was planned or verified at a point in time. **Do not read them as current
implementation instructions**, and do not act on paths or line numbers inside their quoted evidence
without re-checking the tree.

| Document | What it is |
|---|---|
| `whole-system-user-centered-ui-ux-improvement-plan.md` | The UI/UX program plan — **delivered historical guidance**, not a live handoff. Its findings, baselines, staged sets and quoted command output describe the tree as it was. |
| `personnel-backend/personnel-directory-backend-plan.md` | Delivered P2 implementation handoff. Raised the `DATABASE_DESIGN.md` schema-staleness finding, corrected under SHADCN-06D-R2. |
| `personnel-backend/personnel-signature-management-plan.md` | Delivered P3 implementation handoff. Carries one open live verification. |
| `PHASE_4_TEMPLATE_VALIDATION_REPORT.md` | Point-in-time Phase 4 exit report. |
| `validation-evidence/<TEMPLATE_CODE>/validation-summary.md` (×17) | Preserved per-template QA packages and fixtures. |
| `PDF_VALIDATION_CHECKLIST.md` | Historical in status, but still the only home of the universal layout criteria and the geometry constants. Criterion 13 (Word-template comparison) is no longer executable. |
| `report-specifications/<test>.md` (×17) | Preserved client-note and implementation-source archive. **Not** the maintained specification. `Summary.md` in the same directory is authoritative and is **not** historical. |

---

## 7. Authority Conflicts — Status

All seven conflicts raised by the SHADCN-06D inventory were decided by the user and applied in
SHADCN-06D-R2. **Resolved:**

1. **Detailed specification sets.** `architecture/specifications/` is the maintained set;
   `architecture/report-specifications/` is a preserved archive, except `Summary.md` (§4). The maintained
   set was reconciled to verified runtime.
2. **Signatory order.** Standard block is **Pathologist (Left), Medical Technologist (Right)**, matching
   the accepted report appearance and the runtime composer. The HIV certificate keeps its own
   Performed By / Pathologist / Verified By arrangement.
3. **Authentication.** Application-owned scrypt hashing is authoritative. `DEC-012` is marked superseded
   by `ADR-005` and `SECURITY_MODEL.md` §5.1.
4. **Database design.** The migrations define the intended schema; `DATABASE_DESIGN.md` was corrected
   for the proven personnel discrepancies. **Live production-schema confirmation belongs to SHADCN-07A.**
5. **Visual authority.** The Word templates are historical source material and are not in the repository.
   Current visual authority is separated across `Summary.md`, the maintained specifications,
   `REPORT_RENDERING_ARCHITECTURE.md`, `PDF_VALIDATION_CHECKLIST.md`, and the approved deterministic
   rendering contracts and completed snapshots.
6. **Program status.** The UI/UX program is delivered historical guidance. The active direction is the
   SHADCN migration, documentation consolidation, and **SHADCN-07A** — the backend, API, reliability and
   performance review.
7. **Authority hierarchy.** The universal ladder is retired. The §1.1 sections of the six frozen documents
   now point here and to `AGENTS.md` instead of restating a ladder.

### Still open

- **`DATABASE_DESIGN.md` residuals beyond the four approved corrections** — column types, `personnel.status`
  versus the migration's `is_active`, and the `laboratory_reports.template_code ON DELETE RESTRICT` claim,
  which the migration does not carry. For SHADCN-07A.
- **Reagent-kit template count** — runtime requires kit info for six templates (adding `HBA1C`), while
  `DECISIONS.md` DEC-018 and `REPORT_REGISTRY_ARCHITECTURE.md` §6.3 list five. The maintained specifications
  already match runtime; the decision record does not.
- **Page margins** — `REPORT_RENDERING_ARCHITECTURE.md` §8.1 states 15 mm on all four sides; the validation
  corpus and `PDF_VALIDATION_CHECKLIST.md` state 12 mm left/right.
- **Reconciled parameter count** — 65, 72 and 75 appear in different documents.
- **Blood Typing display labels** — the maintained spec prints *Blood Type* / *Rh Factor*; runtime
  `parameterName` is *ABO Typing* / *Rh Typing*. Codes were corrected; the printed labels were not, because
  changing them would change report output.

Report any of these rather than resolving them (§5).

---

## 8. Frozen Baseline and Change Control

These eight were frozen at the Milestone 2 architecture baseline:

`DOMAIN_MODEL.md` · `DATABASE_DESIGN.md` · `REPORT_REGISTRY_ARCHITECTURE.md` ·
`REPORT_RENDERING_ARCHITECTURE.md` · `UI_ARCHITECTURE.md` · `SECURITY_MODEL.md` · `DECISIONS.md` ·
`IMPLEMENTATION_GUIDELINES.md`

- **No unapproved edits.** A frozen document is never modified during routine implementation or
  refactoring.
- **Formal approval only.** It changes only for a new client requirement or an approved
  architectural decision change.
- **Traceability.** Every architectural change is logged in `DECISIONS.md` and referenced by an ADR.

Separately, some *source* files are SHA-pinned or shape-pinned by verifiers under `scripts/`. Those
pins are enforced by the verifiers themselves, not by this file — see `AGENTS.md` §6.

---

## 9. Onboarding Reading Order

For a general onboarding pass, not for a specific task (use §3 for that):

1. `Project.md` and `LABORATORY_TEMPLATE_SPECIFICATION.md` — scope and template rules.
2. `DOMAIN_MODEL.md` and `DATABASE_DESIGN.md` — entities, aggregates, schema.
3. `REPORT_REGISTRY_ARCHITECTURE.md` and `REPORT_RENDERING_ARCHITECTURE.md` — metadata and A4 output.
4. `UI_ARCHITECTURE.md` and `SECURITY_MODEL.md` — workspace, branding, RBAC.
5. `DECISIONS.md` and `IMPLEMENTATION_GUIDELINES.md` — decision index and engineering handbook.

---

## 10. Decision Log

**OPEN-01 — completed-report visibility across standard users: RESOLVED.** `Admin` and standard `User`
accounts may retrieve completed laboratory reports system-wide under the approved retention policy.
`SECURITY_MODEL.md` §6.2 and `ADR-006` already recorded this; the stale `DECISIONS.md` entry was corrected
under SHADCN-06D-R2. No open architecture decision remains in `DECISIONS.md`.

---

## 11. Directory Map

| Path | Contents |
|---|---|
| `ADR/` | Decision records ADR-005…ADR-009 |
| `report-specifications/` | `Summary.md` (authoritative) plus a 17-document preserved client-note archive |
| `specifications/` | **Maintained** 17 `<TEMPLATE_CODE>.md` documents, plus `RENDERING_RULES.md` and `TEMPLATE_SPECIFICATION_TEMPLATE.md` |
| `validation-evidence/` | 17 preserved per-template QA packages |
| `personnel-backend/` | Two delivered implementation handoffs (historical) |
