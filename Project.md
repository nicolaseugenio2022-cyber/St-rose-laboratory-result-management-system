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

Milestone 6 security hardening is the active work. Checkpoint 6D-2 is complete; see Milestone 6.

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

### Accession workflow — atomic first assignment

**Complete**, committed 2026-08-15. Opening the workspace previously consumed an accession number:
`GuidedWorkspace` allocated one from a server action in a mount effect, so merely visiting
`/workspace` advanced the yearly counter, and abandoning the page without saving burned that number
permanently. Accession numbers are the laboratory's external record identifier, and gaps caused by
allocation-on-open are indistinguishable from a lost or destroyed report.

Allocation now occurs only during the first successful persisted write.
`resolve_session_accession_number` takes a transaction-scoped advisory lock on the session id, reads
the existing accession, and calls `allocate_accession_number` only on the null branch, so concurrent
first writes for one session cannot both allocate. The whole Save Draft tree — accession, session
row, reports and results — commits or rolls back together, because a child-row failure after a
successful session insert would otherwise report Save Draft failure to the user while the accession
had already been consumed. The child writer is extracted into `persist_session_report_tree` and
shared verbatim by both persistence paths, which differ only in whether empty result values are
filtered and whether signatories are written; the ownership predicates, row-count shortfall
assertions and duplicate-id rejection therefore exist in one copy and cannot drift apart. The
accession is absent from the `ON CONFLICT DO UPDATE SET` list of both functions and from both
repository payloads, so no payload can overwrite it once assigned. The existing yearly Manila
allocator, its table and its privilege envelope are unchanged.

`IPatientReportSession.accessionNumber` is `string | null`, and an unassigned session displays
"Not assigned" in the workspace. The resolved render model deliberately keeps
`accessionNumber: string`, coalescing null to an empty field, so no user-interface wording can enter
the report template. While the accession is null, PDF export and the in-app Print control are
disabled and the report-page container is suppressed under `@media print` with a print-only notice
in its place. Neither Live Preview nor a print attempt allocates anything.

Verification: `tsc`, B4, B5, C1, M6C, lint and build pass, with nine mutations each firing their
intended assertion under byte-verified restore, and two independent read-only reviews returning no
blocking findings. Live acceptance passed **50 of 50 checks** against the live Supabase project:
first Save Draft allocated exactly once; re-saving and then completing that same session both reused
the assigned number without allocating; direct completion of a never-saved session allocated inside
the completion transaction; and a report carrying a `template_code` absent from `report_templates`
failed with `23503`, leaving no session, report or result rows with the allocator counter unchanged,
against a differential control whose only difference was a valid template code. Every pre-existing
row was compared column by column and was unchanged, and opening a workspace without saving consumed
nothing.

### Retention expiry enforcement

**Complete**, committed 2026-08-15 as two layers. ADR-006 states that once `expires_at` has passed a
completed report cannot be reopened, edited or replaced, and that completed reports are retrievable
system-wide only within the retention policy; `SECURITY_MODEL.md` repeats both rules and its access
matrix denies editing an expired report to every role. None of it was enforced.
`securityService.canEditSession` implemented the rule correctly and had **zero callers**, so an
expired session stayed visible in History and stayed writable through both persistence paths. Type
checks, lint and build all passed on a guarantee nothing reached.

**Layer one — application enforcement.** `getRecentSessions`, the only History read path, carries a
retention predicate in the database query rather than a filter applied afterwards, so no transport or
client can bypass it. A repository guard rejects an expired completed session before either
persistence RPC, placed after the existing ownership check. It guards `saveDraft` as well as
`completeSession`, because ADR-006 forbids an expired report being reopened, edited **or** replaced
and a draft-save landing on an expired completed row edits an expired clinical record;
`replaceSession` is covered through its delegation to completion. `POST /api/purge`, which previously
accepted any authenticated profile for a destructive delete, now requires Admin through the existing
`assertAdminAccess`. A non-Admin currently receives HTTP 500 rather than 403 because that guard
throws inside the route's pre-existing catch; the authorization boundary holds because the throw
precedes the purge call, and the status code is recorded below as a correctness and monitoring
defect, not a security one.

**Layer two — atomic in-transaction enforcement.** Independent review found a time-of-check/
time-of-use gap in layer one: the guard performs its own `SELECT` and the mutation happens in a
separate RPC, so a session live at the check can expire before the write lands. That gap was
explicitly **not** accepted as a residual. `assert_session_within_retention` now raises inside the
transaction, and both `save_draft_session` and `complete_patient_report_session` `PERFORM` it as the
first statement after `BEGIN` — before accession resolution, therefore before any allocation, and
before every `INSERT`. The mechanism is `now()`, which returns the transaction start timestamp and is
fixed for the transaction's duration, so the check and the write share one instant and cannot be
separated. `clock_timestamp()` advances mid-transaction and would rebuild the same race; it is
prohibited and that prohibition carries its own assertion and mutation. The repository pre-check
deliberately remains as defence in depth and as the earlier, clearer user-facing denial. The database
is now the authority.

Verification across both layers: `tsc`, B4, B5, C1, M6C, the Developer boundary verifier at 85/85,
lint and build pass. Eight mutations proved the assertions bite, each restored byte-for-byte from a
backup outside the repository. Two of them are worth recording because they exposed verifiers that
were passing for the wrong reason: assertions matched **commented-out** code, because the live-code
helper recognised `//` and `/* */` but not the SQL line comment `--`; and B5 resolved every SQL
function pin from one migration file, so once a later migration superseded two of those functions the
pins would have kept asserting against dead definitions. Migration sources are now stripped of SQL
comments once at read time, and each function resolves to its last definition across all timestamped
migrations, failing closed when the newest is unterminated rather than silently using an older one.

Live acceptance: **13 of 13** checks for layer one and **20 of 20** for layer two, against the live
Supabase project, using synthetic session `SR-20260815-0008` with its `expires_at` temporarily
backdated under explicit authorization and restored afterwards. Layer two was exercised by calling
`save_draft_session` and `complete_patient_report_session` **directly through `service_role`**,
deliberately bypassing the repository pre-check, since routing through it would prove nothing about
the database; both raised inside the transaction and wrote nothing. Negative controls passed in both
rounds: a live completed session, a Draft with a null retention anchor, and a non-existent session id
are all accepted, and the session is accepted again once its original `expires_at` is restored, so
the guard neither over-blocks nor blocks first persistence. No accession was allocated, no child row
changed, and the destructive purge path was never executed.

**Expected `updated_at` drift.** `trg_patient_report_sessions_updated_at` is a `BEFORE UPDATE`
trigger that rewrites `updated_at` on every write, so the authorized backdate-and-restore cycles
moved it and it cannot be restored — restoring fires the trigger again. On `SR-20260815-0008` it
drifted three times across the two acceptance rounds. Every other column was verified byte-identical
to its captured baseline. This is an acknowledged artifact of the authorized test mutation, not a
residual change of intent, and no claim of byte-identical restoration is made for that column.

### Completed-session replacement — Replacement Mode

Replacement Mode was delivered as three independently frozen slices. **R1, R2 and R3 are complete,
committed and live-accepted.** ADR-006 single-record semantics were confirmed before any code
was written: the same persisted record is replaced wholesale by a newly composed frozen snapshot,
with no successor rows and no version history, and prior report content is deliberately
unrecoverable.

**R1 — domain and transactional persistence.** Complete, committed 2026-08-16 as `aaa3c4f`. Before
this slice `replaceSession()` delegated to `completeSession()`, which only recomposes when
`status !== "Completed"`, so replacing an already-completed session silently replaced **nothing**.
`recompleteSession()` now returns a **new** aggregate rather than mutating, because
`completeSession()` defines `completedSnapshot` with `configurable: false` and `writable: false` and
redefining it would throw; the descriptor was not relaxed. The replacement snapshot is composed
against the **original** `completedAt`, so the replacement moment lives only in `last_replaced_at`.
Migration `20260815220000_completed_session_replacement.sql` adds
`replace_completed_session(jsonb)`, which runs the retention assertion as its first statement, locks
the stored row `FOR UPDATE`, rejects malformed and duplicate payloads, updates only `demographics`,
`completed_snapshot` and `last_replaced_at`, prunes stale children with session-scoped null-safe
`NOT EXISTS` deletes, and delegates to the unchanged shared writer. `persist_session_report_tree`,
`save_draft_session`, `complete_patient_report_session` and `assert_session_within_retention` were
not modified.

**R1 live acceptance.** The migration is applied to the application database. Acceptance ran
**91/91** against synthetic session `SR-20260815-0007` through direct `service_role` RPC calls, with
the repository deliberately bypassed so that every guard proven is a **database** guard. Proven live:
the original accession, `completed_at` and `expires_at` were preserved across every replacement and
no accession was allocated, the allocator staying at 8; the completed snapshot was genuinely
recomposed, changing from absent to one snapshot and then to a different one, and the snapshot
carried the original completion anchor rather than the replacement time; stale results and
signatories were transactionally removed rather than retained, while carried rows kept their original
identifiers; a duplicate signatory payload was rejected by name; and expired replacement was denied
by the in-transaction retention assertion and permitted again once the expiry was restored, so the
guard does not over-block.

**Rollback is proven in both directions relative to the write.** A malformed identifier that passes
the null guards reaches the `UPDATE` and then raises on a cast, and the session row returned
byte-identical **including `updated_at`**, so the update itself rolled back. A signatory referencing
a nonexistent person raises a foreign-key violation inside the shared writer, **after** the three
deletes have run, and the results and signatories were all still present, so the destructive deletes
roll back too.

**Expected R1 acceptance drift, which is NOT byte-identical restoration.** On `SR-20260815-0007`
`last_replaced_at` advanced and cannot be reset through the RPC, `updated_at` was rewritten by its
trigger, and signatory **row identifiers rotated** because replacement deletes and reinserts them by
design. Demographics, the snapshot, both results and the report row were restored to their baseline
values. Acceptance ran twice: the first pass scored 90/92 because the acceptance script compared a
stored `jsonb` object against a JavaScript object with `JSON.stringify`, and PostgreSQL reorders
`jsonb` keys; the comparison was made key-order-insensitive and the corrected run passed 91/91. The
second pass is the reason `last_replaced_at`, `updated_at` and the signatory row identifiers moved
more than once.

**R2 — server boundary, authorization and audit.** Complete, committed 2026-08-16 as `f4f98d7`.
`replaceSessionAction` authorizes the operational caller before parsing input, constructing the
repository, re-completing the aggregate or reaching the RPC, on every path including the rejection
path. **Creator-only ownership is unchanged**: no Admin override, role branch or bypass was added,
and the action neither re-implements nor shadows the repository's ownership guard, so an Admin still
cannot replace another user's completed session. The `SessionReplaced` event is emitted **only after
the awaited replacement succeeds**, so a rejected RPC, an ownership failure or a retention failure
cannot produce a success record. `targetReference` carries the **accession number**, following the
established convention that this field holds the entity's human-facing identifier and is one of only
two searchable audit columns. Audit `details` is exactly `{ reportCount, templateCodes }` — no
demographics, patient name, physician, result values, remarks, signatory details or credentials.
Actor identity and `actorRole` come from the verified active profile through the established audit
path, so **`developer_involved` remains a database-generated column** and is never written by
application code. R2 required no schema change: `AuditCategory` already contained `SessionReport`,
and `event_type` is free-form `TEXT` with no `CHECK` constraint.

**Named blocker — no `SessionCompleted` audit event. CLOSED**, committed 2026-08-17 as `d3334e9`.
Before it, `completeSessionAction` emitted nothing on success and the only successful `SessionReport`
event anywhere was `AutomatedRetentionPurgeExecuted`, so after R2 replacement was audited while the
completion that created the record was not. `SessionCompleted` is now emitted from the existing
successful completion path, mirroring the `SessionReplaced` precedent exactly and changing only the
event type and the aggregate summarised. It is emitted **only after the awaited completion
persistence resolves and before returning**, so every failing path — the non-Draft guard, a rejected
RPC, an ownership failure, a retention failure — throws before the emit is reachable and produces no
record. `category` is `SessionReport`; `targetReference` is the **persisted** accession taken from
`complete_patient_report_session` via `withAssignedAccession`, never a client-supplied value;
`details` is exactly `{ reportCount, templateCodes }`, carrying no demographic, clinical, remarks or
signatory data; and `developer_involved` remains database-derived because actor identity comes from
the verified active profile. No schema change and no migration were required. No `SecurityDenial`
path was added for the non-Draft rejection: that guard is input validation, unlike R2's, which
rejects a caller action against a completed clinical record.

**Constraint binding on R3 — SATISFIED by R3-2.** History is system-wide while replacement
authorization is creator-only, so R3 had to not present Edit or Reopen as usable for a session the
caller cannot replace. `listRecentSessionsAction` returns the server's `canReopen` decision and the
History view renders the Replace/Edit control only under it, proven live in both directions.

**R3-1 — reopen authorization and load boundary.** Complete, committed 2026-08-17 as `0518b2e`.
`findReopenableSessionForCaller` enforces creator ownership and eligibility entirely as database
predicates: owned **and** (Draft **or** (Completed **and** `completed_at IS NOT NULL` **and** within
retention)). A session belonging to another user, an expired one, or a Completed row lacking a
completion anchor is simply not found. `applyDraftOwnershipScope` is deliberately not used, because
it admits every Completed session regardless of owner. Drafts are returned on purpose: a reopened
Draft is written back by `saveDraftAction` or `completeSessionAction`, which enforce the same
ownership and retention guards, so nothing openable is unsavable. `getReopenableSessionAction`
authorizes before parsing, repository construction and the load on every path, and a miss emits
`SessionReopenDenied` as a `SecurityDenial` carrying only `{ reasonCode }`. A successful reopen is
deliberately not audited — there is no precedent for auditing reads of session data, replacement
itself is audited, and an abandoned reopen changes nothing.

**R3-2 — History to Replacement Mode UI flow.** Complete, committed 2026-08-17 as `854ad02`. The
flow is History → server-derived `canReopen` gate → `/workspace?sessionId=…` → R3-1 load → hydrated
workspace → Replacement Mode → `replaceSessionAction` → Preview. The session id travels as a query
parameter and is **not** trusted: the action re-parses it as a uuid and re-enforces ownership, status
and retention. The workspace hydrates the persisted aggregate rather than minting a replacement
identity — id, accession, `createdAt`, `completedAt`, `expiresAt` and the frozen snapshot all carry
through, selected template codes are seeded from the persisted reports, and the existing encoding
path merges persisted results, remarks, reagent kit info, requested-by, additional fields,
repeatable findings and signatories. **No accession-allocation path was added**, and the
fresh-session initializer still starts at `accessionNumber: null` rendering `"Not assigned"`.
Replacement submits only through `replaceSessionAction`, never through the completion or draft
actions, and switches to Preview only after the replacement resolves. Save Draft and Save Draft &
Exit are withheld in Completed Replacement Mode because `saveDraftAction` rejects non-Draft
sessions. A reopen request withholds the encoding surface until it resolves, so a failed load cannot
leave a blank workspace that would encode into a different session and allocate a new accession.

**R3-2 hydration correction — partial, with a named gap carried.** Reopening a completed report
resurrected a parameter that was absent from `laboratory_results` as selected-and-blank, so
replacement could add a blank row the original report did not have. `buildEncodingReport` gained one
optional input, `unmatchedParameterSelection`, defaulting to true; only Replacement Mode passes
false, so fresh encoding and draft reopen keep their prior behaviour. The affected set is **5**
parameters, not the 64 first estimated: that estimate conflated `isSelectable` with `isRequired`, and
`composeReportSnapshot` rejects deselecting a required parameter, so the 59 selectable-required
parameters can never be absent from a completed report. The real set is the selectable, optional
parameters without `blankOmission` — Urinalysis `WBC`, `RBC`, `EPITHELIAL_CELLS`, `BACTERIA` and
`MUCUS_THREADS`.

**Corrected premise, found by the publication reviewer on 2026-08-17 and verified against the code.**
The slice was justified by "a completed report persists only its selected results, so absence on
reload means deselected." That is **false**. `completeSession` persists
`report.results.filter((res) => res.resultValue)` — it filters on **blank value**, not on selection —
and `scrubDeselectedResults` has already run by then, so absence in `laboratory_results` means
**deselected OR selected-and-blank**. Only `completed_snapshot` distinguishes the two, and the reopen
path never consults it. Two consequences follow, both confined to the five parameters above, both
affecting **blank rows only**, and neither fabricating or altering a result value:

- **Over-deselection.** A parameter that was selected-and-blank, and therefore did render as a blank
  row in the original snapshot, hydrates as deselected, so replacement **removes** that row.
- **The original defect survives on non-active reports.** The rebuild maps only the report whose
  `templateCode` equals `activeTemplateCode`, so in a multi-report session every report the operator
  does not open passes through as persisted, and `composeReportSnapshot`'s `?? true` default
  **re-adds** the blank rows the correction was written to prevent.

Neither direction was reachable in the evidence gathered: the B4 assertion uses a single-report
fixture built by removing a result, which is the conflation itself, and live scenario B replaced a
single `BLOOD_TYPING` report whose parameters are all required. **This is a named carried item and
needs its own scheduled slice**; it is not closed by R3-2 and must not be treated as closed. The fix
direction is to derive per-parameter selection from `completedSnapshot.reports[].results[]` presence
rather than from `laboratory_results`, and to apply it to **every** report at reopen time instead of
lazily per active tab. It is not publication-blocking: it touches no authorization, audit, accession
or retention invariant, the drift is visible and correctable as an unchecked box in the encoding
surface before submitting, and the replaced document is shown in Preview immediately afterwards.

**Nested-button hydration defect — fixed**, committed 2026-08-17 as `e48967a`. Local smoke testing
surfaced a React hydration error in `SignatorySelectionSection`: the accordion header was a
`<button>` spanning the header row with the Confirm action rendered inside it. A button cannot be a
descendant of a button, so the parser hoists the inner one out and the DOM built from the
server-rendered markup no longer matches the client tree. The row is now a plain container holding
two sibling native buttons, with the status badge kept inside the toggle so every previously
clickable surface still toggles. `aria-expanded` was added; no hydration warning was suppressed and
no action was removed. A scan of `src/features` and `src/rendering` found no other nested-button
structure. Confirmed live: the workspace console was clean across fresh loads during acceptance.

**Completed History live acceptance — 4 of 4 scenarios, 75 assertions, 0 failures**, run 2026-08-17
against project `ruxsmcypeisbkotibzfs` through the real authenticated application boundary in the
browser, not by direct RPC, because the scenarios had to prove the client gate as well as the server
one. Synthetic session `SR-20260817-0010` was created for the purpose and is **retained as
acceptance evidence**; `SR-20260815-0007`, `0008` and `SR-20260817-0009` were not modified and
nothing was deleted.

- **A — Completion.** A synthetic Draft was completed through the normal boundary. The accession was
  minted at the first persisted write and the allocator advanced **9 → 10 exactly once** across the
  whole acceptance. Exactly one `SessionCompleted` was written, with `targetReference` equal to the
  persisted accession, `details` exactly `{ reportCount: 1, templateCodes: ["BLOOD_TYPING"] }`, no
  clinical, demographic or signatory data, `developer_involved: false`, and `occurred_at` 341 ms
  after `completed_at`.
- **B — Replacement Mode.** The owned Completed session was reopened through R3-1, hydrated through
  the R3-2 path, changed in one controlled synthetic way, and replaced through `replaceSessionAction`.
  The session id, accession, `created_by_user_id`, `created_at`, `completed_at`, `expires_at`, the
  snapshot's original completion anchor, the report row id and both result row ids were all
  preserved. `last_replaced_at` advanced from null. **The replacement allocated nothing** — the
  allocator stayed at 10 — and the session count did not change, so no successor row was created.
  Exactly one `SessionReplaced` was written and `SessionCompleted` did not increase. The workspace
  switched to Preview, which rendered the replaced content.
- **C — Non-owned Completed.** Signed in as a different operational user, all five Completed
  sessions remained visible, every row offered Preview only with no Replace or Edit control, and both
  Drafts were absent because draft scope is owner-only. A direct `/workspace?sessionId=…` load of
  another user's session was denied server-side and showed the safe-state panel with no encoding
  surface. The denied load performed **no write at all**: `updated_at` was identical before and
  after.
- **D — Expired Completed.** Under explicit authorization the retained fixture's `expires_at` was
  temporarily backdated. The session dropped out of History, the R3-1 load was denied, no replacement
  occurred, and `expires_at` was then restored to its exact captured value with the History listing
  recovering.

Audit movement across acceptance: `SessionCompleted` **1 → 2**, `SessionReplaced` **0 → 1**,
`SessionReopenDenied` **0 → 2**, `SessionReplacementDenied` unchanged at 0. Both denials were
`SecurityDenial` records carrying only `{ reasonCode }` with `target_reference: null`, so no accession
or patient identifier appears in a denial record.

**Expected irreversible drift, explicitly not defects.** `updated_at` on `SR-20260817-0010` moved
four times — completion, replacement, expiry backdate, expiry restore — because the `BEFORE UPDATE`
trigger rewrites it and restoring fires it again. **Signatory row identifiers rotated** during
replacement while the personnel identifiers stayed identical, which is by design since replacement
prunes and reinserts them. The frozen snapshot and report remarks were replaced wholesale and the
prior content is deliberately unrecoverable under ADR-006. No claim of byte-identical restoration is
made for any of these. Everything else was verified against its captured baseline, and `expires_at`
was restored exactly.

**Baseline note.** `SessionCompleted` stood at 1, not 0, when acceptance began: `SR-20260817-0009`
had been completed through the application earlier the same day during smoke testing. Reconstructed
from the audit trail that record was already correct, and it was treated as prior corroborating
evidence rather than as controlled scenario A.

### Workspace resilience — accidental-refresh recovery

**Complete**, committed 2026-08-17. Realises the Milestone 5 scope item "Draft autosave with
accidental-refresh protection". An accidental browser refresh previously destroyed everything encoded
before the first Save Draft.

Mechanism is tab-scoped `sessionStorage` — explicitly not the persistent per-origin store, since a
shared laboratory workstation would otherwise retain patient data on disk after the operator leaves.
One key, one small module in the workspace feature: no state library, persistence framework,
IndexedDB or service worker, and no server, repository or database change. Recovered content covers
demographics, selected reports and tests, result values, remarks, reagent kit fields, signatory
selections and the remaining encoding state, and the round trip preserves per-parameter selection.

**Recovery applies only to a fresh `/workspace` with no `sessionId` query parameter.** A persisted
Draft reopen and R3 Replacement Mode always use the authoritative server-loaded session and are never
hydrated from recovery state; nothing is even read for those routes, and nothing is written for a
reopened or Replacement Mode session, nor once an accession exists.

**Accession invariants hold and are structural, not merely intended.** A payload is restored only when
it is version 1, within TTL, `status: "Draft"` and `accessionNumber: null`; anything else is deleted
rather than ignored. Recovered work therefore stays a Draft rendering the exact literal
`"Not assigned"`, **no accession is allocated on refresh or restore**, and the first successful Save
Draft or Complete afterwards allocates **exactly once** through the unchanged atomic path. No
allocation code was added or referenced.

**TTL is 30 minutes**, checked on read. Recovery clears on successful Save Draft, successful Complete,
Save Draft & Exit, Discard Changes & Exit, a deliberate New Session, Logout, TTL expiry, version
mismatch and any invalid payload. An accidental refresh is distinguished from a deliberate New Session
by the Navigation Timing type: only a reload restores, a navigate clears, and an unavailable entry
fails closed. The logout clear lives in the client `Header`, because `authActions.ts` is byte-frozen by
M6C. No credentials, tokens, auth state or accession numbers are stored.

Restoration runs in a post-mount effect, never in a state initializer. `sessionStorage` does not exist
during the server render, so seeding initial state from it makes the client's first render disagree
with the server HTML and fails hydration. The first implementation did exactly that and was caught by
the live refresh check before the final gate; a verifier assertion now pins the correct shape.

Verification: `tsc`, B4, B5, C1, lint and build all PASS with identical pre- and post-Level-D candidate
hashes; two mutations each fired their intended assertion with byte-verified restores; B4 gained 21
assertions with none removed or weakened; and the full cycle was manually confirmed live — enter data,
refresh, state restored, still "Not assigned", allocator unchanged, then one first write allocating
exactly once.

Accepted residual, unchanged: Chrome writes `sessionStorage` to disk for tab restore, so exposure is
reduced rather than eliminated.

## Milestone 6 — Production Hardening

Security hardening is in progress and is tracked as checkpoints 6A–6D.

Implemented and verified:

- Application-owned authentication with irreversible credential storage
- Canonical username semantics
- Server-only protected data access; removal of browser-direct database access
- Developer least-privilege boundary
- Self-service password recovery based on username and the configured security question
- Persistent, database-enforced append-only audit logging — schema, read surface, and the
  Auth/Account and Security-Denial durable writers

Pending:

- Migration-state preflight and schema provisioning
- Persistent audit writers for the remaining mandated categories: Personnel and Credential events,
  and Session lifecycle events beyond the automated retention purge
- Audit delivery durability: every audit writer appends its event separately from the operation it
  records, so the two are never atomic. Accepted 2026-08-15 as a project-wide residual, to be
  addressed across all writers at once rather than per event. The failure mode differs by writer, and
  both halves are current as of 2026-08-17. `IAuditLogRepository.append` **throws** on error. The
  **authentication** writers — `logout-audit.ts`, `lockout-audit.ts` — wrap the emit in
  `try { … } catch { console.error(…) }`, so they swallow the failure and the event is genuinely
  **lost**. The **session lifecycle** writers in `server-actions.ts` — `SessionCompleted` and
  `SessionReplaced` — do not wrap it, so the throw **propagates** and the caller is told the operation
  failed when it has already been persisted; a retry re-enters `completeSession`, which shifts
  `completed_at` and `expires_at` and re-freezes the snapshot, though it cannot double-allocate an
  accession because `resolve_session_accession_number` returns the existing one under an advisory
  lock. Any project-wide fix must address both shapes.
- **Repository CI workflow is absent.** There is no `.github/workflows` directory, so **no
  exact-commit CI has ever run for any published commit**, including the Completed History
  publication at `177edc6`. This is a deployment-prep item, not a passed gate: before production
  deployment the intended CI workflow must be added and the exact commit then verified against it. Do
  not describe CI as healthy or passing until both halves are done.
- Performance validation
- Accessibility validation
- Monitoring
- Deployment validation
- Client acceptance testing

### Milestone 6D-2 — audit writers and Developer bootstrap

**6D-2 is complete**, declared 2026-08-15 after reconciliation against Git history and the governing
authority. Every slice below is committed, and each F-slice carries live acceptance against the live
Supabase project in addition to its offline gates.

- Slice A — durable Developer classification schema and dual-mode read. Complete.
- Slice B — role-aware audit writers, Auth/Account lifecycle and Security-Denial events, and
  retirement of the in-memory prototype audit modules. Complete.
- Slice C — the dual-mode exclusion invariant and creation-path lifecycle parity pinned in
  verification. Complete.
- Slice D1 — guarded one-time `bootstrapFirstDeveloper` service primitive, refusing when any
  Developer account already exists, of any status. Complete.
- Slice D2 — operator-only Developer bootstrap entry point, the durable Initial Developer bootstrap
  execution audit event, bounded retry and repair behaviour, and environment-only secret handling.
  Complete. A fresh database now has a path to its first Developer account.
- Slice E — durable audit for first-login security mutations. Complete.
- F0 — SECURITY_MODEL §5.2 and §10.2 requirements recorded ahead of implementation. Complete.
- F1 — durable audit for failed authentication attempts (§10.1). Complete.
- F2 — audit for successful authentication (§10.2). Complete.
- F3 — authenticated self-service password change requiring the current password rather than the
  security question (§5.2). Complete.
- F4 — privileged password reset separated from general account editing (§5.2). Complete.
- F5 — durable audit for explicit user-initiated logout (§10.2). Complete.
- F6 — durable audit for account lockout activation and release (§10.1), backed by the
  `account_lockouts` table whose partial unique index on open lockouts makes activation exactly-once.
  Complete.

With F1, F2, F5 and F6 committed, the authentication and session audit set mandated by §10.1 and
approved under §10.2 is fully implemented.

**Closeout gap, found and closed 2026-08-15.** Reconciliation found that F3 had shipped as service,
action and audit with no entry point: `changeOwnPasswordAction` had zero callers, so §5.2 was
implemented but not deliverable, and F3's successful-path live acceptance could not be closed. A
narrow UI-only closeout slice added a Change Password control in the application header, available to
User, Admin and Developer, and one controlled live change then closed the deferred acceptance —
exactly one `AccountPasswordChanged`, the guarded compare-and-set succeeding, `token_version`
incrementing exactly once, the initiating session remaining usable, and recovery and lifecycle state
unchanged.

### Environment and migration state

`supabase/migrations/20260813120000_audit_developer_classification.sql` was applied manually to the
live Supabase project through the Supabase SQL Editor rather than by migration tooling, after the
Audit Logs page failed at runtime against a database that lacked the Slice A columns. The live schema
therefore contains the migration changes — the audit role columns and the generated
`developer_involved` column are present and were verified against the running application — even
though `supabase_migrations.schema_migrations` may not record that migration as applied. Confirm the
columns and schema state before attempting to re-apply it.

`supabase/migrations/20260815120000_add_account_lockouts.sql` was likewise applied manually through
the Supabase SQL Editor on 2026-08-15, and deliberately so. Preflight established that a broad
migration runner would first replay `20260813120000`, which uses `ADD COLUMN` without `IF NOT EXISTS`
and would fail on the columns already present, and would also apply the unrelated pending
`20260809104941` as collateral. Table, columns, the partial unique index, RLS, the absence of
policies, and the absence of `anon`/`authenticated` grants were each verified by query afterwards.
Applying it also required confirming no account was inside an active lockout at cutover, since a
lockout already running when the table appears produces no release event.

`supabase/migrations/20260809104941_add_completed_report_snapshots.sql` has its column effects
present in that environment, verified 2026-08-15. It adds five columns — `completed_snapshot` on
`patient_report_sessions`, `encoding_data` on `laboratory_reports`, and `raw_result_value`,
`formatted_result_value` and `computation_metadata` on `laboratory_results` — and each is introduced
by this migration alone, appearing neither in the base schema nor in any other migration. All five
were confirmed present against the live database under a negative control. The retention columns
`completed_at`, `expires_at` and `last_replaced_at` are **not** evidence either way: they belong to
the base schema in `02_tables.sql`.

Two parts of that migration remain unprovable read-only and are not claimed here. Whether
`supabase_migrations.schema_migrations` records the migration cannot be determined, because that
schema is not exposed through PostgREST and the Supabase CLI is unavailable in this environment. The
state of the `laboratory_results_evaluation_outcome_check` constraint is likewise unverified, since
constraint introspection needs a SQL Editor query; the base schema permits four outcome values, this
migration adds `Invalid`, and `20260809140000_expand_evaluation_outcomes.sql` later permits eight.

That incident is the concrete driver for the Migration-state preflight and schema provisioning item
above: every current verifier is source-level or uses in-memory fakes, so an unapplied migration
cannot be detected before runtime.

`supabase/migrations/20260815180000_atomic_accession_assignment.sql` was applied manually through the
Supabase SQL Editor on 2026-08-15, as a single submission so that its `DROP FUNCTION` and the
re-`GRANT` stay in one transaction. It was first applied to the **wrong Supabase project**, and that
was detected before any acceptance ran: the application's PostgREST reported the new functions absent
while the editor's catalog showed them present, and the editor's database was then shown to lack
`accession_sequences` entirely. The correct project was confirmed by fingerprint before re-applying —
`accession_sequences` present at `2026 → 6`, exactly three sessions `SR-20260815-0001`, `-0005` and
`-0006`, `allocate_accession_number` present, and `save_draft_session` absent. Two operational facts
follow. A dashboard project ref alone is not proof of the target database, because a preview branch
reuses it; only a data fingerprint is. And PostgREST's schema cache took roughly forty seconds to
expose the new functions after `notify pgrst, 'reload schema'`, so absence immediately after applying
is not evidence that a migration failed.

The other project still holds `save_draft_session`, `resolve_session_accession_number`,
`persist_session_report_tree` and a `text`-returning `complete_patient_report_session` against a
database that has neither `accession_sequences` nor `allocate_accession_number`, so those functions
would fail at runtime there. Cleaning that up is outstanding and requires identifying what that
project is. Live acceptance also left two synthetic sessions in the correct project,
`SR-20260815-0007` and `SR-20260815-0008`, deliberately retained pending a cleanup decision; deleting
them would not roll the allocator back, by design.

`supabase/migrations/20260815200000_atomic_expiry_enforcement.sql` was applied manually through the
Supabase SQL Editor on 2026-08-15, after a fingerprint confirmed the correct project. Unlike the two
migrations above it contains **no `DROP`**: both persistence functions are replaced in place with
unchanged signatures, so there is no window in which a function is absent and no precondition about
in-flight completions. No `notify pgrst, 'reload schema'` was needed either, because no RPC signature
changed and the new helper is never called through PostgREST, so the schema-cache propagation delay
recorded above did not apply.

### Deferred follow-ups

- Security-Denial coverage for route-level `checkRouteAccess` denials remains deferred while
  `src/lib/auth-guards.ts` is byte-frozen by M6C verification.
- A system-wide user-centered UI/UX review is deferred until the required application functionality
  is complete. Internal and canonical values remain stable in the domain, database, services, audit
  events, and APIs; end-user wording is a presentation-layer translation only. This is not current
  milestone work.
- Deferred UI/UX polish, tracked separately from functional and security completion and blocking
  neither: the login cooldown message should convey the remaining wait from the authoritative server
  retry state without revealing whether the username or the network dimension caused it; and the
  Change Password modal blocks every dismissal route while a submission is in flight, so that a
  committed password change can never be silently hidden, which leaves a user on a request that never
  settles waiting until they navigate or reload. Both belong to the same in-flight and blocked-state
  pass; neither is a functional or security defect.
- Workspace resilience, approved 2026-08-15 as two items. Item one is **complete**; item two remains
  deferred. Item two, encoding-mode print suppression, keeps its own later slice: while the accession
  is unassigned, browser-native Ctrl+P from the data-entry workspace must not print the workspace form
  and should show only the save-before-printing notice.
- Encoding-mode Ctrl+P currently prints the data-entry workspace while the accession is unassigned.
  This is a scope gap in the accession slice's frozen amendment rather than a defect in what was
  built: the print guard was scoped to the report canvas, which `GuidedWorkspace` mounts only in
  preview mode, so the encoding form was never inside it. The printed form carries no accession,
  letterhead or signatories and cannot pass as an official result, but it does carry patient data.
  Accepted 2026-08-15 as follow-up rather than extending an exhausted correction cycle, and scheduled
  into the workspace-resilience slice above.
- Preview-mode Ctrl+P behaviour for an unassigned session remains **manually unverified**. Its
  correctness rests on code review and the B4 assertions with their supporting mutations, not on a
  visual check. Close it with one manual observation: an unassigned session must print only the
  notice, and an assigned session must print normally.
- `POST /api/purge` returns HTTP 500 rather than 403 to a non-Admin caller, because `assertAdminAccess`
  throws inside the route's pre-existing catch. The authorization boundary is intact — the throw
  precedes the purge call and was mutation-proved — so this is a correctness, monitoring and client-
  experience defect rather than a security one. Fixing it means reshaping the route's error handling,
  which was deliberately out of scope for the slice that added the guard.
- `findById` and `findByAccessionNumber` still return expired completed sessions when addressed
  directly. History no longer surfaces them, so there is no route to them through the interface, but
  direct retrieval by id or accession remains open. Knowingly recorded rather than fixed, to keep the
  expiry slice narrow; note the write paths are guarded regardless, so an expired session retrieved
  this way still cannot be edited.
- `findActiveCompletedSessions` inherits the History retention filter through its delegation to
  `getRecentSessions`. It has no callers, and the inherited behaviour matches both its own name and
  ADR-006's visibility rule, so it is recorded rather than changed.
- Concurrent first-write ownership transfer: both persistence functions set
  `created_by_user_id = EXCLUDED.created_by_user_id`, so a concurrent first write could reassign
  ownership of a session. Verified as **pre-existing at the baseline commit** and unchanged by the
  accession slice, which is why it was not actioned there. It needs its own hardening slice and a
  decision on the intended ownership semantics.

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

Milestone 6 checkpoint 6D-2 is complete as of 2026-08-15: Slices A through E, F0 through F6, and the F3 closeout-gap entry point are committed and live-accepted, and the persistent freeze pins were made checkout- and platform-invariant so verification passes on an LF checkout such as CI.

The active objective is publishing Completed History, which is functionally complete and live-accepted as described below.

**Completed History is functionally complete and live-accepted as of 2026-08-17, pending publication.** Session completion composes and freezes a completion snapshot and persists it transactionally with `completed_at` and `expires_at`; history retrieval, the `/history` route and its session view are present; rendering consumes the frozen snapshot when one exists, preserving snapshot authority; and the operational role gate admits `Admin` and `User` while denying `Developer`, matching ADR-006 visibility. Retention expiry is enforced on read and again inside the write transaction. Replacement Mode exists end to end — domain, atomic database replacement, server boundary with audit, the reopen authorization boundary, and the History-to-workspace UI flow — with the accession and the retention anchor preserved across replacement. Session completion and replacement are both audited. The final live acceptance passed 4 of 4 scenarios and 75 assertions with 0 failures.

Two earlier statements in this section were stale and are corrected here. `replaceSession` is no longer a stub: R1 replaced the delegation with `recompleteSession()` plus `replace_completed_session(jsonb)`. Retention expiry is no longer unenforced on read. **`purgeExpiredSessions` is wired**: `PurgeSchedulerService.executeScheduledPurge` calls it and emits `AutomatedRetentionPurgeExecuted`, reachable through the Admin-guarded `POST /api/purge`. What purge still lacks is a **scheduler** — no cron, platform schedule or `pg_cron` entry exists, so it runs only when invoked. That is backlog and was never a Completed History blocker. One related monitoring nuance, also non-blocking: the event is emitted only when `purgedCount > 0`, so a run that deletes nothing leaves no evidence it executed.

**Remaining Completed History backlog is non-blocking and does not make the milestone incomplete.** None of it is required for publication: the **Replacement Mode hydration fidelity gap** recorded under the R3-2 hydration correction above, which is a named carried item awaiting its own scheduled slice and is the only one of these that affects a clinical document, bounded to blank rows on five Urinalysis optional parameters; purge scheduling and the `purgeExpiredSessions` zero-count audit nuance; `POST /api/purge` returning 500 rather than 403 to a non-Admin, where the authorization boundary itself is intact and mutation-proved; `findById` and `findByAccessionNumber` still returning expired completed sessions when addressed directly, with no interface route reaching them and the write paths guarded regardless; successful-reopen auditing, deliberately not implemented and parked to the audit lifecycle closeout; the runtime response allowlist for the frozen `session-transport.ts`; the project-wide audit delivery durability residual; and workspace resilience, encoding-mode Ctrl+P, Personnel Directory and UI/UX polish, each tracked on its own.

The remaining Milestone 6 hardening work is still required later before production completion: migration-state preflight and schema provisioning, the outstanding Personnel/Credential and Session-lifecycle audit writers, audit delivery durability, and then performance, accessibility, monitoring, and deployment validation. Deferred UI/UX polish remains separately tracked and gates nothing.

## Personnel Directory — P1 UI Shell (2026-08-18)

**The Personnel Directory UI shell is committed and manually accepted. Its backend is deliberately not built, and the directory is therefore not yet a working feature.**

Before this slice, `/personnel` was advertised in `navigation.ts` and guarded in `checkRouteAccess`, but no route existed, so the sidebar link returned 404 for every Admin. P1 adds the page, its loading skeleton, the directory view, table, form and form modal, a form validation module, and a temporary preview fixture — eight files, all new. **No existing file was modified**, so the byte-frozen `auth-guards.ts` and the shape-pinned `IPersonnelRepository` were not touched, and no migration was involved.

P1 is presentational only. It adds no new guard and no new backend or persistence surface: it contains no server actions, audit writers, storage access or SQL of its own, and reuses the existing route-access and profile-resolution path that every other guarded page already uses. The view accepts optional `onSubmit` and `onToggleStatus` callbacks and P1 supplies neither, so submitting the form or toggling status surfaces a "not connected yet" state rather than simulating a successful write. Admin sees Add, Edit, Activate and Deactivate controls; every other permitted role is read-only through `canManage`, derived server-side from the profile role. There is no delete control, consistent with the `report_signatories` foreign key that already makes hard deletion impossible. The signature area renders only for Pathologist and is a disabled placeholder pending the later storage slice; Medical Technologist never offers one.

`preview-fixture.ts` is temporary. It supplies two read-only sample rows so the layout could be reviewed before a read boundary exists, is imported only by `page.tsx`, is displayed behind an explicit preview-data notice so it is never mistaken for database content, and is deleted in P2 together with the `isPreviewData` prop.

Verification: TypeScript, lint and build all passed, with `/personnel` present in the build route table. One environmental note carried forward — **no `.env` file exists in the repository**, so a bare `next build` fails during page-data collection on the pre-existing `/api/users/summary` route for a missing `SUPABASE_SECRET_KEY`. That failure is environmental rather than a code defect; the build was verified using the placeholder values `src/lib/supabase/client.ts` already defines for itself. Manual browser verification of the Admin and Developer presentations, the Pathologist/MedTech signature behaviour and the absence of a delete control was performed and accepted by the user.

**One process residual is recorded rather than resolved.** P1 was implemented directly by Claude at explicit user direction rather than delegated, which departs from the normal division of labour for feature work. It is recorded here so the gap is visible and is not claimed as satisfied. A fresh read-only publication review was subsequently run over this range and returned no blocking findings; the two documentation-accuracy items it raised are corrected above.

The backend contract is captured in `architecture/personnel-backend/personnel-directory-backend-plan.md`. Its central finding is that **the backend requires no migration**: the `personnel` table already carries every column, constraint and trigger needed, RLS is enabled with no policies, and `IPersonnelRepository` already declares full CRUD whose `create`, `update` and `toggleActiveStatus` have never had a caller. P2 supplies an Admin-only write boundary with Developer read-only, `PersonnelCredential` audit writers — closing the Personnel and Credential audit writer already listed as outstanding above — duplicate-PRC handling, and a dedicated verifier with mutation proofs and a mandatory independent reviewer. Signature upload and the hardening of the currently forgeable, and currently uncalled, signature access token remain deferred to their own security slice. **Production SQL is applied manually by the operator and never by an implementer.**
