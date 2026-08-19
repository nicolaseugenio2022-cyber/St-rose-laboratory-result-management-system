# Whole-System User-Centered UI/UX Improvement Plan

**St. Rose Laboratory Result Management System**

| Field | Value |
|---|---|
| Document status | Planning artifact. No production code changed by this document. |
| Created | 2026-08-19 |
| Last revised | 2026-08-19 (revision 5 — reconciled against the published repository-local `AGENTS.md` at commit `7427942`; UX0-B authority gate satisfied) |
| Planning baseline SHA | `cd1152663154ed523f95ecef165a1877293e7c83` |
| `origin/main` at planning time | `cd1152663154ed523f95ecef165a1877293e7c83` (0 ahead, 0 behind, re-verified at revision 2) |
| Working tree at planning time | Two expected entries, no unexpected changes — see §1.2 |
| Program status | **Authorized.** The user has explicitly opened a Whole-System User-Centered UI/UX Improvement Program. See §2.3. |
| Authority position | Subordinate to `AGENTS.md` (**repository-local and published**, commit `7427942` — see §1.3), `Project.md`, `LABORATORY_TEMPLATE_SPECIFICATION.md`, `architecture/` ADRs and specifications, and `CLAUDE.md`. Authority is **separated by concern** (`AGENTS.md` §1.2) and is not one universal ladder. Where this document and repository authority disagree, **repository authority wins** and the conflict is a hard stop for the user. |
| Implementation status | **Nothing here is approved for implementation.** Each slice requires the normal plan → approve → freeze → delegate → verify cycle. |
| Branding source of truth | `public/st-rose-logo-official.png` — **sole** authoritative logo. See §6. |

---

## 1. Preflight

### 1.1 Repository state

```
git rev-parse HEAD          → cd1152663154ed523f95ecef165a1877293e7c83
git rev-parse origin/main   → cd1152663154ed523f95ecef165a1877293e7c83
git rev-list --left-right --count origin/main...HEAD → 0  0
```

Baseline gate health, measured at this SHA during planning:

| Gate | Result |
|---|---|
| `tsc --noEmit` | PASS |
| `next lint` | PASS (0 warnings, 0 errors) |
| `verify-checkpoint-c1.ts` | PASS |
| `verify-checkpoint-c4.ts` | PASS |
| `verify-checkpoint-c4-1.ts` | PASS |
| `verify-checkpoint-c4-2.ts` | PASS |

**Verifier invocation correction.** `CLAUDE.md` prescribes `node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/<name>.ts`. The three C4-family verifiers **cannot run under `--conditions=react-server`**: they import `react-dom/server`, which throws `Error: react-dom/server is not supported in React Server Components`. They run correctly **without** the flag. This is a documentation-versus-tooling conflict recorded for the user; it is not something this plan changes.

### 1.2 Working tree — two expected entries, classified

```
git status --porcelain
 D public/st-rose-logo.png
?? architecture/whole-system-user-centered-ui-ux-improvement-plan.md
```

Every working-tree entry must be classified before any slice is frozen. As of revision 2 there are exactly two, and **no unexpected changes**:

| Entry | Classification | Owner | Action |
|---|---|---|---|
| ` D public/st-rose-logo.png` | **Intentional user-owned deletion** | The user | **Leave untouched.** Never restore, never stage, never revert, never regenerate. |
| `?? architecture/whole-system-user-centered-ui-ux-improvement-plan.md` | **Plan artifact produced by this planning task** | This document | Untracked documentation only. No production code. |
| *(none)* | Unexpected changes | — | None present. |

**The deletion of `public/st-rose-logo.png` is deliberate and authorized.** It is **not** an accidental dirty-tree defect and **not** a blocker to this planning program. The `CLAUDE.md` clean-tree rule is satisfied by classification rather than by cleaning: the entry is accounted for, owned, and explicitly not to be absorbed. Any agent that "helpfully" restores this asset is violating a direct user instruction.

`public/st-rose-logo-official.png` is the sole branding source of truth going forward (§6).

### 1.2.1 Confirmed branding defect — three stale legacy-logo references

The deleted asset is still referenced by three live components. Re-verified against the working tree at revision 2:

```
grep -rn '"/st-rose-logo\.png"' src/
src/app/login/page.tsx:86                                  src="/st-rose-logo.png"
src/features/auth/components/FirstLoginForm.tsx:54         src="/st-rose-logo.png"
src/features/auth/components/ForgotPasswordForm.tsx:81     src="/st-rose-logo.png"

ls public/st-rose-logo.png            → No such file or directory
ls public/st-rose-logo-official.png   → present, 1,305,200 bytes
```

These are the only three references anywhere in `src/` and `scripts/`. **This is a real UI/branding defect, recorded as F-47:** the login, first-login, and forgot-password screens request an asset that no longer exists and render a broken image.

The correction is bounded and is scheduled as slice **UX0-B** (§11). It repoints the three references to the official asset, verifies the three affected screens, **does not recreate the deleted asset**, **does not introduce any alternate or generated logo**, and leaves the deletion intentional and intact.

### 1.3 `AGENTS.md` — repository-local project authority, published and reconciled

**Status: RESOLVED.** Published as a tracked repository file in authority-migration commit
**`7427942`** (`docs(governance): establish repository-local agent authority`), on top of baseline
`cd11526`. This plan **has been reconciled against it** — see §1.3.1.

`AGENTS.md` now lives at the repository root, is **tracked by Git, and travels with every clone**.
Any agent working in any clone has the complete project authority available with no external setup.
`.gitignore` no longer ignores it; the rule that did was removed in the same commit, scoped to the
root `AGENTS.md` rule and its comment only.

**Standing rules for every agent:**

- **Read it at session start.** It governs agent workflow, scope control, delegation, verification,
  frozen-boundary handling, Git and publication, and documentation process.
- **Never restate it wholesale into a delegation prompt.** Carry only the applicable rules inline.
- **Amending it is a publication-boundary action** requiring explicit user authorization, the same
  as `PROJECT.md`.

#### Authority-migration record

The previous authority was an **external `AGENTS.md`** held on a different machine and never
available on the working machine. **The user explicitly chose to replace it rather than reconcile
against it.**

The published file **does not reconstruct, reproduce, paraphrase, or infer** the contents of that
external document, and **no agent may represent it as a recovery of it**. It is derived from
`PROJECT.md`, `CLAUDE.md`, the approved architecture handoffs, the repository itself, and the
conventions this project already demonstrably follows.

Revisions 2 through 4 of this plan recorded the external file as pending transfer and made
reconciliation the final pre-implementation gate. **That gate is now satisfied by the migration**,
not by reading the external file. Any statement in an earlier revision describing `AGENTS.md` as
external, unread, unavailable, gitignored, or awaiting reconciliation is **obsolete and superseded
by this section.**

### 1.3.1 Reconciliation outcome — completed at revision 5

Performed against the published `AGENTS.md` at commit `7427942`, read directly from
`git show HEAD:AGENTS.md`.

**Outcome: no material conflict.** The plan required three corrections, all alignment rather than
substance:

| # | Correction | Driver |
|---|---|---|
| 1 | §1.3 / §1.3.1 rewritten from "external, unread, pending" to "published and reconciled" | The migration itself |
| 2 | Reviewer identity generalized from "a fresh read-only **Codex** Reviewer" to "a fresh read-only **independent reviewer**, Codex or Big Pickle / OpenCode, disqualified only by having implemented the candidate" — §11 UX0-B and §17.10 | `AGENTS.md` §2 and §5.4 |
| 3 | UX0-B blocker 1 moved from **OPEN** to **SATISFIED**, and the §17 gate re-checked against the published authority | The migration itself |

**Confirmed consistent, no change needed.** The published authority independently states, and this
plan already followed, each of the following:

- **§5.1 verification ladder** — targeted → candidate gates → adversarial → final gate, one full
  gate at the publication boundary. Matches §17.7 and every slice's gate list.
- **§5.2 invocation exception** — the C4-family verifiers cannot run under
  `--conditions=react-server`; record it, do not "fix" it. Matches §16.6 and §11 UX0-A.
- **§5.3 negative control** — *"A probe earns trust from a negative control."* Independently
  mandates the baseline grep already required by §17.8.
- **§5.3 adversarial scope** — mutation proof not required where the change is not
  security-critical. Matches §17's "not required, negative control instead."
- **§5.4 independent review** — required for a frozen boundary. UX0-B qualifies, and §17.10 already
  required it.
- **§5.5 manual acceptance** — required wherever deterministic tests cannot establish visual or
  interaction behavior. Matches the per-slice manual acceptance criteria throughout §11 and §17.13.
- **§6 frozen boundaries** — identify the exact invalidated assertion, change only the real
  boundary, never weaken an unrelated assertion, never evade a textual verifier. Matches §9,
  §17.4.3, and the UX6 provenance-strip gate.
- **§7 security and domain preservation** — server-authoritative permissions, UI never grants
  capabilities, audit semantics preserved, snapshots authoritative, `signatureImageUrl` never in a
  client schema, **UI/UX skills advisory only**. Matches §3, §4, §9, and §11 UX1/UX3.
- **§3 preflight** — a known user-owned dirty path is not automatically an agent defect but must be
  explicitly classified before a slice is frozen. Matches §1.2 and §16.2, and covers the intentional
  `public/st-rose-logo.png` deletion exactly.

**Two approved resolutions are carried into the published authority and are preserved here
unchanged:**

- **Current-versus-intended behavior** (`AGENTS.md` §1.3) — repository and runtime truth is
  authoritative for what the system **currently does**; approved architecture and specifications are
  authoritative for what it is **intended to do**; divergence is a **reportable defect or drift
  requiring investigation**; never silently resolved by assuming code always wins or documentation
  always wins. This is the rule behind §2.4's standing note and the seven `UI_ARCHITECTURE.md`
  divergences recorded there.
- **Concern-separated authority** (`AGENTS.md` §1.2) — `AGENTS.md` governs process and does **not**
  override domain-specific authorities on their own concerns.
  `LABORATORY_TEMPLATE_SPECIFICATION.md` and the approved clinical specifications retain clinical
  and report meaning, completed snapshots retain frozen historical output, `PROJECT.md` retains
  project state and the authority-by-concern mapping, and approved architecture handoffs retain
  intended design within their bounded slice. **Not to be flattened into one universal ladder.**

**Agent-role model, preserved** (`AGENTS.md` §2): Claude plans, freezes scope and contracts,
interprets authority, owns Git and publication integrity, and reviews implementation evidence and
milestone boundaries. **Big Pickle / OpenCode and Codex are both implementation workers and targeted
deterministic verifiers**, and either may serve as the fresh independent reviewer of a candidate it
did not implement. There is **no** permanent rule that Codex is review-only and **no** permanent rule
that Big Pickle is the sole implementer. **Reviewer independence:** the designated independent
reviewer must never be the agent or context that implemented the candidate.

---

## 2. Milestone truth, program authorization, and documentation conflicts

Two of these correct the milestone model that a new agent is most likely to get wrong.

> ### ⚠️ MILESTONE TRUTH — READ BEFORE PLANNING ANY REPORT WORK
>
> **C4 Native Live Preview is APPROVED and FROZEN. C5 Native PDF/export migration is COMPLETE.**
>
> **UX6 is a post-approval report visual-quality refinement phase.** It is **not** a prerequisite for C5, **not** a re-run of the C4 acceptance gate, and **must never be described as reopening the original C4/C5 milestone sequence.**
>
> Any agent that believes C4 awaits visual approval, or that C5 is upcoming work, is operating on **stale assumptions** and must re-read §2.1 and §2.2 before proceeding.

### 2.1 C4 is approved and frozen — evidence

`Project.md`, *Current Project Status*:

> - C4 — Native Live Preview integration for all 17 reports (verified)
> - C4.1/C4.2 — visual-system, scale, runtime layout, and spacing refinements (verified)
> - **Manual C4 visual approval granted; Native approved as the sole production Live Preview renderer**
> - Post-C4 Native-only Live Preview cleanup: the Experimental and Legacy HTML preview paths removed from Live Preview
>
> Automated C1, C2, C3, C4, C4.1, C4.2, and C5 verification currently passes. C4, C5.2, and C5.3 have received manual approval.
>
> **Phase C is complete and frozen.**

`Project.md`, Milestone 4: *"Milestone 4 is complete. No Report Engine work remains outstanding."*

Independently reconfirmed at this baseline: `verify-checkpoint-c4.ts`, `c4-1.ts`, and `c4-2.ts` all PASS (§1.1, §14.1).

**What this means for UX6.** The Report Engine architecture freeze in `Project.md` states that future milestones *"may integrate with the Report Engine and fix defects in it"* while forbidding architecture redesign, a second composition path, or restored legacy infrastructure. UX6 operates **only** inside that defect-fix and bounded-refinement allowance, on output that is already approved. It produces refinement candidates, each of which needs its own approval on its own merits — it does not re-litigate the approval that already exists.

### 2.2 C5 is complete — evidence

`Project.md`, *Current Project Status*:

> - C5.1 — session-level multi-page Native PDF export sharing the Live Preview composition (verified)
> - C5.2 — manual Preview/PDF parity approval granted
> - C5.3 — transitional legacy PDF infrastructure removed (verified); manually approved

And, under *Preview, Print, and PDF Architecture*:

> **Native PDF migration is complete**: C5.1 implemented and verified, C5.2 parity manually approved, C5.3 legacy removal verified and manually approved.

**There is no pending C5 migration to gate, sequence, or prepare for.** No slice in this plan proposes PDF or export migration work. What remains relevant is preservation: **§15 records the UI/UX decisions the already-shipped Native PDF path depends on**, which no slice may break.

### 2.2.1 Anti-regression note for the continuing agent

Revision 1 of this document was written against a task brief that described C4 as awaiting visual approval and C5 as a future milestone gated behind it. **Both descriptions were stale.** The repository evidence in §2.1 and §2.2 is authoritative and was re-verified at revision 2. This subsection exists so the correction survives context compaction: if you find yourself planning "C4 approval" or "C5 migration," stop and re-read this section.

### 2.3 The UI/UX program is authorized. The `Project.md` deferral is superseded.

`Project.md`, *Deferred follow-ups*, still reads:

> A system-wide user-centered UI/UX review is deferred until the required application functionality is complete. … **This is not current milestone work.**

**That deferral has been lifted by explicit user direction.** The user has intentionally opened a **Whole-System User-Centered UI/UX Improvement Program**, stating that the system is functionally complete enough for this phase, which is to focus on: usability · visual hierarchy · consistency · speed · accessibility · keyboard efficiency · responsive behavior · error prevention · workflow clarity · professional clinical polish.

Two constraints travel with that authorization and bind every slice:

1. **Do not redesign working behavior purely for aesthetics.** A change must trace to a usability, accessibility, safety, speed, or consistency problem recorded in §5. "It would look better" is not a justification anywhere in this program.
2. **Repository authority still outranks the program.** Domain rules, role and security boundaries, completed snapshots, report contracts, and frozen behavior are unchanged and unnegotiable.

**`Project.md` is not modified by this document.** `CLAUDE.md` forbids modifying it automatically. Synchronizing `Project.md` to record the program and retire the deferral line is a **publication-boundary task requiring explicit user authorization**, and is listed per-slice under *Publication and documentation requirements* in §11.

### 2.4 `architecture/UI_ARCHITECTURE.md` contradicts the implementation in seven places.

It is listed as the UI specification but has drifted. Each row is a documentation-versus-implementation conflict, not a defect this plan silently resolves.

| # | `UI_ARCHITECTURE.md` says | Repository says |
|---|---|---|
| 1 | §2.2: brand tokens are `#093982` navy, `#1d5ea5` hover, `#ebf3fa` nav tint | `src/app/globals.css` defines `--color-primary: #0B6384` (teal), `--color-primary-hover: #084D68`, `--color-sidebar-active: #E8F3F6` |
| 2 | §2.2: application logo is `public/st-rose-logo.png` | `src/lib/constants.ts` and `src/rendering/model/types.ts` both pin `/st-rose-logo-official.png`; `Sidebar.tsx` uses it |
| 3 | §2.2: Preview switches to "template-specific color palette (CBC Red, Urinalysis Green…)" from `report_templates.color_palette` | `Project.md` freezes one Native teal visual system for all 17 reports; per-template palettes do not exist in the Native composer |
| 4 | §6.1: navigation guard on sidebar links, browser back, and tab close | No `beforeunload` handler and no router guard exist anywhere in `src/` |
| 5 | §6.2: `Tab`, `Enter`/`Down` advance, `Ctrl+S`, `Ctrl+P`, `Space`/arrows | Zero `keydown` handlers exist outside `components/ui/Modal.tsx` (Escape only) |
| 6 | §8.2: History shows "Expires in 18 days" retention countdown | `SessionHistoryView.tsx` renders no expiry column and no countdown |
| 7 | §4.2 route table: `/workspace` and `/history` "All Roles" | `requireOperationalCaller` in `server-actions.ts` denies **Developer** on both |

**Recommendation:** correct `UI_ARCHITECTURE.md` to describe implemented behavior as part of UX0's closeout, under explicit user authorization, since it is an `architecture/` authority file. Rows 4, 5, and 6 describe behavior that does not exist and that this plan proposes to *build* — those rows become accurate rather than corrected.

> **Standing rule — runtime behavior is the source of truth, not documentation.**
>
> Rows 4, 5, and 6 are the concrete proof: `UI_ARCHITECTURE.md` documents keyboard shortcuts (`Ctrl+S`, `Ctrl+P`, `Enter`/`Down` advance), an unsaved-navigation guard covering sidebar links, browser Back and tab close, and a History retention countdown — **none of which exist in the repository.** Revision 1 verified each by direct search rather than by reading the specification.
>
> **Never claim a capability exists because an architecture document says so.** Before relying on any documented behavior, confirm it in `src/` or in the running application. This rule applies to every slice in §11 and to every agent continuing this program.

---

## 3. Design read and the position of the advisory skills

Per the brief, the installed design skills were consulted **as advisory input only**.

**Skill-name note.** No installed skill is literally named "UI UX Pro Max" or "Taste". The two closest advisory design skills were used: `redesign-existing-projects` and `design-taste-frontend` (an anti-slop taste skill). Named-skill availability is a question for the user if specific skills were intended.

**Design read** (`design-taste-frontend` §0.B format):

> Reading this as: a **redesign-preserve** of an internal clinical laboratory result-management application, for two distinct audiences — high-volume laboratory encoders and administrative/technical operators — with a restrained clinical teal language, leaning toward the existing Tailwind v3 + CSS-variable brand-token system already in the repository.

**Dials** (`design-taste-frontend` §1, "trust-first / regulated" preset, adjusted for data-entry density):

| Dial | Value | Reason |
|---|---|---|
| `DESIGN_VARIANCE` | **3** | Regulated clinical tool. Predictability outranks visual interest. |
| `MOTION_INTENSITY` | **2** | Motion only where it explains a state change. `Project.md` and the brief both restrict it. |
| `VISUAL_DENSITY` | **7** | Workspace is a data-entry cockpit. Dashboard and secondary screens sit nearer 5. |

**`design-taste-frontend` declares itself out of scope for this application.** Its §13 states it is *"NOT for: Dashboards / dense product UI / admin panels … Data tables … Multi-step forms / wizards"* and instructs the agent to say so explicitly. That is the whole application. Accordingly, **only these parts of that skill were applied**: §4.5 interactive-state completeness, §4.6 form label and error placement, §6.B reduced motion, §6.F z-index restraint, §11 Redesign Protocol, and §14's accessibility checks. Its marketing-page material — hero rules, eyebrow counts, bento grids, marquees, scroll hijacking, image-generation requirements, serif-display guidance, glassmorphism — is **rejected as inapplicable and directly contrary to the brief's Avoid list**.

From `redesign-existing-projects`, the applicable items were: dead hover states, missing focus rings, `window.alert()` prohibition, tabular figures for numeric data, loading/empty/error state completeness, semantic HTML, z-index scale, and — most productively — its rule *"If the project uses Tailwind, check the version (v3 vs v4) before modifying config,"* which is exactly the defect found in F-01 below.

**Neither skill outranks anything.** Where a skill recommendation touches clinical meaning, report semantics, security boundaries, role permissions, frozen files, or completed snapshots, the repository wins without discussion.

---

## 4. Role capability matrix (derived from code, not invented)

This is the factual basis for UX1. **No new permission is proposed anywhere in this plan.**

| Capability | Source of truth | Admin | User | Developer |
|---|---|---|---|---|
| `/dashboard` | `checkRouteAccess` (`lib/auth-guards.ts`) — no role branch | ✅ | ✅ | ✅ |
| `/workspace` route | no page or layout guard (see F-06) | ✅ | ✅ | ✅ (renders) |
| Workspace **data** (templates, personnel, save, complete, replace) | `requireOperationalCaller` (`server-actions.ts`) | ✅ | ✅ | ❌ throws |
| `/history` route | no page guard | ✅ | ✅ | ✅ (renders) |
| History **data** (`listRecentSessionsAction`) | `requireOperationalCaller` | ✅ | ✅ | ❌ throws |
| Reopen / Replace a completed session | `findReopenableSessionForCaller` — **creator-only**, no Admin override | own only | own only | ❌ |
| `/users` | `checkRouteAccess` | ✅ | ❌ redirect | ✅ |
| `/personnel` route | `checkRouteAccess` | ✅ | ❌ redirect | ✅ |
| Personnel **read** | `requirePersonnelReader` | ✅ | ❌ | ✅ |
| Personnel **write** + signatures | `requirePersonnelAdmin` | ✅ | ❌ | ❌ |
| `/audit` | `checkRouteAccess` + `toAuditReaderRole` | ✅ | ❌ redirect | ✅ |
| `/developer/accounts` | `requireDeveloper` | ❌ | ❌ | ✅ |
| User-directory summary counts | `/api/users/summary` — *"allow any authenticated, active user"* | ✅ | ✅ | ✅ |
| Purge | `assertAdminAccess` on `POST /api/purge` | ✅ | ❌ | ❌ |

Two consequences that shape UX1:

1. **A Developer cannot load any patient or session data at all.** `requireOperationalCaller` throws for the `Developer` role. So a Developer dashboard must be built exclusively from the Developer-permitted surfaces — `developerDashboardService`, `auditReadService`, `/users`, `/personnel` (read), `/developer/accounts`. This is not a design preference; it is what the guards allow.
2. **Reopen/Replace is creator-only with no Admin override.** An Admin dashboard must not present "resume/replace any session" as an action, because the server will refuse it. `listRecentSessionsAction` already returns the server's `canReopen` decision per row; the dashboard must gate on that value exactly as `SessionHistoryView` does.

---

## 5. Findings inventory

Each finding carries file-level evidence. Severity: **B**locking (functional or accessibility defect), **I**mportant, **P**olish.

### 5.1 Shared foundation

**F-01 · B · 65 Tailwind utility classes render nothing.** The project pins `tailwindcss@3.4.19`. Tailwind v3's `boxShadow` scale is `sm, DEFAULT, md, lg, xl, 2xl, inner, none`; its `blur` scale has no `xs`; its spacing scale has no `0.2`. The codebase uses **v4** class names throughout:

| Class | Occurrences | Effect in v3 |
|---|---|---|
| `shadow-xs` | 43 | nothing |
| `shadow-2xs` | 15 | nothing |
| `backdrop-blur-xs` | 4 | nothing |
| `py-0.2` | 3 | nothing |

Every card, panel, sidebar, workspace header, tab, and button that intends subtle elevation is **completely flat**, and the workspace's sticky patient bar has no backdrop blur behind scrolling content. Verified by `node -e "require('tailwindcss/defaultTheme')"`. This single defect accounts for much of the "flat, unfinished" quality across the whole application, and it is the strongest justification for a UX0 slice existing at all.

**F-02 · I · The brand-token system is bypassed roughly 3:2.** Raw Tailwind palette utilities outnumber `brand-*` token utilities across `src/**/*.tsx`: `border-slate-200` (92), `bg-slate-100` (63), `bg-slate-50` (48), `text-slate-700` (40) … versus `brand-primary` (92), `brand-text` (76), `brand-text-muted` (69). Two documented tokens, `--color-decorative-pink` and `--color-accessible-rose`, have zero consumers.

**F-03 · B · Primary-action hover jumps from teal to blue.** `bg-brand-primary` is `#0B6384` (teal). Five call sites pair it with `hover:bg-blue-700` (`#1d4ed8`), a completely different hue — including the two most consequential buttons in the product:

- `GuidedWorkspace.tsx:596` — **Complete Session**
- `GuidedWorkspace.tsx:456`, `:811` — Save Draft & Exit
- `SharedRenderingEngine.tsx:152` — **Print Report**

**F-04 · B · Two files use a non-existent token, so their primary button has no hover state at all.** `app/error.tsx:37` and `components/common/GlobalErrorBoundary.tsx:59` use `hover:bg-brand-hover`. The token is `brand-primary-hover`. `brand-hover` is not in `tailwind.config.ts`, so the class compiles to nothing.

**F-05 · I · No shared primitives for the patterns the app actually needs.** `components/ui/` provides `Badge`, `Button`, `Card`, `Input`, `Modal`, `Select`, `Table`. Absent, and therefore hand-rolled repeatedly: **ConfirmDialog**, **Alert/Banner**, **EmptyState**, **Skeleton**, **Tooltip**, **StatusBadge** (clinical outcome), **Toast**. Consequences measured in the tree: `window.confirm` at 3 sites, `window.alert` at 5 sites, five independently written modal shells, five independently written empty states, six independently written loading states.

**F-06 · B · `/workspace` has no layout, therefore no shell and no layout-level auth redirect.** `src/app/(dashboard)/` contains only `workspace/`; there is **no `layout.tsx`** in that route group. `src/app/(app)/layout.tsx` is what performs `getCurrentUserProfile()` → `redirect("/login")` and mounts `AppShell`. Neither applies to `/workspace`. Two effects: the sidebar and header disappear when the user enters the highest-frequency screen in the product, and the route has no layout-level session redirect. *Data* access is still fully guarded by `requireOperationalCaller` on every action, so this is a navigation-consistency and unauthenticated-render defect, **not** a data-exposure defect. See §11 UX3 for the constrained fix.

**F-07 · I · Type scale bottoms out far below comfortable reading.** Body text is `text-xs` (12px) system-wide, including table cells and every form input. Below that: `text-[11px]` × 48, `text-[10px]` × 34, `text-[9px]` × 3, plus `text-[9.5px]` and `text-[8.5px]` in `ExaminationCatalog.tsx`. Combined with low-opacity colors such as `text-slate-400/90` and `text-indigo-600/90` on white, several of these fail WCAG AA contrast. This is an all-day clinical tool.

**F-08 · P · Four unrelated radius scales.** `rounded-md` (72), `rounded-lg` (71), `rounded-xl` (60), `rounded-2xl` (16), with no rule governing which applies where. `rounded-2xl` appears only inside `DeveloperDashboardSection.tsx`.

**F-09 · I · `Modal` is not accessible.** `components/ui/Modal.tsx` has `role="dialog"` and `aria-modal`, and closes on Escape — but no focus trap, no focus restore on close, no initial focus, and a **hardcoded `aria-labelledby="modal-title"`** that produces duplicate DOM ids if two modals ever mount together.

**F-10 · I · Only 31 `aria-*` attributes and 10 `htmlFor` associations exist in the entire application.** Every workspace encoding input and every demographics field is labelled by a sibling `<span>` or a `<label>` with no `htmlFor`, so no input has a programmatic accessible name.

### 5.2 Dashboard

**F-11 · B · All three roles receive the same administrative dashboard.** `DashboardView.tsx` renders `WelcomeBanner` → `SummaryCards` → `QuickActions` for every role, and appends `DeveloperDashboardSection` for Developer only. There is no branch for `User` and none for `Admin`. Concretely, a Laboratory User sees:

- a banner reading *"Result Management System **administrative workspace**. Access account management, view operational metrics, and manage user access controls."* (`WelcomeBanner.tsx`)
- four statistic cards: Total Users, Active Users, Inactive Users, Administrators (`SummaryCards.tsx`)
- a panel titled **"Administrative Operations"** whose only two actions link to `/users` — a route `checkRouteAccess` **redirects that user away from** (`QuickActions.tsx`)

**F-12 · B · The Laboratory User dashboard offers no route into laboratory work.** There is no link to `/workspace`, no draft list, no recent activity, no resume affordance. The single fastest path to the product's core task is the sidebar link.

**F-13 · I · The two dashboard actions a Laboratory User is shown are both dead ends.** Both `QuickActions` buttons target `/users`, which redirects `User` to `/dashboard?error=unauthorized` — and no code anywhere reads that `error` query parameter, so the user is bounced back to the dashboard **with no explanation at all**.

**F-14 · I · The Developer dashboard is Admin dashboard + Developer section, with duplicated data.** `DeveloperDashboardSection` is genuinely role-appropriate and well-built, but it is *appended below* the administrative block. "Total Users" is therefore rendered twice on one page — once in `SummaryCards`, once in "Real System Statistics" — from two different call paths.

**F-15 · P · The Admin dashboard has no laboratory or personnel awareness.** It shows account counts only. It surfaces nothing about laboratory throughput, nothing about the Personnel Directory the Admin exclusively manages, nothing about signature coverage, and nothing about recent security denials, despite the Admin holding audit-read authority via `toAuditReaderRole`.

**F-16 · I · `DashboardView` fetches the entire visible user directory to compute four integers.** `userService.getUsersVisibleTo(role)` returns full `User` records and the view then does four `.filter().length` passes. `getUserSummaryVisibleTo` exists and is already used by `/api/users/summary`. Note that exposing these aggregates to a Laboratory User is *deliberate* — `/api/users/summary` carries the comment *"Summary is intended for the Dashboard; allow any authenticated, active user."* So this is a **product-relevance** finding, not a security finding: the counts are aggregate-only and intentionally visible. UX1 removes them from the `User` composition because they answer no question that user has.

**F-17 · P · Version string disagreement.** `SYSTEM_CONSTANTS.APP.VERSION` is `"2.0.0"`; `WelcomeBanner.tsx` hardcodes `v1.0.0`; `Sidebar.tsx` hardcodes `Version 1.0.0 — Baseline`; `package.json` is `0.1.0`.

### 5.3 Workspace

**F-18 · B · The encoding surface is capped at 1280px on a full-screen layout.** `GuidedWorkspace.tsx:640` sets `max-w-7xl` on `<main>` inside a `h-screen w-screen` root. On a 1920px workstation, ~640px is dead gutter; after the fixed `w-[280px]` catalog, the encoding pane is ~950px regardless of monitor width. This is the direct answer to the brief's "poor use of horizontal space" question.

**F-19 · B · `w-screen` causes horizontal overflow.** `GuidedWorkspace.tsx:427` and `:478` use `w-screen`, which is `100vw` and *includes* the vertical scrollbar width on Windows/Chromium. The root is wider than the viewport.

**F-20 · B · Complete Session is irreversible and has no confirmation.** `handleCompleteSession` (`GuidedWorkspace.tsx:334`) runs on a single click. It allocates the accession number (the laboratory's external record identifier), freezes the completed snapshot, and starts the 30-day retention anchor. Its only guards are two blocking checks for patient name and sex.

**F-21 · B · Replace Completed Report is destructive and has no confirmation.** `handleReplaceSession` (`GuidedWorkspace.tsx:365`) runs on a single click. Under ADR-006 the prior report content is **deliberately unrecoverable**. A banner explains this; nothing confirms it. This is the single highest-consequence unconfirmed action in the product.

**F-22 · B · Zero keyboard shortcuts exist.** A repository-wide search for `onKeyDown`, `keydown`, `ctrlKey`, and `metaKey` across `src/**/*.{ts,tsx}` returns exactly one match outside `Modal.tsx`. `Ctrl+S` (Save Draft), `Ctrl+P` (Preview), and `Enter`/`Down` field advance — all specified in `UI_ARCHITECTURE.md` §6.2 — are unimplemented. For an operator encoding a 20-parameter CBC, every field advance is a `Tab` or a mouse move.

**F-23 · B · No unsaved-work guard on browser navigation.** No `beforeunload` handler exists. `handleBackToDashboard` guards only the in-app button. Closing the tab, hitting browser Back, or clicking any external link discards unsaved encoding silently. The `sessionStorage` recovery module explicitly does **not** cover this: it restores only on a Navigation-Timing `reload`, and *clears* on `navigate`.

**F-24 · B · Examination tabs are not keyboard reachable.** In `SelectedReportsPanel.tsx:139` each tab is a `<div onClick>` with no `tabIndex`, no `role="tab"`, no `aria-selected`, and a nested `<button>` inside it. The same pattern appears on catalog rows in `ExaminationCatalog.tsx:225`. A keyboard-only operator cannot switch reports.

**F-25 · I · The active-report tab strip scrolls away.** `SelectedReportsPanel` is rendered *inside* the scrolling encoding pane (`GuidedWorkspace.tsx:731`), below the demographics card. Scrolling to the results loses the tab strip, the session progress, and the per-report completion meter simultaneously.

**F-26 · I · The parameter-selection checkbox is deliberately removed from the tab order.** `ParameterRow.tsx:57` sets `tabIndex={-1}`. This is a considered trade-off — it keeps `Tab` flowing through result inputs — but it leaves no keyboard route to deselect a parameter. A modifier-key alternative is needed rather than simply restoring it into the tab order, which would double every operator's keystroke count.

**F-27 · I · Validation is a single global banner at the top of a long scroll.** `validationError` is one string in `GuidedWorkspace` rendered at `:624`. "Patient Name is required before completing session." appears at the top of the page while the operator may be 2000px down at the signatory section, with no scroll-to-field and no field highlight. Per-parameter validation *is* well placed (`ParameterRow` renders `validationMessage` with `role="alert"` directly under its control) — the gap is session-level.

**F-28 · I · The "Confirm ✓" signatory control does nothing.** `SignatorySelectionSection.tsx:196` sets local `isConfirmed` state only. It is never persisted, never read by completion validation, and never leaves the component. It presents as a clinical sign-off acknowledgement and is inert. Combined with signatories being **auto-populated** from `suggestedSignatoryProvider` with no empty option in the `<select>`, an operator can complete a report carrying a Pathologist they never chose. **This needs a product decision (§16.5), not a unilateral fix.**

**F-29 · I · The signatory section is the last thing on every report form.** `DynamicResultForm.tsx` stacks Requested By → additional fields → all parameters → repeatable findings → kit info → remarks → signatories in one card. For CBC the operator scrolls past ~20 parameter rows to reach it, on every report, in every session.

**F-30 · I · Internal architecture vocabulary is exposed to laboratory staff.** The renderer family (`Tabular`, `SimpleResult`, `DiagnosticGrid`, `NarrativeCertificate`) is rendered as a badge on every catalog row (`ExaminationCatalog.tsx:253`) and on every open tab (`SelectedReportsPanel.tsx:152`). It carries no operational meaning for an encoder.

**F-31 · I · Native browser dialogs.** `window.confirm` in `SelectedReportsPanel.tsx:51` ("Clear All Examinations"), `UserManagementView.tsx:121`, `DeveloperAccountManagementView.tsx:98`. `window.alert` × 4 in `UserManagementView.tsx` and once in `SharedRenderingEngine.tsx:66` for PDF export failure. Unbranded, unstyled, and unusable for anything asynchronous.

**F-32 · I · Cramped hit targets.** Every demographics field and every encoding control is `px-2.5 py-1 text-xs` — roughly 24px tall with 12px text. Demographics labels are `text-[10px]` uppercase bold. This is below comfortable target size for sustained mouse-driven entry.

**F-33 · P · The sticky patient context bar only appears once a name is typed.** `GuidedWorkspace.tsx:706` gates it on `session.demographics.fullName`. A fresh session has no persistent context header at all.

**F-34 · P · Three nested scroll containers in Preview mode.** `<main class="overflow-hidden">` → preview card `overflow-y-auto` → `SharedRenderingEngine`'s viewport `max-h-[calc(100dvh-16rem)] overflow-auto`. Wheel events land unpredictably.

**F-35 · P · No session-level progress.** `DynamicResultForm` shows a per-report `completedCount/selectedResults` meter. Nothing shows "3 of 5 reports complete" for the visit as a whole.

### 5.4 Live Preview and report-facing UI (application chrome, not the document)

**F-36 · B · The preview toolbar speaks in architecture terms.** `SharedRenderingEngine.tsx:131` titles the toolbar **"Shared Rendering Engine — Preview & Export Target"**; the PDF button reads **"Export PDF Stream"**. Neither is language a medical technologist has any use for.

**F-37 · B · The disabled Print button looks enabled.** `SharedRenderingEngine.tsx:152` sets `disabled={!isAccessionAssigned}` but its className carries **no** `disabled:` variant, while the adjacent PDF button at `:163` does carry `disabled:opacity-50`. Before the session is saved, Print appears fully active and silently does nothing.

**F-38 · I · Two competing primary colors in one toolbar.** Print is `bg-brand-primary` (teal); Export PDF is `bg-emerald-600`. Both are presented as primary.

**F-39 · I · A developer provenance strip renders above every previewed report.** `NativeLivePreviewPage.tsx:39` emits *"Preview mode: Native · Composition source: StandardNative · Layout family: StandardAdaptiveTabular"* on every page. It is `no-print`, so it never reaches the document — but it is on screen for every user, every preview.

  **This strip is pinned by verifier assertions and cannot simply be deleted.** `verify-checkpoint-c4-1.ts:207` and `verify-checkpoint-c4-2.ts:216`/`:232` assert its visible presence, the latter with the message *"manual provenance must remain visible."* Per `CLAUDE.md`, evading a textual verifier is prohibited; the fix must happen at the real boundary. The strip's purpose was to support the **manual C4/C5.2 visual approval** — approval that `Project.md` records as **granted**. Retiring it is therefore a defensible authority decision, but it is the user's decision. See §16.5.

**F-40 · P · Text primitives are silently clipped in the DOM preview.** `NativeReportPreview.tsx` applies `whiteSpace: "nowrap"` + `overflow: "hidden"` to every text primitive. `text-layout.ts` throws on genuinely unwrappable text, so this is pre-validated, but any residual divergence between the DOM preview and the jsPDF exporter would fail silently on screen rather than visibly.

### 5.5 History

**F-41 · I · Search searches only the 50 rows already fetched.** `listRecentSessionsAction({ limit: 50 })` is called once; `filteredEntries` filters that array client-side. Searching for the 51st-oldest accession returns nothing, indistinguishably from "no such record."

**F-42 · I · The empty state is wrong when the query is empty.** `SessionHistoryView.tsx:142` always renders *"No patient report sessions found matching query ''"*, including on a genuinely empty directory.

**F-43 · I · No retention countdown, despite retention being the defining constraint of this screen.** `expiresAt` is on the aggregate and drives the server-side retention filter. Nothing on screen tells a user a report disappears in three days. `UI_ARCHITECTURE.md` §8.2 specifies exactly this.

**F-44 · I · The preview modal is bespoke and inaccessible.** `SessionHistoryView.tsx:230` hand-rolls the overlay: no `role="dialog"`, no Escape handler, no focus trap, no focus restore. It also nests three scroll containers.

**F-45 · P · Loading is a bare text line, not a skeleton,** even though `app/(app)/history/loading.tsx` already defines a proper skeleton for the route-level load.

**F-46 · P · No sorting, no pagination, no column controls** on the primary record-retrieval screen.

### 5.6 Auth, navigation, secondary screens

**F-47 · B · Three auth screens reference the deleted legacy logo and render a broken image.** `src/app/login/page.tsx:86`, `src/features/auth/components/FirstLoginForm.tsx:54`, and `src/features/auth/components/ForgotPasswordForm.tsx:81` all request `src="/st-rose-logo.png"`. That asset was **intentionally deleted by the user** and is gone from disk; `public/st-rose-logo-official.png` is the sole branding source of truth. These are the only three legacy references in `src/` and `scripts/`. **Confirmed defect** — full evidence and the correction boundary are in §1.2.1; the fix is slice **UX0-B** (§11).

**F-48 · B · The official logo is rendered inside a filled teal square.** `app/login/page.tsx:82` wraps the 28×28 image in `bg-brand-primary rounded-xl`. The official asset is `1254×1254` PNG **colorType 2 — RGB with no alpha channel**. It cannot render transparently, so it appears as a white square inside a teal square. Verified by reading the PNG IHDR directly.

**F-49 · I · The official logo is a 1.3 MB, 1254×1254 PNG.** `Sidebar.tsx` renders it via `next/image` at 44px, so the application shell is optimized. The **PDF exporter embeds the raw bytes**, adding ~1.3 MB to every exported report. Not a UI defect; recorded for §15.

**F-50 · I · Developer sees Session Workspace and Completed History in the sidebar and cannot use either.** `config/navigation.ts` sets no `requiredRole` on `/workspace` or `/history`. Both routes render, then every data action throws `"This role is not authorized to access patient or report-registry data."` `Project.md` states Developer *"holds no routine operational or administrative write privileges and no routine patient or report access."*

**F-51 · I · `?error=unauthorized` is written by three guards and read by nothing.** `checkRouteAccess` and `requireDeveloper` both redirect to `/dashboard?error=unauthorized`. No component reads `error` from `useSearchParams`. Denied navigation is completely silent.

**F-52 · P · The header shows a permanently hardcoded "System Ready" badge.** `Header.tsx:47`. It reflects no actual state.

**F-53 · P · `app/error.tsx` renders raw `error.message` to the user** under the heading "Application Exception".

**F-54 · P · The `/workspace` loading skeleton does not match the screen it precedes.** `app/(dashboard)/workspace/loading.tsx` draws a 2:1 grid inside `h-[calc(100vh-4rem)]`, assuming an app-shell header the route does not have (F-06); the real layout is a 280px rail plus a flexible pane.

**F-55 · P · `src/rendering/**` is absent from `tailwind.config.ts` `content`.** Rendering primitives use inline mm-based styles today, so nothing is currently purged — but any future Tailwind class added under `src/rendering/` will be silently stripped.

**Positive finding, and the model to standardize on.** `PersonnelDirectoryView`, `PersonnelForm`, `PersonnelTable`, and `PersonnelFormModal` (the P1/P2/P3 work) consistently use the shared `Button`, `Input`, `Select`, and `Table` primitives, keep server actions in a dedicated non-pinned file, and separate `canManage` from render. **UX0 should generalize this screen's conventions rather than invent new ones.**

---

## 6. Official logo usage policy

**`public/st-rose-logo-official.png` is the SOLE branding source of truth.** 1254×1254, PNG colorType 2 (RGB, **no alpha**), 1,305,200 bytes, SHA-256 `b0ec751196ad3b1b1c648c16df8aef7fcacb8b74785ecd30bd6daac84db342a4`.

**`public/st-rose-logo.png` is intentionally deleted and is retired permanently.** The deletion is the user's, is authorized, and stands. It is **not** a defect and **not** something to reverse.

**Rules — binding on every slice and every agent.**

1. **Never restore or recreate `st-rose-logo.png`.** Not by `git checkout`, not by copying the official asset to that name, not by any other route.
2. **Never generate, synthesize, or substitute an alternate logo.** No AI-generated mark, no SVG redraw, no placeholder, no recolored variant, no "temporary" stand-in.
3. **Never replace, recolor, crop, or distort the official asset.**
4. **Never composite it onto a colored fill.** It has no alpha channel and will render as a white block (F-48).
5. **Preserve the 1:1 aspect ratio** at every application placement.
6. Restrained and professional, never decorative or oversized.

Only two files may ever appear as a logo source in this codebase: `/st-rose-logo-official.png` (application and report), and nothing else.

| Surface | Current | Target |
|---|---|---|
| Login / First-login / Forgot-password | **broken** — `/st-rose-logo.png` (deleted) at 28px inside a teal filled square | Official asset, 40–48px, **on the card surface with no colored backing plate**, above the wordmark. **Slice UX0-B.** |
| Sidebar brand header | Official asset at `h-11` (44px) — **correct today** | Unchanged. This is the reference implementation. |
| Header | absent | **Stays absent.** The sidebar already carries brand; repeating it is noise. |
| Dashboard | absent | **Stays absent.** `WelcomeBanner` already names the laboratory in text. |
| Workspace bespoke header | absent | Add a **20–24px** mark beside "Back to Dashboard" **only if** UX3 keeps the workspace outside the shell. If UX3 brings the workspace into the shell, the sidebar covers it and nothing is added. |
| Live Preview toolbar | absent | **Stays absent.** The report page below it already carries the letterhead logo; duplicating it in chrome competes with the document. |
| Report document (Native) | 21 × 15 mm box, `fit: "contain"`, `failurePolicy: "Error"` | **Frozen.** Aspect handling reviewed in §14 as a polish candidate only. |

**No new logo placement is proposed for the dashboard, header, or preview toolbar.** The brief asks for restraint; three placements (auth, sidebar, report letterhead) is the restrained answer.

---

## 7. Dashboard architecture decision

**Recommendation: shared primitives with role-specific composition. Not three duplicated dashboards, and not one dashboard with scattered `role ===` ternaries.**

```
src/features/dashboard/
  components/
    DashboardView.tsx            ← thin router: resolve role, render one composition
    compositions/
      AdminDashboard.tsx
      LaboratoryUserDashboard.tsx
      DeveloperDashboard.tsx     ← wraps the existing DeveloperDashboardSection
    primitives/
      DashboardSection.tsx       ← titled region, consistent spacing
      MetricTile.tsx             ← compact number + label; NOT a 128px card
      ActionList.tsx             ← task shortcuts with icon, label, description
      ActivityList.tsx           ← timestamped row list
      SessionRow.tsx             ← accession · patient · tests · status · action
```

`DashboardView` stays a Server Component, resolves `currentUserProfile.role`, and renders exactly one composition. Each composition fetches only what its own role is permitted to fetch. Unknown or unexpected roles fall through to the most restrictive composition.

### Common to all three roles

Identity and orientation only: who you are, what role you hold, and one honest system-state indicator (replacing the hardcoded "System Ready" of F-52). Nothing else is universal.

### Administrator

Answers *"what needs my attention as the operator of this laboratory?"* Built only from Admin-permitted sources.

| Element | Data source | Permitted? |
|---|---|---|
| Laboratory activity today — completed / draft counts | `listRecentSessionsAction` | ✅ `requireOperationalCaller` admits Admin |
| Recent completed sessions (5 rows), Preview action, Replace **only where `canReopen`** | same | ✅ creator-only gate already returned per row |
| Personnel Directory shortcut + active Pathologist / MedTech counts | `listPersonnelAction` | ✅ `requirePersonnelReader` |
| Pathologists **without** a signature on file | `listPersonnelAction` (`signatureImageUrl` is absent from client schemas — **derive a boolean server-side, never expose the URL**) | ✅ with the constraint |
| Recent `SecurityDenial` events (3 rows) → `/audit` | `auditReadService.readPage` | ✅ `toAuditReaderRole` admits Admin |
| User-account summary — **one compact tile row, not four large cards** | `getUserSummaryVisibleTo` | ✅ |
| Shortcuts: Personnel · User Management · Audit Logs · History | — | ✅ |

**Hidden from Admin:** Developer technical monitoring, Supabase health, `/developer/accounts`.

### Laboratory User

Answers *"what do I work on next?"* Task-first, administratively silent.

| Element | Data source | Permitted? |
|---|---|---|
| **Primary action: Start New Patient Session** → `/workspace` | — | ✅ |
| **My unfinished drafts** — accession or "Not assigned", patient, tests, last updated, **Resume** | `listRecentSessionsAction`; drafts are already owner-scoped server-side | ✅ |
| Recently completed by me, with **Preview** and **Replace** gated on `canReopen` | same | ✅ |
| **Expiring soon** — completed sessions nearing the 30-day retention edge | derived from `expiresAt` | ✅ |
| Today's encoding count | derived from the same list | ✅ |
| Shortcuts: Workspace · History | — | ✅ |

**Hidden from Laboratory User:** every user-account statistic, "Administrative Operations", any link to `/users`, `/personnel`, `/audit`, or `/developer/accounts`, and all system-health telemetry. This removes the F-13 dead ends by construction.

### Developer

Answers *"is the system healthy and what happened?"* Constrained hard by the fact that `requireOperationalCaller` **denies Developer all patient and session data**.

| Element | Data source | Permitted? |
|---|---|---|
| Supabase health, response time, last check | `developerDashboardService` | ✅ existing |
| Application / DB / Auth / API status | same | ✅ existing |
| Technical info — app, environment, Next.js, DB provider, session | same | ✅ existing |
| System statistics — users, personnel, audit entries, laboratory results (**counts only**) | same | ✅ existing |
| Recent audit activity → `/audit` | `auditReadService` | ✅ `toAuditReaderRole` |
| Shortcuts: Audit Logs · Developer Accounts · User Management · Personnel (read-only) | — | ✅ |

**Hidden from Developer:** every administrative *operational* framing, the `WelcomeBanner` "administrative workspace" copy, `QuickActions`, and the duplicated `SummaryCards` "Total Users" tile (F-14) — "Real System Statistics" already carries it.

**No Admin-only information is exposed to Developer for the sake of differentiation.** Every Developer element above already exists and already renders for Developers today.

### Reuse and retirement

| Component | Disposition |
|---|---|
| `DeveloperDashboardSection` | **Reuse as-is.** Genuinely role-appropriate. |
| `DeveloperDashboardSkeleton` | Reuse; generalize into the shared `Skeleton` primitive. |
| `WelcomeBanner` | Rewrite: role-appropriate copy, honest status, drop hardcoded `v1.0.0`. |
| `SummaryCards` | **Retire as a four-card row.** Its data survives in the Admin composition as one compact tile row. |
| `QuickActions` | **Retire.** Replaced by per-role `ActionList`. |

**Anti-goal, restated from the brief:** no statistic exists to fill space. Every tile must answer *"what do I need to know or do next?"* — and if it cannot, it is not built.

---

## 8. Workspace target layout

The current structure is a fixed 280px catalog rail plus one scrolling column that stacks demographics → tab strip → one very tall form card, capped at 1280px. The proposal keeps that architecture and fixes what makes it slow.

**Fixed frame, three scroll regions maximum:**

```
┌──────────────────────────────────────────────────────────────────────────┐
│ SESSION BAR (fixed, ~52px)                                               │
│ [←] ACCESSION · Status · Replacement badge │ PATIENT · sex · age         │
│                            [Encoding|Preview] [Save Draft] [Complete ▸]  │
├────────────┬─────────────────────────────────────────────────────────────┤
│ CATALOG    │ REPORT TAB STRIP  (sticky, always visible)                  │
│ (rail,     │ [CBC 12/20] [Urinalysis ✓] [CHEM_10 0/10] [+]  ·  3 of 5    │
│  scroll)   ├─────────────────────────────────────────────────────────────┤
│            │ DEMOGRAPHICS (collapsible; auto-collapses once valid)       │
│  Search    ├─────────────────────────────────────────────────────────────┤
│  ▸ Hema    │ PARAMETER GRID  (the only tall scroll region)               │
│  ▸ Chem    │  Parameter          Result      Unit   Ref        Status    │
│  ▸ Sero    │  ─────────────────────────────────────────────────────────  │
│  ▸ Micro   │                                                             │
│            ├─────────────────────────────────────────────────────────────┤
│            │ SIGNATORIES · REMARKS · KIT  (docked footer, collapsible)   │
└────────────┴─────────────────────────────────────────────────────────────┘
```

Changes and the finding each closes:

1. **Remove `max-w-7xl` from `<main>`; use a fluid container with a sane cap (~1680px) and let the parameter grid take the width.** — F-18
2. **Replace `w-screen` with `w-full`.** — F-19
3. **Make the tab strip sticky at the top of the encoding pane**, carrying per-report completion and a session-level "N of M reports complete" counter. — F-25, F-35
4. **Dock signatories, remarks, and kit info into a collapsible footer region** rather than appending them after every parameter. — F-29
5. **Make demographics collapsible**, auto-collapsing once required fields are valid, with a persistent one-line summary. — F-33
6. **Confirm both irreversible actions** through a shared `ConfirmDialog`: Complete Session states that the accession will be assigned and the report frozen; Replace Completed Report states that prior content is permanently unrecoverable and requires deliberate confirmation. — F-20, F-21
7. **Session-level validation resolves to the offending field**: the error list scrolls to and focuses the field and marks it inline; the global banner becomes a summary with jump links, not the only signal. — F-27
8. **Keyboard model** — F-22, F-24, F-26:
   - `Ctrl/Cmd+S` → Save Draft (no-op in Replacement Mode, which has no draft path)
   - `Ctrl/Cmd+Enter` → Complete / Replace, **opening the confirm dialog, never submitting directly**
   - `Enter` and `ArrowDown` in a result input → commit and focus the next selected parameter's control
   - `ArrowUp` → previous
   - `Ctrl/Cmd+ArrowLeft/Right` → previous / next report tab
   - Tab strip becomes a real `role="tablist"` with roving `tabIndex`, `aria-selected`, and Left/Right arrow navigation
   - `Alt+Space` on a focused result input toggles that parameter's selection, **keeping the checkbox out of the tab order** (F-26's trade-off preserved)
   - `Ctrl+P` is **deliberately excluded** — `Project.md` carries an open, separately-scheduled item on encoding-mode `Ctrl+P` print suppression. Do not touch it here.
9. **`beforeunload` guard** when `isDirty`, plus an in-app router guard for sidebar and link navigation. — F-23
10. **Density and readability**: raise result inputs to a ~32px control height with 13–14px tabular-figure text; raise demographics labels off `text-[10px]`; keep the parameter grid compact but legible. — F-32, F-07
11. **Drop the renderer-family badge** from tabs and catalog rows. — F-30
12. **Replace `window.confirm` on Clear All Examinations** with `ConfirmDialog`. — F-31
13. **Flatten Preview mode to one scroll container.** — F-34
14. **Wrap the Workspace in a compact icon-rail shell** rather than leaving it outside the application shell entirely. **User-approved at revision 2** — see below. Delivered in **UX3**, sequenced after UX2-A. — F-06

### 8.1 Compact Workspace shell — approved direction

The Workspace currently renders with **no shell at all**: `src/app/(dashboard)/` has no `layout.tsx`, so the sidebar and header vanish the moment an operator enters the highest-frequency screen in the product (F-06).

**The user has approved planning a compact Workspace-specific shell / icon-rail variant**, with these goals stated directly:

- persistent navigation;
- role-aware access;
- minimal horizontal footprint;
- maximum room for result encoding;
- **no unnecessary full-size administrative sidebar inside the Workspace**.

Target shape: a narrow (~56–64px) icon-only rail carrying the same role-filtered `navigationConfig` items as the full sidebar, with an accessible name on every control, and **no standard `Header`** — the Workspace's own session bar already carries identity, accession, status, and the primary actions. The administrative `AppShell` is unchanged everywhere else; the rail is an *additional* variant, not a replacement.

This is approved **for planning only**. Implementation is UX3 (§11), which also carries the `(dashboard)/layout.tsx` auth redirect, the role-aware navigation filter, and the `no-print` requirement on the rail.

**Explicit non-goals.** Do not convert the Workspace into a wizard. Do not introduce a modal-driven encoding flow. Do not change parameter ordering, reference resolution, evaluation outcomes, suffix rendering, computed-field behavior, or any registry-driven behavior. Do not add abnormal indicators to CBC. Do not touch accession allocation, retention, ownership, or Replacement Mode semantics. **Do not resolve either signatory decision gate** (§16.5 items 5 and 6) — relocating the signatory section is presentation only.

---

## 9. Frozen boundaries — the constraint set every slice inherits

**Byte-frozen. Do not modify under any circumstances.**

| File | Pin |
|---|---|
| `src/features/auth/authActions.ts` | SHA-256 `982bc087…` (`verify-checkpoint-m6c.ts:359`) |
| `src/lib/login-rate-limit.ts` | SHA-256 `46f04f20…` (`verify-checkpoint-m6c.ts:387`) |
| `src/lib/auth-guards.ts` | must equal Milestone 6B content (`m6c.ts:347`) **and** baseline `5eac3f7` (`verify-personnel-directory.ts:140`, `verify-personnel-signatures.ts:239`) |
| `src/lib/password.ts`, `src/lib/username.ts`, `src/lib/first-login-gate.ts`, `src/lib/session.ts` | must equal Milestone 6B content |
| `src/features/server-boundary/server-actions.ts` | baseline `5eac3f7` (`verify-personnel-directory.ts:144`, `verify-personnel-signatures.ts:243`) **and** B5 order pin (`verify-checkpoint-b5.ts:582`) |

**Two consequences that Big Pickle must internalize:**

1. **`checkRouteAccess` cannot be changed.** Any role-aware navigation must be implemented in `config/navigation.ts`, in `NavigationMenu`, or in a **new** guard module — never by editing `auth-guards.ts`.
2. **`server-actions.ts` cannot be changed.** Any new dashboard server action goes in a **new file**, following the established `src/features/server-boundary/personnel-actions.ts` precedent. Do not add, reorder, or reformat anything in `server-actions.ts`.

**Shape-pinned by `verify-checkpoint-m6c.ts` — editable, but the pinned patterns must survive verbatim:**

`src/app/login/page.tsx`, `src/app/login/layout.tsx`, `src/features/auth/components/FirstLoginForm.tsx`, `src/features/auth/components/ForgotPasswordForm.tsx`, `src/app/first-login/recovery/page.tsx`, `src/middleware.ts`, `src/app/api/purge/route.ts`, `src/app/api/users/[id]/route.ts`, `src/features/server-boundary/action-inputs.ts`, and the listed repositories and services.

For the auth forms specifically, these must remain identical in shape: the `showPassword` / `showAnswer` state declarations; `type={showPassword ? "text" : "password"}`; both `aria-label` ternaries; and the `className="relative"` … `className="pr-10"` … `<button type="button"` … `absolute right-3 top-1/2 -translate-y-1/2` visibility-button structure. **The logo `src` and the surrounding card markup are not pinned and may be changed.**

> **⚠️ Correction added at revision 3 — `src/app/login/page.tsx` is pinned by TWO verifiers, not one.**
>
> `scripts/verify-lockout-countdown.ts` reads `src/app/login/page.tsx` at line 20 and asserts **8** further conditions on it (lines 104–148), independently of M6C. Revision 2 named only M6C and was incomplete.
>
> Any slice touching the login page must run **both** `verify-checkpoint-m6c.ts` **and** `verify-lockout-countdown.ts`. The complete assertion inventory is enumerated in §17.4.

**Frozen by `Project.md`, not by a verifier:**

Report semantics; authoritative `formattedValue` and `referenceDisplay`; no CBC abnormal indicators; declared report titles only; HIV signatory order Examiner → Verifier → Pathologist; standard order Pathologist → Medical Technologist; completed-snapshot authority with no render-time clinical recomputation; A4 geometry `210 × 297 mm` at ~15 mm margins; content bottom limit `148.5 mm`; preview scales 75% and 100% only; no page numbers; the single Native composition path shared by Preview, Print, and PDF.

**Security boundaries that no UI change may weaken:** `requireOperationalCaller`, `requirePersonnelReader`, `requirePersonnelAdmin`, `requireDeveloper`, `assertAdminAccess`, the creator-only reopen predicate, the authenticated private signature proxy, retention enforcement in both application and transaction layers, and every audit writer's event shape.

**Never expose `signatureImageUrl` to any client schema.** P3 deliberately keeps it out. Derive a boolean server-side if the Admin dashboard needs signature coverage.

---

## 10. Slice sequence

> ### ✅ AUTHORIZED OPENING SEQUENCE (revision 3)
>
> ```
> Planning publication → UX0-B Branding → UX0-A Tailwind/token → UX0-C Primitives
>   → UX1 Dashboard → UX2 Workspace → UX3 Shell/Nav → UX4 Secondary → UX5 Consistency → UX6 Reports
> ```
>
> **UX0-B now runs first.** This supersedes revision 2, which opened with UX0-A.

### 10.0 Why UX0-B moved to the front

The user's direction, and the repository evidence supporting it:

> *"Because the legacy logo deletion is intentional and three live auth screens still reference the deleted asset, close that known broken branding state before beginning the general Tailwind cleanup."*

The reasoning holds on the evidence:

1. **It is the only *currently broken* thing in the program.** Every other UX0 finding is a quality defect — flat shadows, a wrong hover hue, missing primitives. F-47 is a **runtime failure**: three screens request an asset that does not exist and render a broken image. Broken beats ugly in the queue.
2. **It is on the first screens any user sees**, including on a shared laboratory workstation, before authentication.
3. **It closes a working-tree state rather than leaving it open.** The intentional deletion currently has no matching code change. UX0-B is what makes the deletion *complete*, and the deletion is **included in the UX0-B commit** (§17.9). Running UX0-A first would publish a token-cleanup commit on top of a knowingly broken branding state.
4. **The dependency it appeared to have on UX0-A was cosmetic, not functional.** Revision 2 sequenced UX0-B after UX0-A "so the corrected card surfaces render with real elevation." That is a nice-to-have, not a requirement: the auth cards render correctly today, merely flat. Nothing in UX0-B needs a working `shadow-xs`. **The dependency is dropped.**
5. **Publishing UX0-B first gives UX0-A a clean baseline.** UX0-A is a wide, mechanical, whole-codebase sweep; it is easier to review and to attribute regressions when it lands on a tree with no known broken state.

**UX0-A is unchanged in content** — the same six mechanical corrections, still grep-verifiable, still no redesign. Only its position moved.

**UX0-C follows UX0-A** unless dependency inspection justifies running it in parallel. It shares no file with UX0-A (config plus eight components versus five new files plus `Modal.tsx`) and no verifier, so parallel execution is safe if reviewer capacity allows. **Dashboard and Workspace redesign stay out of UX0-C.**

### 10.1 Why UX0 is split three ways

**UX0 is not optional.** F-01 (65 dead utility classes), F-03 and F-04 (broken hover states), and the absence of `ConfirmDialog`, `Alert`, `EmptyState`, and `Skeleton` primitives mean UX1 and UX2 would each re-solve the same problems locally.

Revision 1 bundled the branding correction with the shared primitives. It is split because the three have different risk profiles and different regression boundaries:

| Sub-slice | Files | Frozen surface | Reviewer |
|---|---|---|---|
| **UX0-B — authoritative-logo branding** | **exactly 3 auth files** | **M6C + lockout-countdown pinned** | **yes** |
| UX0-A — token correctness | config + 8 unpinned components | none | no |
| UX0-C — shared primitives + Modal a11y | 5 new files + `Modal.tsx` | none | no |

Bundling UX0-B into UX0-A would drag two verifier gates and a mandatory independent reviewer onto an otherwise clean mechanical sweep. Bundling it into UX0-C would attach the same overhead to five brand-new files that touch nothing frozen. Isolated, UX0-B is a three-file, single-purpose slice whose entire risk surface is three pinned auth components — the smallest coherent boundary available. Its full frozen contract is **§17**.

### 10.2 Authorized sequence table

| # | Slice | Title | Depends on | Risk | Reviewer required? |
|---|---|---|---|---|---|
| 0 | *(publication)* | Planning publication — this document | — | — | — |
| 1 | **UX0-B** | **Authoritative-logo branding correction** — frozen contract in §17 | *(none)* | Low–Med | **Yes** (two pinned verifiers on the auth files) |
| 2 | **UX0-A** | Tailwind v3 utility correction + token discipline | UX0-B published | Low | No |
| 3 | **UX0-C** | Shared primitives: ConfirmDialog, Alert, EmptyState, Skeleton, StatusBadge; Modal accessibility | UX0-A *(may parallel)* | Low | No |
| 4 | **UX1-A** | Dashboard primitives + role-composition scaffold; Developer composition | UX0-C | Low | No |
| 5 | **UX1-B** | Laboratory User dashboard (new read-only action file) | UX1-A | **Medium–High** | **Yes** (new server-boundary surface) |
| 6 | **UX1-C** | Administrator dashboard | UX1-B | Medium | **Yes** (audit + personnel reads) |
| 7 | **UX2-A** | Workspace layout frame, width, sticky tabs, docked footer | UX0-C | Medium | No |
| 8 | **UX2-B** | Workspace safety: confirm dialogs, `beforeunload`, validation focus | UX2-A | **High** | **Yes** (guards irreversible clinical actions) |
| 9 | **UX2-C** | Workspace keyboard and focus model | UX2-B | Medium | No |
| 10 | **UX3** | Application shell + **compact Workspace icon-rail shell**, role-aware nav, denial feedback | UX2-A | **Medium–High** | **Yes** (route-group + nav visibility) |
| 11 | **UX4-A** | History: retention countdown, empty states, skeleton, accessible preview modal | UX0-C | Low–Med | No |
| 12 | **UX4-B** | Users / Developer Accounts: replace `window.alert` / `confirm`, adopt primitives | UX0-C | Low | No |
| 13 | **UX5** | Cross-system accessibility, responsive, focus, contrast pass | UX1–UX4 | Medium | No |
| 14 | **UX6** | Post-approval Native report visual refinement (§14) | UX5 + §16.5 ruling | **High** | **Yes** (frozen report boundary) |

**Next slice: UX0-B.** Its frozen implementation contract is **§17**, ready to be lifted verbatim into a delegation prompt. **It must not be implemented until the user approves that contract.**

**Then UX0-A**, on the clean baseline UX0-B leaves behind.

**Then UX0-C**, or in parallel with UX0-A if reviewer capacity allows — they share no file and no verifier.

### 10.3 Why the repoint is its own slice, not part of UX0-A

Three pieces of repository evidence:

1. **The repoint is not a mechanical string swap.** `src/app/login/page.tsx:82` wraps the image in `bg-brand-primary rounded-xl` — a filled teal plate. The official asset is `colorType 2`, RGB with **no alpha channel** (F-48). Changing only the `src` would render an opaque white square inside a teal square: a *visibly wrong* result, arguably worse than the broken image it replaces. A correct fix must repoint the source **and** remove the backing plate **and** correct the sizing. That is a branding correction, not a token correction, and does not fit UX0-A's "mechanical class-name fix" charter.
2. **All three files are pinned — by two verifiers.** `verify-checkpoint-m6c.ts` asserts markup patterns in all three; `verify-lockout-countdown.ts` asserts eight further conditions on `login/page.tsx`. Editing any of them requires both gates plus a fresh independent reviewer. UX0-A touches **none** of these files and needs **no** reviewer. Merging the repoint into UX0-A would convert a clean mechanical sweep into a frozen-file slice.
3. **The regression boundaries are disjoint.** UX0-A's blast radius is the compiled CSS across every screen. UX0-B's is three auth screens. Kept separate, a regression in either is immediately attributable.

Isolating UX0-B also keeps UX0-C — five brand-new primitive files plus `Modal.tsx`, none of them pinned — free of any frozen-file gate.

---

## 11. Slice specifications

Every slice carries the full record below. **Common to all slices, without exception:**

- Do not commit. Do not push. Leave everything in the working tree.
- Do not modify `Project.md`, any migration, or any Supabase configuration.
- Do not modify any file in §9's byte-frozen list.
- **Do not restore, recreate, or substitute `public/st-rose-logo.png`.** Its deletion is intentional and permanent (§1.2, §6).
- Classify the working tree before freezing: the intentional logo deletion and this plan artifact are expected; anything else is a hard stop.
- Verify `HEAD` and `origin/main` against §16.1 before starting.

---

### UX0-A · Tailwind v3 utility correction and token discipline

**Objective.** Make the intended visual system actually render, and stop the divergence between the token system and raw palette utilities. A bounded mechanical correction — **not a redesign**.

**User problem.** The application looks flat and unfinished. Elevation intended on cards, panels, buttons, the sidebar, and the workspace header is not drawn at all, and two of the most consequential buttons in the product change hue on hover.

**Affected roles.** All.

**Repository-grounded current behavior.** `package.json` pins `tailwindcss@^3.4.1`; the installed version is `3.4.19`. Tailwind v3's `boxShadow` scale is `sm, DEFAULT, md, lg, xl, 2xl, inner, none`; its `blur` scale has no `xs`; its spacing scale has no `0.2`. The codebase uses **v4** names: `shadow-xs` ×43, `shadow-2xs` ×15, `backdrop-blur-xs` ×4, `py-0.2` ×3 — all compile to nothing. `hover:bg-blue-700` sits on `bg-brand-primary` (teal `#0B6384`) at 5 sites including Complete Session and Print Report. `hover:bg-brand-hover` names a token absent from `tailwind.config.ts` at 2 sites. `src/rendering/**` is absent from the `content` globs.

**Intended behavior.** Define the missing scale in `tailwind.config.ts` — `theme.extend.boxShadow` gaining `xs` and `2xs`, `theme.extend.backdropBlur` gaining `xs` — so the 62 existing class names become real, rather than rewriting 62 call sites. Correct `py-0.2` to `py-0.5`. Correct every `hover:bg-blue-700` on a brand-primary background, and both `hover:bg-brand-hover`, to `hover:bg-brand-primary-hover`. Add `src/rendering/**` to `content`. Tint the new shadows toward the brand hue rather than pure black.

**Exact likely files.** `tailwind.config.ts`; `src/app/error.tsx`; `src/components/common/GlobalErrorBoundary.tsx`; `src/features/workspace/GuidedWorkspace.tsx`; `src/rendering/SharedRenderingEngine.tsx`; `src/features/workspace/components/ExaminationCatalog.tsx`; `src/features/workspace/components/SelectedReportsPanel.tsx`; `src/features/workspace/components/TemplateRemarksSection.tsx`; `src/features/workspace/components/SignatorySelectionSection.tsx`.

**Reusable components.** None consumed. This slice makes the existing token system function.

**Authority / frozen boundaries.** None touched. Confirm by hash that no file in §9 moved. Does **not** touch the three auth files (that is UX0-B).

**Explicit non-goals.** No new colors. No layout change. No component restructuring. No typography scale change (UX5). No Tailwind upgrade. No `--color-*` value change in `globals.css`. Do not remove `--color-decorative-pink` or `--color-accessible-rose`; unused tokens are not a defect worth a frozen-token debate.

**Implementation constraints.** Extend the theme, never replace it. Stay on Tailwind 3.x. Shadow values must be defined so existing markup needs no edit.

**Dependencies.** **UX0-B published** (revision 3 sequencing, §10.0). UX0-A lands on the clean baseline UX0-B leaves behind.

**Deterministic verification.** `tsc --noEmit`; `next lint`; `next build`; `verify-checkpoint-c4.ts`, `c4-1.ts`, `c4-2.ts` — **invoked without `--conditions=react-server`** (§16.6). Plus greps: `py-0\.2` → 0; `hover:bg-brand-hover` → 0; no `bg-brand-primary` element retaining `hover:bg-blue-*`; `src/rendering/**` present in `content`; and each of `shadow-xs`, `shadow-2xs`, `backdrop-blur-xs` locatable as a generated rule in the build CSS.

**Manual browser acceptance.** Before/after at 1440px on Dashboard, History, Personnel, and Workspace, showing elevation now rendering and primary hover remaining teal.

**Keyboard acceptance.** No regression: focus rings still visible on `Button`, `Input`, `Select`.

**Responsive acceptance.** 1280 / 1440 / 1920 on the four screens above; confirm newly-drawn shadows introduce no layout shift.

**Accessibility acceptance.** No text/background pair loses contrast. Focus indicators unchanged or improved.

**Mutation / adversarial verification.** Not required. No security assertion is added or changed, and the build-CSS grep is a direct positive observation rather than an inference.

**Independent review.** **Not required.** Claude reads the diff hunks directly.

**Publication and documentation requirements.** None beyond the slice report. Do **not** modify `Project.md`. If the user later authorizes a `Project.md` synchronization for the program, UX0-A is recorded there as the first landed slice.

**Regression risks.** Newly-rendering shadows may expose spacing that previously read as flat — adjust spacing, never remove the shadow. Adding `src/rendering/**` to `content` widens the CSS scan; confirm build time is unaffected.

---

### UX0-B · Authoritative-logo branding correction

**Objective.** Repoint the three remaining legacy-logo references to the sole authoritative asset and correct their presentation, closing F-47 without recreating or substituting any logo.

**User problem.** The login, first-login, and forgot-password screens — the first three screens any user sees, including on a shared laboratory workstation — request an asset that no longer exists and render a broken image.

**Affected roles.** All (pre-authentication).

**Repository-grounded current behavior.** Verified at revision 2:

```
src/app/login/page.tsx:86                              src="/st-rose-logo.png"
src/features/auth/components/FirstLoginForm.tsx:54     src="/st-rose-logo.png"
src/features/auth/components/ForgotPasswordForm.tsx:81 src="/st-rose-logo.png"

ls public/st-rose-logo.png           → No such file or directory
ls public/st-rose-logo-official.png  → present, 1,305,200 bytes
```

These are the only three legacy references in `src/` and `scripts/`. `src/lib/constants.ts` (`LOGO_PATH`), `src/rendering/model/types.ts` (`CANONICAL_REPORT_LOGO_SOURCE`), and `src/components/layout/Sidebar.tsx` already use the official asset correctly. Additionally, `login/page.tsx:82` wraps the 28×28 image in `bg-brand-primary rounded-xl` — a filled teal plate behind an asset with **no alpha channel** (F-48).

**Intended behavior.** All three references resolve to `/st-rose-logo-official.png`. The teal backing plate is removed so the opaque asset sits directly on the card surface. The mark renders at 40–48px, 1:1 aspect preserved, above the "St. Rose / Diagnostic Laboratory" wordmark. `alt` text describes the laboratory. `Sidebar.tsx` remains the reference implementation and is **not** touched.

**Exact likely files.** `src/app/login/page.tsx`; `src/features/auth/components/FirstLoginForm.tsx`; `src/features/auth/components/ForgotPasswordForm.tsx`. **Three files. Nothing else.**

**Reusable components.** `Card` / `CardHeader` (already in use on these screens). Mirror `Sidebar.tsx`'s `next/image` usage as the same-layer precedent.

**Authority / frozen boundaries.** ⚠️ **All three files are shape-pinned by `verify-checkpoint-m6c.ts`.** These patterns must survive verbatim:

- the `showPassword` / `showAnswer` state declarations;
- `type={showPassword ? "text" : "password"}` and the answer-field equivalent;
- both `aria-label` ternaries (`"Hide password"` / `"Show password"`, `"Hide recovery answer"` / `"Show recovery answer"`);
- the `className="relative"` … `className="pr-10"` … `<button type="button"` … `absolute right-3 top-1/2 -translate-y-1/2` visibility-button structure.

The logo `<Image>` element and its immediate wrapper are **not** pinned and are the only things this slice may change. `authActions.ts` and `login-rate-limit.ts` are byte-frozen and must not be opened.

**Explicit non-goals.**

- **Do not recreate `public/st-rose-logo.png`.** The deletion is intentional and stays.
- **Do not introduce any alternate or generated logo**, in any format, even temporarily.
- Do not change auth logic, validation, error copy, the lockout countdown, or any form field.
- Do not restyle the login form controls; that is UX5.
- Do not touch `Sidebar.tsx` or any report-side logo usage.
- Do not add a logo anywhere it is not already present.

**Implementation constraints.** Confirm every pinned regex in `verify-checkpoint-m6c.ts` still matches **before** running any gate. Because the official asset has no alpha, it must never be placed on a colored fill. Keep `next/image` with an explicit `width`/`height` at 1:1 and `priority` on the login route.

**Dependencies.** **None.** Revision 2 sequenced this after UX0-A so the auth cards would render with real elevation; that was cosmetic, not functional, and the dependency is **dropped** (§10.0). UX0-B is the opening implementation slice. **Its frozen contract is §17 and must be approved by the user before delegation.**

**Deterministic verification.** `verify-checkpoint-m6c.ts` — **run first**, before any other gate. Then `tsc --noEmit`; `next lint`; `next build`; `verify-personnel-directory.ts` and `verify-personnel-signatures.ts` (both pin `auth-guards.ts` and `server-actions.ts`; confirm neither moved). Plus the closing grep: `grep -rn "st-rose-logo\.png" src/ scripts/ | grep -v official` → **0 results**.

**Manual browser acceptance.** All three screens — `/login`, `/first-login/password`, `/forgot-password` — at 375px and 1440px, each showing the official mark rendering correctly with **no white box and no teal plate**. Confirm no broken-image placeholder and no 404 for `/st-rose-logo.png` in the network panel on any of the three.

**Keyboard acceptance.** Password and recovery-answer visibility toggles remain keyboard reachable and correctly labelled on all three screens. Tab order through each form is unchanged.

**Responsive acceptance.** 375 / 768 / 1440. The mark scales without distortion and does not crowd the wordmark at 375px.

**Accessibility acceptance.** `alt` describes the laboratory rather than saying "logo". Contrast of the card surface behind the mark is unchanged. Both pinned `aria-label` pairs still present.

**Mutation / adversarial verification.** Not required — no security assertion is added or changed. **One negative control is required instead:** confirm the closing grep can actually fail, by running it against the pre-change tree and observing it report the three references. A grep that cannot report the condition it claims to detect proves nothing.

**Independent review. REQUIRED** (`AGENTS.md` §5.4 — frozen boundary). Three pinned auth files, covered by **two** verifiers. Reviewer may be Codex or Big Pickle / OpenCode in a fresh context; the only disqualifier is having implemented the candidate. Full packet and reviewer questions: §17.10.

**Publication and documentation requirements.** On landing, `architecture/UI_ARCHITECTURE.md` §2.2 row 2 becomes correctable (it still names `public/st-rose-logo.png` as the application logo) — but **only under explicit user authorization**, since it is an `architecture/` authority file. Bundle that correction with the UX0 closeout described in §2.4 rather than doing it inside this slice. Do not modify `Project.md`.

**Regression risks.** The dominant risk is breaking an M6C shape pin while editing an auth file — hence M6C runs first. Second risk: leaving the teal plate in place while changing only the `src`, which produces a white square and looks worse than the broken image it replaced.

---

### UX0-C · Shared primitives and Modal accessibility

**Objective.** Supply the five primitives the application keeps re-implementing, and make `Modal` accessible.

**User problem.** Destructive confirmations use unbranded browser dialogs. Errors arrive via `window.alert`. Empty and loading states differ on every screen. Modals trap no focus.

**Affected roles.** All.

**Repository-grounded current behavior.** `components/ui/` provides only `Badge`, `Button`, `Card`, `Input`, `Modal`, `Select`, `Table`. Absent and hand-rolled repeatedly: ConfirmDialog, Alert/Banner, EmptyState, Skeleton, StatusBadge. Measured consequences: `window.confirm` at 3 sites, `window.alert` at 5 sites, five independently written modal shells, five independently written empty states, six independently written loading states. `Modal.tsx` has `role="dialog"` and `aria-modal` and closes on Escape, but has no focus trap, no initial focus, no focus restore, and a hardcoded `aria-labelledby="modal-title"` that duplicates DOM ids if two modals mount together.

**Intended behavior.** Add `ConfirmDialog`, `Alert`, `EmptyState`, `Skeleton`, and `StatusBadge`, all built on existing `brand-*` tokens and following `PersonnelDirectoryView`'s conventions. `ConfirmDialog` supports a `destructive` variant, an in-flight state, and a required-confirmation mode. `Modal` gains a focus trap, initial focus, focus restore on close, and a `React.useId()`-generated `aria-labelledby`.

`Skeleton` must support **dimension-preserving** usage — callers specify the box the real content will occupy — because the governing rule in §13.1 is that a skeleton causes **no layout shift** when replaced. It carries `aria-busy` on its container and does not animate under `prefers-reduced-motion`. It is **not** the mechanism for button-scoped waits; `Button` already has `isLoading` for those (§13.1).

**Exact likely files.** New: `src/components/ui/ConfirmDialog.tsx`, `Alert.tsx`, `EmptyState.tsx`, `Skeleton.tsx`, `StatusBadge.tsx`. Modified: `src/components/ui/Modal.tsx`.

**Reusable components.** Build on `Button`, `Badge`, `Card`. `DeveloperDashboardSkeleton` is the shape reference for `Skeleton`. `ParameterRow`'s outcome badge is the semantic reference for `StatusBadge`.

**Authority / frozen boundaries.** None. No file in §9 is touched. No auth file is opened.

**Explicit non-goals.** **Do not migrate any existing call site in this slice** — `window.confirm` and `window.alert` removal is UX2-B and UX4-B. Do not change the workspace, history, users, or dashboard screens. Do not add a toast system (no current call site needs one).

**Implementation constraints.** The focus trap must be plain DOM; **add no dependency**. `StatusBadge` must express the existing clinical outcome language exactly — `Pending`, `Entered`, `Normal`, `High`, `Low`, `Abnormal`, `Invalid` — without inventing a new state or changing any mapping.

**Dependencies.** UX0-A. May run in parallel with UX0-A if reviewer capacity allows — they share no file and no verifier. **Dashboard and Workspace redesign stay out of this slice.**

**Deterministic verification.** `tsc --noEmit`; `next lint`; `next build`.

**Manual browser acceptance.** A scratch harness route is not required; mount each primitive once in an existing screen's storybook-free dev check, or verify on first adoption in UX2-B / UX4-B. Confirm `Modal`'s focus behavior on the existing `ChangePasswordModal` and `PersonnelFormModal`, which already consume it.

**Keyboard acceptance.** Tab cycles inside an open `Modal` and cannot escape it. Escape closes and returns focus to the trigger. `ConfirmDialog` opens with focus on the **safe** action.

**Responsive acceptance.** `Modal` and `ConfirmDialog` at 375 / 768 / 1440; content scrolls inside the dialog, never the page body.

**Accessibility acceptance.** `role="dialog"` + `aria-modal` + a unique `aria-labelledby`. `ConfirmDialog` destructive variant uses `role="alertdialog"` with the consequence text inside the accessible description. `Alert` uses `role="alert"` for errors and `role="status"` for info. `EmptyState` heading is a real heading element. `Skeleton` sets `aria-busy` on its container, is not announced as content, and renders static under `prefers-reduced-motion`.

**Loading-state acceptance (§13.1).** `Skeleton` accepts caller-specified dimensions and preserves them, so replacing it with real content produces **no layout shift** — verify at one adoption site by comparing the skeleton box to the settled content box. `Button.isLoading` remains the mechanism for button-scoped waits; confirm `Skeleton` is **not** introduced for any button-scoped action in this slice.

**Mutation / adversarial verification.** Not required — no security assertion is involved.

**Independent review.** **Not required.** New unpinned files plus one unpinned primitive.

**Publication and documentation requirements.** None. `Project.md` untouched. The primitive inventory in §13 becomes accurate on landing and may be updated in this document.

**Regression risks.** `Modal` is already consumed by `ChangePasswordModal`, `PersonnelFormModal`, `UserPasswordResetModal`, and `DeveloperAccountFormModal`. A focus-trap bug can lock keyboard users inside a modal — test Escape on **every** existing consumer, not just the new primitives.
---

### UX1-A · Dashboard primitives and role-composition scaffold

**Objective.** Replace the single shared dashboard with a role-composition router plus shared primitives, and land the Developer composition first (it needs no new data access).

**User problem.** Every role sees an administrative dashboard.

**Affected roles.** All; Developer's output changes in this slice.

**Current behavior.** `DashboardView.tsx` renders `WelcomeBanner`, then `SummaryCards`, then `QuickActions` unconditionally, appending `DeveloperDashboardSection` for Developer. `getUsersVisibleTo` fetches full records to compute four integers.

**Intended behavior.** `DashboardView` becomes a thin role router over three compositions. Add `DashboardSection`, `MetricTile`, `ActionList`, `ActivityList`, `SessionRow` primitives. `DeveloperDashboard` wraps the existing `DeveloperDashboardSection`, drops `WelcomeBanner`'s administrative copy, drops `QuickActions`, and drops the duplicated Total Users tile. `AdminDashboard` and `LaboratoryUserDashboard` land as **minimal scaffolds** reproducing today's behavior for their role, filled in by UX1-B and UX1-C.

**Likely files.** New under `src/features/dashboard/components/{compositions,primitives}/`. Modified: `DashboardView.tsx`, `WelcomeBanner.tsx`. Later retired: `SummaryCards.tsx`, `QuickActions.tsx`.

**Reusable components.** `DeveloperDashboardSection`, `DeveloperDashboardSkeleton`, `Card`, `Badge`, `Button`, and the UX0-C primitives.

**Frozen boundaries.** None. Do not open `auth-guards.ts`; read the role from the profile `DashboardView` already receives.

**Non-goals.** No new data source. No new server action. No permission change.

**Implementation constraints.** Compositions stay Server Components. An unrecognized role falls through to the most restrictive composition. Replace `getUsersVisibleTo` with `getUserSummaryVisibleTo` where counts are all that is needed.

**Dependencies.** UX0-C.

**Acceptance criteria.**
1. `DashboardView` contains no presentational markup beyond composition selection.
2. Developer sees no `QuickActions` and exactly one "Total Users" figure.
3. Admin and User dashboards render without error at parity with today.
4. `tsc`, `lint`, `build` PASS.

**Keyboard checks.** Every dashboard shortcut is reachable and activates with Enter.

**Responsive checks.** 375 / 768 / 1024 / 1440 / 1920 for all three compositions.

**Accessibility checks.** One `<h1>` per dashboard; sections use `<section>` with an accessible name; `MetricTile` numbers are not the sole meaning-bearer.

**Regression risks.** Losing Developer telemetry through a mis-wired Suspense boundary. Keep the existing `<Suspense fallback={<DeveloperDashboardSkeleton />}>` shape.

**Deterministic gates.** `tsc`; `lint`; `build`; `verify-developer-boundary.ts`; `verify-admin-invariants.ts`.

**Manual browser acceptance.** Sign in as each of Admin, User, Developer and screenshot `/dashboard`.

**Independent review.** Not required.

**Publication and documentation requirements.** None beyond the slice report. `Project.md` untouched. On landing, §7 and §12 of this plan become the accurate description of the Developer dashboard.

---

### UX1-B · Laboratory User dashboard

**Objective.** Give the Laboratory User a dashboard that starts and resumes laboratory work.

**User problem.** The daily operator's dashboard shows account statistics and two links to a page they are not allowed to open, and offers no route into the Workspace.

**Affected roles.** User (primary); Admin inherits the same components in UX1-C.

**Current behavior.** F-11, F-12, F-13.

**Intended behavior.** Per §7's Laboratory User table: primary "Start New Patient Session" action; my unfinished drafts with Resume; recently completed by me with Preview and Replace gated on `canReopen`; expiring-soon list derived from `expiresAt`; today's encoding count; Workspace and History shortcuts. Zero administrative content.

**Likely files.** New: `src/features/server-boundary/dashboard-actions.ts`; `src/features/dashboard/components/compositions/LaboratoryUserDashboard.tsx`.

**Reusable components.** `SessionRow`, `ActionList`, `MetricTile`, `EmptyState`, `Skeleton`, `StatusBadge`.

**Frozen boundaries.** 🚨 **`src/features/server-boundary/server-actions.ts` is baseline-pinned at `5eac3f7` by two verifiers and order-pinned by B5. The new action MUST live in a new file.** Follow the `personnel-actions.ts` precedent exactly. `auth-guards.ts` is likewise off limits.

**Non-goals.** No new permission. No Admin override on reopen. No client-side ownership decision — `canReopen` comes from the server and is rendered, never recomputed. No change to `listRecentSessionsAction`.

**Implementation constraints.** The new action must apply the same authorization `server-actions.ts` applies through `requireOperationalCaller`, and must reuse the existing repository ownership scoping rather than writing a new predicate. It is **read-only**: no writes, no audit emission beyond any `SecurityDenial` the existing guard already produces. It must not leak drafts belonging to other users; draft scope is already owner-only in the repository and must not be widened. It must not allocate an accession or touch a session.

**Dependencies.** UX1-A.

**Acceptance criteria.**
1. A `User` sees no user-account statistics, no "Administrative Operations", and no link to `/users`, `/personnel`, `/audit`, or `/developer/accounts`.
2. "Start New Patient Session" reaches `/workspace` with no `sessionId`.
3. Drafts listed are the caller's own only.
4. Replace/Edit renders **only** where the server returned `canReopen === true`.
5. A `Developer` reaching the new action is refused server-side.
6. Empty states render correctly for a user with no drafts and no completed sessions.
7. `tsc`, `lint`, `build` PASS.

**Keyboard checks.** Tab order runs primary action, then drafts, then completed, then shortcuts. Every row action is a real button, activating on Enter and Space.

**Responsive checks.** 375 / 768 / 1440. Session rows must reflow, not overflow horizontally.

**Accessibility checks.** Session lists are real lists or tables with headers. Status is conveyed by text plus color, never color alone. Accession numbers use tabular figures.

**Regression risks.** The chief risk is the new action drifting from the existing authorization shape. It must not re-implement ownership logic — it must delegate to the same repository path History uses.

**Deterministic gates.** `tsc`; `lint`; `build`; `verify-checkpoint-b5.ts` (proves `server-actions.ts` order pin intact); `verify-personnel-directory.ts` and `verify-personnel-signatures.ts` (prove the `5eac3f7` hash pins intact); `verify-developer-boundary.ts`.

**Manual browser acceptance.** As `User`: dashboard with drafts, dashboard with none, resume a draft into the Workspace. As a **second** `User`: confirm the first user's drafts are absent and Replace is withheld on a non-owned completed session. As `Developer`: confirm refusal.

**Independent review. REQUIRED.** New server-boundary surface reading patient session data. Packet: the new action file in full, the existing `requireOperationalCaller` and `listRecentSessionsAction` as same-layer precedent, the repository ownership-scoping function, the composition's `canReopen` gate, and the `personnel-actions.ts` precedent.

**Publication and documentation requirements.** The new action file is a **new server-boundary surface** and must be recorded as such. On landing, add it to the server-boundary inventory that `architecture/SECURITY_MODEL.md` and `architecture/personnel-backend/` already use for `personnel-actions.ts`, under explicit user authorization. `Project.md` synchronization for the UI/UX program is a publication-boundary task requiring separate authorization (§2.3); do not perform it inside this slice.

---

### UX1-C · Administrator dashboard

**Objective.** Give the Admin an operational-oversight dashboard built only from Admin-permitted sources.

**User problem.** The Admin dashboard shows four account-count cards and two links, and nothing about the laboratory, the personnel directory, or security events.

**Affected roles.** Admin.

**Current behavior.** F-11, F-15, F-16.

**Intended behavior.** Per §7's Administrator table.

**Likely files.** `src/features/dashboard/components/compositions/AdminDashboard.tsx`; possibly an extension to `dashboard-actions.ts` from UX1-B.

**Reusable components.** Everything from UX1-A and UX1-B, plus `auditReadService` and `listPersonnelAction`.

**Frozen boundaries.** `server-actions.ts` and `auth-guards.ts` unchanged. **`signatureImageUrl` must never reach a client schema** — derive `hasSignature: boolean` server-side.

**Non-goals.** No Admin override on session reopen. No new audit category. No new audit event. No purge trigger from the dashboard. No Developer telemetry for Admin.

**Implementation constraints.** Audit reads must pass through `toAuditReaderRole` and `auditReadService.readPage`, never a direct repository call. Personnel reads go through `listPersonnelAction`, which already carries `requirePersonnelReader`. Recent security denials must show event type and time only — **no target identifiers, no accession numbers, no patient data** — matching the existing `SecurityDenial` `details: { reasonCode }` discipline.

**Dependencies.** UX1-B.

**Acceptance criteria.**
1. Admin sees laboratory activity, recent sessions, personnel summary, signature-coverage count, recent denials, a compact account-summary tile row, and role-appropriate shortcuts.
2. Replace/Edit renders only where `canReopen === true`; an Admin cannot reopen another user's session from the dashboard.
3. No `signatureImageUrl` value appears in any client payload — proven by inspecting the serialized RSC payload.
4. Denial rows carry no patient or accession identifier.
5. A `User` reaching any new Admin-only read is refused server-side.
6. `tsc`, `lint`, `build` PASS.

**Keyboard checks.** All sections and row actions reachable in a logical order.

**Responsive checks.** 375 / 768 / 1024 / 1440 / 1920.

**Accessibility checks.** Section headings form a correct hierarchy. Denial rows are not conveyed by color alone.

**Regression risks.** Leaking a signature URL or patient identifier into a dashboard payload. Presenting Replace on a session the server will refuse.

**Deterministic gates.** `tsc`; `lint`; `build`; `verify-personnel-directory.ts`; `verify-personnel-signatures.ts`; `verify-developer-boundary.ts`; `verify-admin-invariants.ts`; `verify-checkpoint-m6d.ts`.

**Manual browser acceptance.** As `Admin`, verify every panel against live data and confirm Replace appears only on own sessions. As `User`, confirm refusal of any Admin-only read.

**Independent review. REQUIRED.** Audit-read and personnel-read surfaces plus a signature-adjacent derivation.

**Publication and documentation requirements.** Record the derived `hasSignature` boolean and its server-side derivation wherever P3 signature handling is documented, so no later agent reintroduces `signatureImageUrl` into a client schema. Under explicit user authorization only. `Project.md` untouched.

---

### UX2-A · Workspace layout frame

**Objective.** Fix width, overflow, and the loss of context on scroll.

**User problem.** Encoding is squeezed into ~950px on a 1920px workstation; the report tabs and progress disappear the moment the operator scrolls to the results.

**Affected roles.** Admin, User.

**Current behavior.** F-18, F-19, F-25, F-29, F-33, F-34.

**Intended behavior.** Per §8 items 1–5 and 13.

**Likely files.** `src/features/workspace/GuidedWorkspace.tsx`; `src/features/workspace/components/{SelectedReportsPanel,PatientDemographicsForm,DynamicResultForm}.tsx`; `src/app/(dashboard)/workspace/loading.tsx`.

**Reusable components.** `Card`, `Badge`, `StatusBadge`, `EmptyState`, `Skeleton`.

**Frozen boundaries.** Do not change `report-encoding.ts`, `evaluate-encoding-result.ts`, `reference-display.ts`, the definition registry, `session-transport.ts`, or `workspace-recovery.ts`. Do not alter any `data-*` attribute that a verifier reads — `data-encoding-report`, `data-encoding-input`, `data-control-type`, `data-parameter-row`, `data-parameter-selector`, `data-reference-display`, `data-fixed-suffix`, `data-status-column`, `data-validation-message`, `data-control-column`.

**Explicit non-goals.** No change to parameter order, evaluation, references, suffixes, or computed fields. No confirmation dialogs (UX2-B). No keyboard model (UX2-C). No change to accession, retention, ownership, or Replacement Mode logic.

> #### 🔒 BLOCKING DECISION GATE — signatory semantics are frozen for this slice
>
> UX2-A **relocates** the signatory section into the docked footer. It changes **presentation only**. Two open domain questions travel with it, and **both are frozen until the user rules** (§16.5 items 5 and 6):
>
> **Gate A — the inert `Confirm ✓` control.** `SignatorySelectionSection.tsx:196` sets a local `isConfirmed` boolean. It is never persisted, never read by completion validation, and never leaves the component. It presents as a clinical sign-off acknowledgement and does nothing.
>
> **Gate B — auto-populated signatories with no unselected state.** Signatories are pre-filled from `suggestedSignatoryProvider`, and the Pathologist `<select>` has **no empty option**. An operator can therefore complete a report carrying a Pathologist they never actively chose.
>
> **This slice must not, under any circumstance:**
> - wire the `Confirm ✓` control to anything;
> - remove the `Confirm ✓` control;
> - change completion or validation rules;
> - alter signatory persistence, ordering, or the `report_signatories` shape;
> - add, remove, or reorder any `<select>` option, including an empty one;
> - change any report semantic.
>
> Move the section. Restyle it within the existing token system. **Change no behavior.** Gate B in particular may affect real laboratory workflow and requires a frozen decision before any implementation touches it.

**Implementation constraints.** `SelectedReportsPanel` becomes sticky within the encoding pane, not fixed to the viewport. The docked footer must collapse to inline stacking below `lg`. `w-screen` becomes `w-full`. The `max-w-7xl` cap is raised, not removed entirely, to keep line lengths sane. Relocating `SignatorySelectionSection` must preserve its existing sibling-button structure — the accordion header and the Confirm action are deliberately siblings, never nested, because a nested button caused a React hydration failure that was fixed in commit `e48967a`.

**Dependencies.** UX0-C.

**Acceptance criteria.**
1. No horizontal scrollbar at 1280 / 1440 / 1920.
2. The parameter grid uses the available width at 1920 with no dead gutter beyond the container cap.
3. The report tab strip and session progress remain visible while scrolling the parameter grid.
4. Signatories, remarks, and kit info are reachable without scrolling past all parameters.
5. Preview mode has exactly one vertical scroll container.
6. All listed `data-*` attributes are unchanged.
7. `tsc`, `lint`, `build` PASS.

**Keyboard checks.** Tab order remains demographics, tabs, parameters, footer sections. No focus trap introduced by sticky elements.

**Responsive checks.** 375 / 768 / 1024 / 1280 / 1440 / 1920. Below `lg`, the catalog drawer still opens and the footer stacks inline.

**Accessibility checks.** Sticky elements must not obscure a focused element — apply `scroll-margin-top` matching the sticky height.

**Regression risks.** Sticky headers overlapping focused inputs. Collapsible demographics hiding a field that fails validation — UX2-B must auto-expand the section on error.

**Deterministic gates.** `tsc`; `lint`; `build`; `verify-checkpoint-b4.ts`; `verify-checkpoint-b5.ts`; `verify-checkpoint-c1.ts`.

**Manual browser acceptance.** Encode a full CBC at 1440 and 1920. Switch between three reports and confirm context is preserved. Refresh mid-encoding and confirm `sessionStorage` recovery still restores.

**Independent review.** Not required, provided no server, action, or domain file is touched.

**Publication and documentation requirements.** None beyond the slice report. `architecture/UI_ARCHITECTURE.md` §3.2 and §7 describe the Workspace composition and responsive strategy; both become correctable after this slice, under explicit user authorization, bundled with the UX0 closeout (§2.4). `Project.md` untouched.

---

### UX2-B · Workspace safety: confirmations, unload guard, validation focus

**Objective.** Stop irreversible clinical actions from happening on a single unconfirmed click, and stop silent loss of unsaved encoding.

**User problem.** One misplaced click completes a session and burns an accession number, or permanently destroys a completed report. Closing the tab silently discards everything encoded since the last save.

**Affected roles.** Admin, User.

**Current behavior.** F-20, F-21, F-23, F-27, F-31.

**Intended behavior.** Per §8 items 6, 7, 9, and 12.

**Likely files.** `src/features/workspace/GuidedWorkspace.tsx`; `src/features/workspace/components/SelectedReportsPanel.tsx`; possibly a new `src/features/workspace/hooks/useUnsavedChangesGuard.ts`.

**Reusable components.** `ConfirmDialog` and `Alert` from UX0-C.

**Frozen boundaries.** ⚠️ **This slice guards irreversible clinical operations.** The confirmation is presentation only: it must not alter `completeSessionAction`, `replaceSessionAction`, `saveDraftAction`, the accession path, the retention anchor, the ownership predicate, the snapshot composition, or any audit emission. The `sessionStorage` recovery invariants in `workspace-recovery.ts` must be preserved exactly — a recovered payload stays version 1, within TTL, `status: "Draft"`, `accessionNumber: null`.

**Non-goals.** Do not add a confirmation to Save Draft — it is reversible and frequent. Do not add server-side confirmation state. Do not change what completion or replacement does. Do not touch `Ctrl+P` or encoding-mode print suppression (a separately-scheduled `Project.md` item).

**Implementation constraints.** The Replace dialog must state that prior content is permanently unrecoverable and require deliberate confirmation, not a default-focused confirm button. Focus starts on the safe action in both dialogs. `beforeunload` fires only when `isDirty`, and must be removed on unmount so it cannot leak into other routes. Session-level validation must scroll to and focus the offending field and expand any collapsed section containing it.

**Dependencies.** UX2-A.

**Acceptance criteria.**
1. Complete Session opens a confirmation naming the patient and the report count, and describing accession assignment and freezing. Cancelling performs no write.
2. Replace Completed Report opens a destructive confirmation naming the accession and stating irrecoverability. Cancelling performs no write.
3. Confirming performs exactly one write, indistinguishable from today's behavior.
4. `beforeunload` fires when and only when `isDirty` is true.
5. Clear All Examinations uses `ConfirmDialog`; `window.confirm` is gone from `src/features/workspace/`.
6. Attempting completion with a missing required field focuses that field and expands its section.
7. `tsc`, `lint`, `build` PASS.

**Keyboard checks.** Escape cancels both dialogs without writing. Enter on the focused (safe) action cancels. Confirming requires deliberate navigation to the destructive action.

**Responsive checks.** Both dialogs at 375 / 768 / 1440.

**Accessibility checks.** `role="alertdialog"` for the destructive confirm. Focus restores to the trigger on cancel. The consequence text is inside the accessible description.

**Regression risks.** The highest-risk slice in the plan. A confirmation wired incorrectly could double-submit, or submit on cancel. `beforeunload` left registered could block navigation elsewhere. Auto-expanding a collapsed section could disturb `sessionStorage` recovery state.

**Deterministic gates.** `tsc`; `lint`; `build`; `verify-checkpoint-b4.ts`; `verify-checkpoint-b5.ts`; `verify-checkpoint-c1.ts`; `verify-checkpoint-m6d.ts`. **Mutation proof required** on the "cancel performs no write" assertion.

**Manual browser acceptance — live, against the real database.** Cancel Complete, then confirm **no accession allocated** and no session row created. Confirm Complete, then confirm **exactly one** accession allocated and exactly one `SessionCompleted` audit row. Cancel Replace, then confirm the stored snapshot is byte-identical by SHA-256 and `last_replaced_at` is unmoved. Confirm Replace, then confirm exactly one `SessionReplaced` audit row with accession and retention anchor preserved. Capture a baseline for **every** asserted field before any live write.

**Independent review. REQUIRED.** This slice sits directly in front of two irreversible clinical operations. Packet: the full confirmation wiring, the unchanged action call sites, the `beforeunload` hook, the `workspace-recovery.ts` invariants as precedent, and the mutation evidence.

**Publication and documentation requirements.** This slice adds confirmation gates in front of two audited clinical operations. Record in the slice report that **no audit event, accession path, retention anchor, or snapshot semantic changed**, with the live-acceptance evidence attached. `architecture/UI_ARCHITECTURE.md` §6.1 (navigation guard) becomes accurate for the first time and may be corrected under explicit user authorization. `Project.md` untouched.

---

### UX2-C · Workspace keyboard and focus model

**Objective.** Make high-volume consecutive encoding fast for keyboard-driven operators, and make report switching reachable without a mouse.

**User problem.** No shortcuts exist. Report tabs cannot be reached by keyboard at all. Every field advance costs a `Tab` or a mouse move.

**Affected roles.** Admin, User. Optimizes for the experienced high-volume encoder while leaving the novice's mouse path untouched.

**Current behavior.** F-22, F-24, F-26.

**Intended behavior.** Per §8 item 8.

**Likely files.** `src/features/workspace/GuidedWorkspace.tsx`; `SelectedReportsPanel.tsx`; `ExaminationCatalog.tsx`; `controls/ParameterRow.tsx`; the five control components; possibly `src/features/workspace/hooks/useEncodingKeyboard.ts`.

**Reusable components.** Existing controls; the `data-encoding-input` and `data-param-code` attributes already present are the natural focus-traversal anchors.

**Frozen boundaries.** Do not change evaluation, reference resolution, or persistence. Do not remove or rename any `data-*` attribute. Do not change the `tabIndex={-1}` decision on the selection checkbox — replace the missing capability with a modifier shortcut instead.

**Non-goals.** No command palette. No `Ctrl+P` binding (see UX2-B non-goals). No global application-wide shortcut layer — this slice is workspace-scoped.

**Implementation constraints.** Shortcuts must not fire while focus is in a `<textarea>` or while a dialog is open. `Ctrl/Cmd+Enter` opens the UX2-B confirmation; it never submits directly. Field advance must skip deselected and disabled parameters. The tab strip becomes `role="tablist"` with roving `tabIndex` and Left/Right arrow navigation; panels get `role="tabpanel"` with `aria-labelledby`. Catalog rows become real buttons.

**Dependencies.** UX2-B.

**Acceptance criteria.**
1. `Ctrl/Cmd+S` saves a draft when dirty and is inert in Replacement Mode.
2. `Ctrl/Cmd+Enter` opens the appropriate confirmation dialog.
3. `Enter` and `ArrowDown` in a result input advance to the next **selected** parameter; `ArrowUp` reverses; both stop at the boundaries.
4. `Ctrl/Cmd+ArrowLeft` and `Ctrl/Cmd+ArrowRight` switch report tabs and preserve encoding state.
5. `Alt+Space` on a focused result input toggles that parameter's selection.
6. The tab strip is fully keyboard operable with correct ARIA tab semantics.
7. No shortcut fires inside a textarea or while a dialog is open.
8. `tsc`, `lint`, `build` PASS.

**Keyboard checks.** Encode a complete 20-parameter CBC using only the keyboard, from patient name through Complete Session confirmation. Then repeat with a deselected parameter mid-list and confirm it is skipped.

**Responsive checks.** Shortcuts are desktop-oriented; confirm nothing breaks touch interaction below `lg`.

**Accessibility checks.** Focus is always visible. Arrow-key tab navigation follows the WAI-ARIA tabs pattern. No shortcut collides with a screen-reader command, and none overrides a browser reserved binding other than the intentional `Ctrl+S`.

**Regression risks.** Swallowing keystrokes inside text fields. Focus traversal desynchronizing from parameter selection after a toggle. `Ctrl+S` intercepting the browser save dialog in a context where the user wanted it.

**Deterministic gates.** `tsc`; `lint`; `build`; `verify-checkpoint-b4.ts`; `verify-checkpoint-b5.ts`.

**Manual browser acceptance.** Timed keyboard-only encoding of one CBC and one CHEM_10, compared against the mouse-driven baseline.

**Independent review.** Not required, provided no server, action, or domain file is touched.

**Publication and documentation requirements.** `architecture/UI_ARCHITECTURE.md` §6.2 documents a keyboard workflow that has never existed (§2.4 row 5). After this slice it becomes partially accurate — correct it to describe **what was actually built**, including the deliberate exclusion of `Ctrl+P`, under explicit user authorization. Do not let the pre-existing document text define the acceptance criteria. `Project.md` untouched.

---

### UX3 · Application shell, compact Workspace icon-rail, and navigation

**Objective.** Give the Workspace persistent, role-aware navigation through a purpose-built compact shell, hide navigation a role cannot use, and make denied navigation explain itself.

**User problem.** Entering the Workspace loses the sidebar and header entirely. A Developer sees Session Workspace and Completed History and is refused by every action behind them. Denied navigation bounces silently with no explanation.

**Affected roles.** All.

**Repository-grounded current behavior.** F-06, F-50, F-51, F-52, F-54. Specifically: `src/app/(dashboard)/` contains only `workspace/` and **has no `layout.tsx`**, so `/workspace` receives neither `AppShell` nor the `(app)` layout's `getCurrentUserProfile()` → `redirect("/login")`. `config/navigation.ts` sets no `requiredRole` on `/workspace` or `/history`. `checkRouteAccess` and `requireDeveloper` both redirect to `/dashboard?error=unauthorized`, and no component reads that parameter.

**Intended behavior.**

> **APPROVED BY THE USER (revision 2): plan a compact Workspace-specific application shell / icon-rail variant.**
> Goals, as stated: persistent navigation · role-aware access · minimal horizontal footprint · maximum room for result encoding · **no full-size administrative sidebar inside the Workspace**.
> This settles what revision 1 left open. It is approved **for planning only** — not for implementation in this task.

1. Add `src/app/(dashboard)/layout.tsx` performing the same `getCurrentUserProfile()` then `redirect("/login")` as `(app)/layout.tsx`, adding no new guard logic.
2. Introduce a **compact icon-rail shell variant** for the Workspace: a narrow (~56–64px) icon-only navigation rail rendering the same role-filtered `navigationConfig` items as the full sidebar, with accessible names on every control, and **no standard `Header`** — the Workspace's own session bar already carries identity, accession, status, and actions. The full-size sidebar is **not** used inside the Workspace.
3. Add `requiredRole: ["Admin", "User"]` to `/workspace` and `/history` in `config/navigation.ts`, matching what `requireOperationalCaller` already enforces server-side.
4. Read `?error=unauthorized` on the dashboard and render a dismissible `Alert` explaining the denial.
5. Replace the hardcoded "System Ready" badge with an honest indicator, or remove it.
6. Correct the `/workspace` loading skeleton to match the real layout (rail + encoding pane, not a 2:1 grid).

**Exact likely files.** New: `src/app/(dashboard)/layout.tsx`; `src/components/layout/WorkspaceShell.tsx` (or an `AppShell` variant prop — prefer a separate component so the administrative shell is untouched); possibly `src/components/layout/NavRail.tsx`. Modified: `src/config/navigation.ts`; `src/components/layout/NavigationMenu.tsx` (share the role filter, do not duplicate it); `src/features/dashboard/components/compositions/*` (denial alert); `src/app/(dashboard)/workspace/loading.tsx`; `src/features/workspace/GuidedWorkspace.tsx` (height becomes shell-relative rather than `h-screen`).

**Reusable components.** `AppShell`, `Sidebar`, `NavigationMenu`, `NavItem`, `Alert`. **The role filter in `NavigationMenu` must be shared with the rail, never duplicated** — two copies of a visibility rule drift apart.

**Authority / frozen boundaries.** 🚨 **`checkRouteAccess` in `auth-guards.ts` is byte-frozen and must not be modified.** Navigation *visibility* changes in `navigation.ts` and `NavigationMenu` only. **Hiding a nav item is not a security control** — the real enforcement stays exactly where it is, in the server guards, and every one of them remains unchanged. `middleware.ts` is shape-pinned by `m6c`.

**Explicit non-goals.** Do not change any route-access rule. Do not add or remove a route. Do not restrict `/dashboard` by role. Do not change `middleware.ts`. Do not replace the administrative `AppShell` — the compact rail is an **additional** variant for the Workspace, not a replacement for the full sidebar elsewhere. Do not add a logo to the rail (§6: the rail is too small for a restrained mark, and the report letterhead already carries brand).

**Implementation constraints.** The new layout must mirror `(app)/layout.tsx`'s redirect exactly, adding no new guard logic. Adding the layout changes where `/workspace` mounts — verify `sessionStorage` recovery, Replacement Mode hydration, and the `no-print` boundaries are all unaffected. `GuidedWorkspace`'s `h-screen` assumption becomes shell-relative. **The rail must carry `no-print`**, or it will appear in printed output. Every icon-only rail control needs an accessible name; an icon rail without labels is the classic accessibility failure of this pattern.

**Dependencies.** UX0-C (for `Alert`) and **UX2-A** (the Workspace layout frame must be settled before the shell wraps it). Sequence after UX2-A, not before.

**Acceptance criteria.**
1. An unauthenticated request to `/workspace` redirects to `/login` at the layout level.
2. `auth-guards.ts` is byte-identical to baseline.
3. The Workspace renders the compact rail with persistent role-aware navigation, and **not** the full-size administrative sidebar.
4. The rail's horizontal footprint is ≤ 64px, and the encoding pane gains the width the old full sidebar would have consumed.
5. A `Developer` does not see Session Workspace or Completed History in either the sidebar or the rail; direct URL entry still behaves exactly as today (route renders, actions refuse).
6. `/dashboard?error=unauthorized` renders a clear, dismissible explanation.
7. `sessionStorage` recovery still restores after a refresh in the Workspace.
8. The rail does not appear in printed output.
9. `tsc`, `lint`, `build` PASS.

**Keyboard acceptance.** The rail is fully keyboard reachable from the Workspace, in a predictable position in the tab order (before the encoding surface). The mobile drawer traps and restores focus. A skip-to-content link jumps past the rail directly to the encoding pane.

**Responsive acceptance.** 375 / 768 / 1024 / 1440 / 1920. Confirm the Workspace retains usable encoding height at 768px with the rail present, and that the rail collapses to the existing drawer pattern below `lg`.

**Accessibility acceptance.** `aria-current="page"` on the active nav item (already present in `NavItem`). Every icon-only rail control has an accessible name via `aria-label` or visually-hidden text — **not** a `title` attribute alone. The denial `Alert` uses `role="alert"`. Skip-to-content link present and functional.

**Mutation / adversarial verification.** **Required, one mutation.** Navigation visibility is presentation only, and the plan asserts that server enforcement is untouched. Prove it: with `/workspace` hidden from the Developer rail, confirm a Developer hitting `/workspace` directly is still refused by `requireOperationalCaller` at the data layer. A hidden link that turns out to be the only thing stopping access would be a security regression disguised as a UI change.

**Regression risks.** The largest is a layout change disturbing Workspace print behavior or recovery state. Test `no-print` boundaries and refresh recovery explicitly.

**Deterministic gates.** `tsc`; `lint`; `build`; `verify-checkpoint-m6c.ts` (proves `auth-guards.ts` and `middleware.ts` untouched); `verify-checkpoint-b4.ts`; `verify-personnel-directory.ts`; `verify-personnel-signatures.ts`; `verify-developer-boundary.ts`.

**Manual browser acceptance.** Sign in as each role and screenshot the sidebar. Enter the Workspace and confirm navigation continuity. Refresh mid-encoding and confirm recovery. Trigger a denied navigation and confirm the explanation appears.

**Independent review. REQUIRED.** Route-group structure and role-based navigation visibility, adjacent to a byte-frozen guard.

**Publication and documentation requirements.** `architecture/UI_ARCHITECTURE.md` §4.1 (AppShell composition) and §4.2 (route table, whose role column is wrong per §2.4 row 7) both become correctable after this slice, under explicit user authorization. Record explicitly that navigation visibility is presentation only and that server guards remain the enforcement boundary. `Project.md` untouched.

---

### UX4-A · History screen

**Objective.** Make the retention window visible and the screen's states honest.

**User problem.** Nothing warns that a report expires in three days. Search silently covers only the newest 50 rows. The empty state reads as a failed search even when nothing was searched. The preview modal is not accessible.

**Affected roles.** Admin, User.

**Current behavior.** F-41 through F-46.

**Intended behavior.** Add a retention column showing days remaining, with escalating emphasis near expiry. Distinguish the three empty states — no sessions at all, no sessions matching a filter, and a load error. Use `Skeleton` for loading. Rebuild the preview overlay on the accessible `Modal`. Make the 50-row fetch limit explicit in the interface, with a control to load more. Add column sorting.

**Likely files.** `src/features/history/components/SessionHistoryView.tsx`; `src/app/(app)/history/loading.tsx`.

**Reusable components.** `Modal`, `EmptyState`, `Skeleton`, `StatusBadge`, `Table`.

**Frozen boundaries.** Do not change `listRecentSessionsAction`, the retention predicate, or the `canReopen` gate. Retention days are **derived for display only** — enforcement stays in the query and in the transaction.

**Non-goals.** No server-side search (a separate scope decision). No change to what History returns. No new action.

**Implementation constraints.** Compute days remaining from `expiresAt` in the user's local timezone, displayed only. Never render an "expired" row — the server already excludes them; if one ever appears, treat it as a defect, not a display case.

**Dependencies.** UX0-C.

**Acceptance criteria.**
1. Each completed session shows days remaining until expiry, with visual escalation near the edge.
2. Three distinct empty states render correctly.
3. Loading renders a skeleton matching the table.
4. The preview modal traps focus, closes on Escape, and restores focus.
5. The result-set limit is visible and extendable.
6. `tsc`, `lint`, `build` PASS.

**Keyboard checks.** Sortable headers are buttons with `aria-sort`. The preview modal is fully keyboard operable.

**Responsive checks.** 375 / 768 / 1440. The table scrolls within its own container; the page body never scrolls horizontally.

**Accessibility checks.** Real `<caption>` or accessible table name. Status conveyed by text plus color. Retention urgency never conveyed by color alone.

**Regression risks.** A timezone error making a report look expired a day early. Sorting desynchronizing `canReopen` from its row.

**Deterministic gates.** `tsc`; `lint`; `build`; `verify-checkpoint-b5.ts`; `verify-checkpoint-c1.ts`.

**Manual browser acceptance.** View History as an owner and as a non-owner, confirming Replace appears only for the owner. Confirm the retention countdown against a known `expires_at`.

**Independent review.** Not required.

**Publication and documentation requirements.** `architecture/UI_ARCHITECTURE.md` §8.2 specifies a retention countdown that has never existed (§2.4 row 6); it becomes accurate after this slice and may be corrected under explicit user authorization. `Project.md` untouched.

---

### UX4-B · Users and Developer Accounts screens

**Objective.** Remove native browser dialogs from the administrative screens and bring them onto the shared primitives.

**User problem.** Deleting a user account uses an unbranded `window.confirm`; four failure paths use `window.alert`.

**Affected roles.** Admin, Developer.

**Current behavior.** F-31.

**Intended behavior.** Replace all `window.confirm` with `ConfirmDialog` (destructive variant for delete) and all `window.alert` with inline `Alert`. Adopt `EmptyState` and `Skeleton`. Align both screens with `PersonnelDirectoryView`'s conventions.

**Likely files.** `src/features/users/components/{UserManagementView,UserTable,UserForm,UserPasswordResetModal}.tsx`; `src/features/developer-accounts/components/{DeveloperAccountManagementView,DeveloperAccountTable,DeveloperAccountFormModal}.tsx`.

**Reusable components.** All UX0-C primitives; `PersonnelDirectoryView` as the pattern reference.

**Frozen boundaries.** `src/app/api/users/[id]/route.ts` is shape-pinned by `m6c` — **do not modify it**. No change to any authorization check, audit event, or `SecurityDenial` emission. Self-deactivation and self-deletion guards must remain exactly as they are.

**Non-goals.** No permission change. No new action. No change to password-reset semantics.

**Dependencies.** UX0-C.

**Acceptance criteria.**
1. `grep -rn "window.confirm\|window.alert" src/features/users src/features/developer-accounts` returns 0 results.
2. Delete opens a destructive `ConfirmDialog`; cancelling performs no request.
3. Self-deactivation and self-deletion remain blocked with a clear inline message.
4. Failures surface as inline alerts, never as browser dialogs.
5. `tsc`, `lint`, `build` PASS.

**Keyboard checks.** Every dialog is keyboard operable, focus starting on the safe action.

**Responsive checks.** 375 / 768 / 1440.

**Accessibility checks.** `role="alertdialog"` for destructive confirms; `role="alert"` for errors.

**Regression risks.** An async confirm path double-submitting where the synchronous `window.confirm` previously could not.

**Deterministic gates.** `tsc`; `lint`; `build`; `verify-checkpoint-m6c.ts`; `verify-developer-boundary.ts`; `verify-admin-invariants.ts`.

**Manual browser acceptance.** Delete a synthetic account with cancel and with confirm. Attempt self-deactivation and self-deletion.

**Independent review.** Not required, provided no route, action, or guard file is touched.

**Publication and documentation requirements.** None beyond the slice report. `Project.md` untouched.

---

### UX5 · Cross-system accessibility, responsive, and state consistency

**Objective.** Close the systemic accessibility, contrast, and state gaps in one deliberate pass instead of piecemeal.

**User problem.** Encoding inputs have no accessible name. Micro-typography and low-opacity colors fail contrast. Focus and disabled states are inconsistent.

**Affected roles.** All.

**Current behavior.** F-07, F-09, F-10, F-32, F-52, F-53, F-55.

**Intended behavior.** Associate every form control with a real label (`htmlFor` and `id`, or `aria-label` / `aria-labelledby` where a visible label is impossible). Establish a minimum type size and retire `text-[8.5px]`, `text-[9px]`, and `text-[9.5px]`. Remove low-opacity text colors that fail AA. Standardize focus rings and disabled states. Apply tabular figures to all numeric and accession data. Consolidate radii onto a documented scale. Establish a z-index scale. Verify every screen has coherent loading, empty, and error states. Stop rendering raw `error.message` to end users.

**Likely files.** Broad but shallow: all workspace controls, demographics, history, users, developer accounts, dashboard compositions, `error.tsx`, `GlobalErrorBoundary.tsx`, `globals.css`, `tailwind.config.ts`.

**Reusable components.** All UX0-C primitives.

**Frozen boundaries.** Do not touch `src/rendering/**` — report typography is UX6 and is frozen. Do not modify any shape-pinned auth file beyond what UX0-B already established. Do not remove or rename any `data-*` attribute a verifier reads.

**Non-goals.** No layout change. No new component. No behavior change. This is a consistency and accessibility pass only.

**Implementation constraints.** Every contrast change must be measured against WCAG AA (4.5:1 body, 3:1 large text), not eyeballed. Raising the minimum type size must not overflow the parameter grid — verify at 1280.

**Dependencies.** UX1 through UX4 complete, so nothing new is introduced afterward.

**Acceptance criteria.**
1. Every form control in `src/` has a programmatic accessible name.
2. No text below the established minimum size remains.
3. Every text and background pair meets AA, measured.
4. Focus rings and disabled states are consistent across all interactive elements.
5. Numeric and accession data render with tabular figures.
6. Every screen has a loading, empty, and error state.
7. `error.tsx` no longer renders raw exception text to end users.
8. `tsc`, `lint`, `build` PASS.

**Keyboard checks.** Full keyboard traversal of every screen with a visible focus indicator at all times. Skip-to-content works.

**Responsive checks.** 375 / 768 / 1024 / 1280 / 1440 / 1920 on every screen. No page body scrolls horizontally at any width.

**Accessibility checks.** Automated axe or Lighthouse pass per screen, plus manual screen-reader traversal of the Workspace encoding flow.

**Regression risks.** Larger type overflowing the parameter grid. Contrast changes disturbing the clinical status-badge language (Normal / High / Low / Abnormal / Invalid) — that language must remain instantly distinguishable.

**Deterministic gates.** `tsc`; `lint`; `build`; the full applicable verifier suite: `b4`, `b5`, `c1`, `c4`, `c4-1`, `c4-2`, `m6c`, `m6d`, `verify-developer-boundary.ts`, `verify-admin-invariants.ts`, `verify-personnel-directory.ts`, `verify-personnel-signatures.ts`.

**Manual browser acceptance.** Full keyboard-only and screen-reader walkthrough of encoding one complete session end to end.

**Independent review.** Not required if strictly presentational; **required** if any `data-*` attribute or verifier-relevant markup shifts.

**Publication and documentation requirements.** This slice closes the accessibility-validation item listed as pending under Milestone 6 in `Project.md`. **Do not modify `Project.md` to claim it.** Record the evidence in the slice report and raise the synchronization as a separate publication-boundary request for the user.

---

### UX6 · Post-approval Native report visual refinement

**Objective.** Apply only the bounded refinements §14 identifies, under explicit per-item authorization, without disturbing any frozen report semantic.

> **UX6 is a post-approval refinement phase.** C4 is approved and frozen; C5 is complete (§2.1, §2.2). UX6 is **not** a prerequisite for C5, **not** a re-run of the C4 gate, and **must never be described as reopening the C4/C5 milestone sequence.** It operates strictly inside the Milestone 4 freeze clause that permits fixing defects in the Report Engine without redesigning it.

**Affected roles.** All (the document is the product).

**Authority / frozen boundaries.** Everything listed under "Frozen by `Project.md`" in §9. Additionally: `formattedValue`, `referenceDisplay`, evaluation outcomes, omission behavior, signatory order, completed snapshots, and the single shared Preview/Print/PDF composition path.

**Explicit non-goals.** Do not change clinical meaning. Do not add CBC abnormal indicators. Do not invent report titles. Do not alter completed snapshots for aesthetic reasons. Do not change page utilization — the sparse lower half is **frozen by design** (§14.2). Do not introduce a second composition path. Do not restore retired Legacy or Experimental rendering infrastructure.

#### UX6 scope item 1 — provenance strip · FROZEN-BOUNDARY DECISION GATE

> **Do not touch the provenance strip during any earlier UX slice.** UX0 through UX5 must leave `NativeLivePreviewPage.tsx` alone.

`NativeLivePreviewPage.tsx:39` renders *"Preview mode: Native · Composition source: StandardNative · Layout family: StandardAdaptiveTabular"* above every previewed report. It carries `no-print`, so it never reaches the document, but it is on screen for every user on every preview (F-39, C4-I-1).

**It is pinned by three verifier assertions.** Any change must be made at the real boundary, never by evading them:

| Verifier | Line | Assertion |
|---|---|---|
| `scripts/verify-checkpoint-c4-1.ts` | 207 | *"active CBC must visibly expose Native / StandardNative / StandardAdaptiveTabular provenance"* |
| `scripts/verify-checkpoint-c4-2.ts` | 216 | *"manual provenance must remain visible"* |
| `scripts/verify-checkpoint-c4-2.ts` | 232 | *"the selected CBC page must expose Native / StandardNative / StandardAdaptiveTabular provenance"* |

**If, and only if, the user authorizes retirement or change:**

1. Identify the exact assertions above and amend **only** those, in the same change, with a recorded justification.
2. **Never** disguise, rename, or restructure the markup to slip past an assertion while leaving it nominally passing. That is prohibited by `CLAUDE.md` and defeats the assertion without changing the risk.
3. **Preserve equivalent diagnostic visibility** if the diagnostic value is still needed — for example a `data-*` attribute that verifiers and developers can read, or a developer-only affordance — rather than deleting the capability outright.
4. Mutation-prove every amended assertion.
5. **Independent review is mandatory.**

The strip's original purpose was to support the manual C4 and C5.2 visual approvals, which `Project.md` records as **granted**. That makes retirement defensible — but it remains the user's decision, recorded at §16.5 item 7, not an implementer's.

#### UX6 scope item 2 — report logo geometry · AUTHORIZED IN PRINCIPLE

**A bounded visual adjustment to the report-logo container and aspect treatment is permitted** (C4-I-2). The header reserves `21 × 15 mm` (1.4:1) via `NATIVE_REPORT_THEME.header` while the official asset is `1254 × 1254` (1:1); with `fit: "contain"` the mark renders 15 × 15 mm with roughly 3 mm of dead space per side, reading slightly loose against the identity block at `x=41`.

Constraints on that adjustment:

- Use **only** `public/st-rose-logo-official.png`. No alternate, generated, recolored, or redrawn mark (§6).
- Preserve A4 geometry: `210 × 297 mm`, ~15 mm margins, the `148.5 mm` content bottom limit.
- Preserve report semantics, clinical content, title rules, signatory rules, and completed snapshots.
- The change affects the header of **all 17 reports** and both the DOM preview and the jsPDF exporter, which must stay in agreement.
- Full C-family re-verification plus fresh manual visual approval.

**The box dimensions are hard-pinned. Verified at revision 2:**

| Verifier | Line | Assertion |
|---|---|---|
| `scripts/verify-checkpoint-c4-1.ts` | 164 | `logo.fit === "contain" && logo.width === 21 && logo.height === 15` — *"logo must preserve aspect ratio in the compact 21 x 15 mm box"* |
| `scripts/verify-checkpoint-c4-1.ts` | 165 | `logo.width >= 18 && logo.width <= 25` — *"logo must stay within the approved compact range"* |

**This constrains the solution space in a way the implementer must know up front.** The obvious fix — narrowing the box to a 15 × 15 mm square so it matches the 1:1 asset — would make `logo.width` 15 and **fail line 165's `>= 18` lower bound**, which is an independently approved range, not an incidental value. Three viable directions, all requiring the user's ruling on which is intended:

1. **Keep the box, move it.** Leave `21 × 15` and shift `logoXmm` / `identityXmm` so the contained 15 mm mark is optically balanced against the identity block. Amends only line 164 if the box is unchanged — possibly nothing at all.
2. **Narrow to 18 × 15** (the smallest width line 165 permits). Amends line 164 only; line 165 still passes.
3. **Square the box at 15 × 15.** Amends **both** 164 and 165, and reopens the "approved compact range" as a decision, not just a number.

Direction 1 is preferred where it suffices, because it may require no assertion change at all. Do not pick a direction without the user (§16.5 item 8).

**Exact likely files.** `src/rendering/native/theme.ts` (the `header` block: `logoXmm: 16`, `logoWidthMm: 21`, `logoHeightMm: 15`, `identityXmm: 41`); `src/rendering/native/standard/sections.ts` (`composeOfficialHeader`, lines ~107–125); `src/rendering/native/specialized/common.ts` (~line 136, the specialized logo primitive); and `scripts/verify-checkpoint-c4-1.ts` lines 164–165 **only if** the chosen direction genuinely requires it.

**Deterministic verification.** `c1`, `c2`, `c3`, `c4`, `c4-1`, `c4-2`, `c5`, `tsc`, `lint`, `build`. The C4-family verifiers run **without** `--conditions=react-server` (§16.6).

**Mutation / adversarial verification. REQUIRED** on any amended or added assertion. One representative mutation per invariant, each restored from a byte-verified backup held outside the repository, each recording the invariant, the intended assertion, the assertion that actually fired, and the restore hash.

**Manual acceptance.** All 17 reports compared at 75% and 100% against the pre-change candidate, plus PDF parity for each, since the DOM preview and the jsPDF exporter must agree on the header.

**Independent review. REQUIRED.** Frozen report boundary.

**Dependencies.** UX5, plus explicit per-item user authorization: §16.5 item 7 for the provenance strip, item 8 for the logo geometry. **UX6 does not start without one of those rulings.**

**Publication and documentation requirements.** Any landed refinement must be recorded against the Milestone 4 freeze clause as a **bounded post-approval refinement**, never as a reopening of C4 or C5 (§2.1, §2.2). If a C4-family verifier assertion is amended, the amendment, its justification, and its mutation proof must all be recorded together. `Project.md` synchronization requires explicit user authorization.

---

## 12. Common / role-specific / hidden — summary

| Element | Admin | User | Developer |
|---|---|---|---|
| Identity, role, honest system state | yes | yes | yes |
| Start New Patient Session | yes | yes, **primary** | no |
| My drafts / Resume | yes | yes, **primary** | no (server denies) |
| Recent completed sessions | yes | yes | no (server denies) |
| Replace / Edit control | only where `canReopen` | only where `canReopen` | no |
| Expiring-soon list | yes | yes | no |
| Personnel summary + signature coverage | yes | no | read-only shortcut |
| User-account summary | yes, compact | no, **hidden** | yes, in system statistics |
| Recent security denials | yes | no, **hidden** | yes |
| Supabase / system health telemetry | no, **hidden** | no, **hidden** | yes |
| Developer Accounts shortcut | no | no | yes |
| Audit Logs shortcut | yes | no, **hidden** | yes |

---

## 13. Design system standardization targets

| Concern | Current | Target |
|---|---|---|
| Typography | `text-xs` body; `text-[11px]/[10px]/[9.5px]/[9px]/[8.5px]` × 85 | Documented scale with an enforced minimum; tabular figures for all numeric data |
| Spacing | ad hoc `p-2.5`, `p-3.5`, `gap-3.5`, `py-1.5` | Rationalized 4px-based scale |
| Page width | `max-w-7xl` on the shell, also on the full-screen Workspace | Shell keeps `max-w-7xl`; Workspace gets a wider fluid cap |
| Cards | `Card` primitive plus many hand-rolled `bg-white rounded-xl border` | One `Card`; group with spacing and rules where elevation carries no meaning |
| Elevation | 62 no-op shadow classes (F-01) | Real 3-step brand-tinted scale |
| Buttons | `Button` primitive plus ~40 hand-rolled inline buttons in the Workspace | `Button` everywhere, with a compact `xs` size for the encoding surface |
| Form controls | `Input`/`Select` on admin screens; raw `<input>` in the Workspace and demographics | Shared controls with a documented density variant |
| Validation | per-parameter placement is correct; session-level is a detached top banner | Keep field-level; make session-level a summary with jump-to-field |
| Alerts | 5 hand-rolled variants | One `Alert` |
| Status indicators | `Badge` plus a bespoke clinical outcome badge in `ParameterRow` | `Badge` for generic; `StatusBadge` for the clinical language |
| Tables | `Table` primitive on admin screens; hand-rolled in History | `Table` everywhere |
| Dialogs | `Modal`, plus 3 hand-rolled overlays, plus `window.confirm` | `Modal` plus `ConfirmDialog` |
| Empty / loading / error | 5–6 independent implementations each | `EmptyState`, `Skeleton`, `Alert` |
| Focus rings | `focus:ring-1`, `focus-visible:ring-2`, `focus:ring-2 ring-brand-primary/20`, plain `focus:outline-none` | One token-driven treatment |
| Disabled | `opacity-50`, `opacity-60`, `opacity-40`, `cursor-not-allowed` inconsistently | One treatment meeting AA |
| Destructive | rose, red, and amber used interchangeably | `brand-danger` only, always with confirmation |
| Icons | `lucide-react`, consistent family and weight | **Keep.** Already consistent; the taste skill's preference for another family is rejected as gratuitous churn. |
| Radius | 4 unrelated scales | Documented 2–3 step scale |
| Z-index | ad hoc `z-10/20/30/40/50` | Documented scale in constants |
| Breakpoints | Tailwind defaults, applied inconsistently | Documented desktop-first policy matching `UI_ARCHITECTURE.md` §7 |

**No broad component rewrite is proposed.** The primitive set is sound; the problem is that it is bypassed. UX0 makes the existing system real and complete; UX1 through UX5 adopt it.

### 13.1 Loading-state policy — where skeletons apply, and where they do not

Binding on every slice. The `Skeleton` primitive is built in **UX0-C** and adopted by the screen
slices; this section is the single place the policy is defined, so no screen invents its own.

**Use a skeleton where the layout is predictable and the wait is for data.**

| Surface | Slice | Guidance |
|---|---|---|
| **Dashboard data surfaces** | UX1-A / UX1-B / UX1-C | Skeleton per composed region — metric tiles, session lists, activity lists — not one page-sized block. `DeveloperDashboardSkeleton` is the existing shape reference and the `<Suspense fallback>` boundary is already in place. |
| **History list** | UX4-A | Skeleton rows matching the real table's column count and row height. Replaces the current bare `"Loading session history..."` text line (F-45). |
| **Personnel list** | UX4-B | Same treatment as History; the directory table has a known column set. |
| **Workspace initial / session load** | UX2-A | Skeleton **only where the layout is predictable** — the catalog rail and the encoding pane frame. Correct `app/(dashboard)/workspace/loading.tsx`, which currently draws a 2:1 grid that does not match the real layout (F-54). A reopen-in-progress state is a *status panel*, not a skeleton, because its outcome may be a denial rather than content. |
| **Preview / report loading** | UX2-A, UX4-A | Skeleton the **A4 page frame at its true dimensions** so the surrounding chrome does not reflow when the composed page arrives. Never skeleton the report's inner content — it is composed synchronously once the model resolves. |

**Preserve final layout dimensions.** A skeleton must occupy the same box the real content will
occupy — same height, same column count, same row height, same container width — so that swapping in
real content causes **no layout shift**. A skeleton that is the wrong size is worse than no skeleton:
it produces a visible jump at exactly the moment the user starts reading.

**Do not use a skeleton for a small in-place action.** For a button-scoped operation — Save Draft,
Confirm, Delete, Upload, Export — use the **disabled + loading button** state instead. `Button`
already supports `isLoading`, which renders a spinner and disables the control; use it rather than
replacing the button or its row with a shimmer. The rule of thumb: **skeletons stand in for content
that is arriving; loading buttons stand in for work that is happening.**

Also not skeletons: validation in flight, an in-flight `ConfirmDialog` submission (use the dialog's
in-flight state), and any wait shorter than a perceptible frame.

**Accessibility.** A skeleton region carries `aria-busy="true"` on its container and is not
announced as content. Do not animate it under `prefers-reduced-motion`; a static tint is sufficient.

---

## 14. Native report visual assessment (post-approval review)

**Scope note, restated from §2.1 and §2.2.** C4 manual visual approval is **already granted**, Phase C is frozen, and C5 is **complete**. This section is a fresh visual-quality review of already-approved, already-shipped output. It classifies refinement candidates for the post-approval UX6 phase. It does **not** reopen the C4 gate, is **not** a prerequisite for C5, and does **not** re-enter the C4/C5 milestone sequence.

### 14.1 Verified geometry

All three C4-family verifiers PASS at the planning baseline. Measured `contentBottomMm` for all 17 reports, from `verify-checkpoint-c4-2.ts`:

| Report | mm | Report | mm | Report | mm |
|---|---|---|---|---|---|
| FECALYSIS | 144.30 | HIV_RESULT | 120.80 | HBSAG | 95.10 |
| CBC | 130.65 | URINALYSIS | 109.95 | PREG_TEST | 95.10 |
| CHEM_10 | 130.65 | DENGUE_DUO | 104.20 | RPR | 95.10 |
| HDL_LDL | 121.55 | OGTT | 98.80 | BLOOD_TYPING | 94.25 |
| CHEM_8 | 112.45 | | | CT_BT | 94.25 |
| | | | | ESR | 89.70 |

Every value is below the frozen `148.5 mm` upper-half limit. Layout families resolve as `{StandardAdaptiveTabular: 6, CompactResultGrid: 9, Certificate: 1, MicroscopyTwoColumn: 1}`, matching `Project.md`.

### 14.2 Page utilization is frozen, not a defect

Content occupies 89.7–144.3 mm of a 297 mm page: **30%–49% utilization**. This is **not** excessive whitespace to be corrected. `Project.md` freezes *"Actual report content must remain at or above 148.5 mm"* — an upper-half containment rule — and *"Variable content flows naturally without stretching sparse reports."* The blank lower half is the design. **Any proposal to fill it is out of bounds.**

### 14.3 Findings, classified

**Blocking visual defect: none.**

No finding in this review prevents professional laboratory output. The composition is coherent, the teal system is consistent, typography is deliberate, and the frozen geometric contracts hold.

**Important improvements (2)**

| # | Finding | Evidence | Constraint |
|---|---|---|---|
| C4-I-1 | **The developer provenance strip renders above every previewed report.** *"Preview mode: Native · Composition source: StandardNative · Layout family: StandardAdaptiveTabular"* is on screen for every user, every preview. It is `no-print`, so the document is unaffected. | `NativeLivePreviewPage.tsx:39` | **Pinned** by `c4-1.ts:207` and `c4-2.ts:216`/`:232` (*"manual provenance must remain visible"*). Retiring it means amending those assertions — an authority decision, never a silent edit. Decision gate: §16.5 item 7; scope: §11 UX6 item 1. |
| C4-I-2 | **The logo box aspect does not match the asset.** The header reserves `21 × 15 mm` (1.4:1); the official asset is `1254 × 1254` (1:1). With `fit: "contain"` the logo renders 15 × 15 mm, centered, leaving roughly 3 mm of dead space on each side inside a box that then sits 4 mm from the identity block at x=41. The header reads slightly loose at the left. | `theme.ts:27-29`, `standard/sections.ts:111-118` | The frozen contract is the *composition*, not this box aspect. A change alters header geometry for all 17 reports and requires full re-verification plus visual re-approval. The box is additionally hard-pinned at `c4-1.ts:164` and `:165`. Decision gate: §16.5 item 8; scope: §11 UX6 item 2. |

**Polish (3)**

| # | Finding | Evidence |
|---|---|---|
| C4-P-1 | `contentBottomMm` clusters at exactly 95.10 for four reports and 94.25 for two, suggesting uniform section heights rather than content-driven ones for the sparse `CompactResultGrid` family. Worth one visual look for optical balance; not a defect. | `c4-2.ts` output |
| C4-P-2 | The official logo is a 1.30 MB PNG whose raw bytes are embedded in every exported PDF. A visually identical, optimized encoding would reduce every export. **This changes the asset file, which the brief designates the branding source of truth, so it requires explicit user authorization** and would move the `c1`/`c2`/`c3`/`c5` logo-byte checks. | PNG IHDR read directly |
| C4-P-3 | The DOM preview clips overflowing text via `whiteSpace: "nowrap"` plus `overflow: "hidden"` while `text-layout.ts` throws on unwrappable text. Pre-validated today, but any future divergence between preview and jsPDF would fail silently on screen. Worth an explicit assertion rather than a layout change. | `NativeReportPreview.tsx:20-40` |

**Acceptable as-is**

A4 geometry · margins · report titles (declared only) · patient information hierarchy · table and grid density · `EXAMINATION | RESULT | NORMAL VALUES` and `TEST | RESULT | REFERENCE VALUES` headers · result readability · reference readability · unit rendering with single fixed suffixes · conditional field omission reserving no space · omitted empty content · signatory placement · Pathologist signature rendering with `OmitImage` degradation · MedTech textual identity · **HIV signatory order Examiner → Verifier → Pathologist** · content alignment · overflow enforcement (actionable error, no clipping) · consistency among the four layout families · overall professional laboratory appearance.

### 14.4 Verdict

> **The Native report presentation is visually acceptable as it stands, and its already-granted C4 approval requires no bounded fixes to remain valid.**
>
> Zero blocking visual defects were found. The two "important" items are **application-chrome and header-geometry refinements**, not document-content defects: C4-I-1 concerns a diagnostic strip that never reaches the printed page, and C4-I-2 concerns roughly 3 mm of optical looseness in the letterhead. Both are **frozen-boundary changes gated on explicit user authorization** (§16.5 items 7 and 8), and both are scoped to UX6.
>
> **UX6 is therefore optional and last.** UX0 through UX5 do not depend on it. It is a *post-approval refinement* phase: it improves output that is already approved and already shipping, and it must not be allowed to block, gate, or re-sequence anything else.

---

## 15. C5 boundary

C5 is complete (§2.2). No PDF or export migration work is proposed anywhere in this plan. The UI/UX decisions the existing Native PDF path already depends on, which **must not be broken** by any slice:

1. **One composition path.** `live-preview-composer` serves both Live Preview and `createNativeSessionPdf`. No slice may introduce a second composition path or a preview-only visual adjustment that the PDF does not share.
2. **`no-print` boundaries are load-bearing.** The preview toolbar, page-navigation tabs, and provenance strip are all excluded from print via `no-print`. Any chrome added around the preview must carry `no-print`.
3. **The accession gate on Print and PDF is a data-integrity rule, not styling.** `isAccessionAssigned` disables both. Fixing F-37's missing disabled *styling* must not weaken the *condition*.
4. **The logo asset is embedded in PDF output.** Changing the file (C4-P-2) changes every export and moves the byte checks in `c1`, `c2`, `c3`, and `c5`.
5. **Preview scale is frozen at 75% and 100%.** No "fit to width" or free zoom may be added.
6. **The signature proxy is same-origin and cookie-authenticated.** The PDF exporter's `fetch` depends on that. No UI change may alter how signature images are requested.

---

## 16. Continuation and agent handoff

**This section is written for an implementation agent (Big Pickle / OpenCode) continuing without access to any prior conversation.** It must remain independently executable. Everything needed to start is here or referenced by exact section number.

### 16.1 Planning baseline

```
Planning baseline SHA : cd1152663154ed523f95ecef165a1877293e7c83
origin/main           : cd1152663154ed523f95ecef165a1877293e7c83
Branch                : main (0 ahead, 0 behind)
Revision              : 2, dated 2026-08-19
```

Baseline gate health, measured at this SHA: `tsc --noEmit` PASS · `next lint` PASS · `verify-checkpoint-c1.ts` PASS · `verify-checkpoint-c4.ts` PASS · `c4-1.ts` PASS · `c4-2.ts` PASS.

### 16.2 Current repository working-tree status — classified

Exactly two entries. **Neither is a defect. There are no unexpected changes.**

```
git status --porcelain
 D public/st-rose-logo.png
?? architecture/whole-system-user-centered-ui-ux-improvement-plan.md
```

| Entry | Classification | Required action |
|---|---|---|
| ` D public/st-rose-logo.png` | **Intentional, user-owned deletion.** Authorized and permanent. | **Leave untouched.** Do not restore, stage, revert, or regenerate. |
| `?? architecture/whole-system-user-centered-ui-ux-improvement-plan.md` | **This planning artifact.** Documentation only. | Untracked; no production code. |

The `CLAUDE.md` clean-tree requirement is satisfied by **classification**, not by cleaning. Both entries are accounted for and owned. If a third entry appears, that is a hard stop.

### 16.3 Branding source of truth

**`public/st-rose-logo-official.png` is the sole authoritative logo.**

- 1254 × 1254, PNG colorType 2 (RGB, **no alpha channel**), 1,305,200 bytes
- SHA-256 `b0ec751196ad3b1b1c648c16df8aef7fcacb8b74785ecd30bd6daac84db342a4`

**`public/st-rose-logo.png` is intentionally deleted and permanently retired.** Never recreate it, never copy the official asset to that name, never generate or substitute an alternate mark. Full rules in §6.

Three stale references remain in `src/` and are the subject of slice **UX0-B**:

```
src/app/login/page.tsx:86
src/features/auth/components/FirstLoginForm.tsx:54
src/features/auth/components/ForgotPasswordForm.tsx:81
```

### 16.4 Project state

Milestone 1 complete and frozen. **Milestone 4 (Report Engine) complete and frozen. Phase C complete and frozen through C5.3 — C4 is approved, C5 is done (§2.1, §2.2).** Milestone 5 Drafts and History functionally complete and live-accepted. Milestone 6 hardening in progress: 6D-2 complete; Personnel Directory P1, P2, P3 complete and live-accepted; the login lockout retry countdown complete and live-accepted.

**The Whole-System User-Centered UI/UX Improvement Program is authorized** (§2.3). The `Project.md` deferral line is superseded by user direction; `Project.md` itself is unmodified and its synchronization is a separate publication-boundary task.

**Carried `Project.md` items this plan does not touch and must not be assumed closed:** the Replacement Mode hydration fidelity gap (5 optional Urinalysis parameters, blank rows only); encoding-mode `Ctrl+P` print suppression; preview-mode `Ctrl+P` manual verification for an unassigned session; `POST /api/purge` returning 500 rather than 403 to a non-Admin; `findById` / `findByAccessionNumber` returning expired sessions when addressed directly; purge scheduling; the project-wide audit delivery durability residual; the absent CI workflow.

### 16.5 Unresolved decisions requiring the user

> **None of items 2–10 block UX0-B, UX0-A, or UX0-C.** The opening three slices are deliberately scoped so that every deferred decision below sits outside them. See §16.5.1.

| # | Decision | Why it blocks | Blocks |
|---|---|---|---|
| 1 | ✅ **`AGENTS.md` reconciliation — SATISFIED.** The authority is now repository-local, tracked, and published at commit `7427942`, and this plan has been reconciled against it (§1.3.1). It was **replaced** by user decision rather than reconciled against the former external copy. | Resolved. No agent may reopen this as a blocker or reintroduce an external-`AGENTS.md` gate. | **Nothing. UX0-B's authority gate is clear.** |
| 2 | **Confirm the target minimum type size and density** for the encoding surface (F-07, F-32). Body text is currently 12px with 85 uses of 8.5–11px. Raising it affects rows-per-screen for high-volume encoders. | Trades readability against density for the primary user. | UX2-A, UX5 |
| 3 | **Should History gain server-side search?** It currently fetches 50 rows and filters client-side (F-41), so older accessions are unfindable and indistinguishable from "no such record". | Scope decision: UI-only fix versus a new query path. | UX4-A |
| 4 | **Reconcile the version strings.** `SYSTEM_CONSTANTS.APP.VERSION` = `2.0.0`; `package.json` = `0.1.0`; `WelcomeBanner.tsx` and `Sidebar.tsx` hardcode `v1.0.0` (F-17). | Product decision, not a code decision. | UX1-A |
| 5 | 🔒 **Signatory Gate A — the inert `Confirm ✓` control.** `SignatorySelectionSection.tsx:196` sets local state only; it is never persisted and never read by completion validation, yet presents as a clinical sign-off. Options: (a) remove it, relying on existing required-signatory validation; (b) make it a real gate blocking completion; (c) leave it. | Clinical sign-off semantics. **Do not wire it, remove it, or change completion rules without this ruling.** | UX2-A |
| 6 | 🔒 **Signatory Gate B — auto-populated signatories with no unselected state.** Signatories pre-fill from `suggestedSignatoryProvider` and the Pathologist `<select>` has no empty option, so a report can be completed carrying a Pathologist the operator never actively chose. | **May affect real laboratory workflow.** Requires a frozen decision before any implementation. | UX2-A |
| 7 | 🔒 **May the Live Preview provenance strip be retired or changed?** Pinned by `c4-1.ts:207`, `c4-2.ts:216`, `c4-2.ts:232` (*"manual provenance must remain visible"*). Its purpose was to support the C4/C5.2 manual approvals, which are **granted**. | Amending a verifier assertion is an authority decision, never an implementer's. | UX6 |
| 8 | 🔒 **Which report-logo geometry direction?** (1) keep `21 × 15` and re-position; (2) narrow to `18 × 15`; (3) square at `15 × 15`. Direction 3 breaks the independently approved range at `c4-1.ts:165`. See UX6 scope item 2. | Alters header geometry for all 17 reports; needs re-verification and fresh visual approval. | UX6 |
| 9 | **May `architecture/UI_ARCHITECTURE.md` be corrected** to match implemented behavior (§2.4, seven conflicts)? | It is an `architecture/` authority file. | UX0 closeout |
| 10 | **`Project.md` synchronization for this program** — when, and with what scope? | `CLAUDE.md` forbids automatic modification; it is a publication-boundary task. | Program closeout |

Items **5 through 8 are frozen decision gates.** No slice may resolve them by implementation. An implementer that silently wires, removes, or reinterprets any of them has exceeded scope.

### 16.5.1 Deferred decisions — explicitly NOT blocking UX0-B / UX0-A / UX0-C

**User-confirmed at revision 3.** The following seven decisions remain open and are **deferred deliberately**. None of them gates the opening three slices, and **none may be resolved while working on them**:

| Deferred decision | Item | Belongs to |
|---|---|---|
| Inert `Confirm ✓` signatory semantics | §16.5 #5 | UX2-A |
| Auto-selected signatory behavior (no unselected state) | §16.5 #6 | UX2-A |
| Provenance strip retirement | §16.5 #7 | UX6 |
| Native-report logo geometry | §16.5 #8 | UX6 |
| History server-side search | §16.5 #3 | UX4-A |
| Version-string reconciliation | §16.5 #4 | UX1-A |
| `UI_ARCHITECTURE.md` correction | §16.5 #9 | UX0 closeout |

**Why none of them touches UX0-B, UX0-A, or UX0-C:**

- **UX0-B** edits three auth screens' logo markup only. It touches no signatory code, no report rendering, no History, no version string, and no architecture document.
- **UX0-A** edits `tailwind.config.ts` plus utility class names in eight components. `SignatorySelectionSection.tsx` appears in its file list **only** to correct `shadow-2xs` and a `hover:bg-blue-700`; that is a class-name fix and **must not** touch the `Confirm ✓` control's behavior.
- **UX0-C** creates five new primitive files and hardens `Modal.tsx`. It adopts nothing and migrates no call site.

Two specific traps to avoid while working the opening slices:

1. **The native-report logo geometry decision (#8) is NOT part of UX0-B.** UX0-B is *application* branding — `src/app/login/page.tsx` and two auth forms. The report letterhead lives in `src/rendering/native/theme.ts` and `standard/sections.ts` and is **frozen**. Do not "while I'm here" the report header.
2. **The `UI_ARCHITECTURE.md` correction (#9) is NOT part of UX0-B**, even though UX0-B makes row 2 of §2.4 stale. Bundle it into the UX0 closeout under separate authorization.

### 16.6 Verifier invocation exception — record accurately, do not "fix"

`CLAUDE.md` prescribes `node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/<name>.ts`.

**The C4-family verifiers cannot be invoked with `--conditions=react-server`.** They import `react-dom/server`, which throws:

```
Error: react-dom/server is not supported in React Server Components.
```

Affected: `verify-checkpoint-c4.ts`, `verify-checkpoint-c4-1.ts`, `verify-checkpoint-c4-2.ts`.

**Working invocation — all three PASS:**

```
node node_modules/tsx/dist/cli.mjs scripts/verify-checkpoint-c4.ts
node node_modules/tsx/dist/cli.mjs scripts/verify-checkpoint-c4-1.ts
node node_modules/tsx/dist/cli.mjs scripts/verify-checkpoint-c4-2.ts
```

Other verifiers **do** require `--conditions=react-server` (they import `server-only`).

**Do not attempt to "fix" this invocation quirk during unrelated UI/UX work.** It is a recorded environmental characteristic, not a defect in scope for any slice in this plan.

### 16.7 Frozen boundaries — quick reference

Full detail in §9. The two that catch implementers most often:

1. **`src/lib/auth-guards.ts` is byte-frozen** (M6C requires equality with Milestone 6B; two personnel verifiers pin it to baseline `5eac3f7`). **`checkRouteAccess` cannot be modified.** Role-aware navigation changes go in `config/navigation.ts` and `NavigationMenu` only.
2. **`src/features/server-boundary/server-actions.ts` is byte-frozen** (baseline `5eac3f7` in two verifiers, plus a B5 order pin at `verify-checkpoint-b5.ts:582`). **Any new server action goes in a new file**, following the `personnel-actions.ts` precedent. Do not add, reorder, or reformat anything in it.

Also byte-frozen: `authActions.ts` (SHA-256 `982bc087…`), `login-rate-limit.ts` (SHA-256 `46f04f20…`), `password.ts`, `username.ts`, `first-login-gate.ts`, `session.ts`.

Shape-pinned by `verify-checkpoint-m6c.ts` — editable, but pinned patterns must survive verbatim: `login/page.tsx`, `login/layout.tsx`, `FirstLoginForm.tsx`, `ForgotPasswordForm.tsx`, `first-login/recovery/page.tsx`, `middleware.ts`, `api/purge/route.ts`, `api/users/[id]/route.ts`, `action-inputs.ts`.

**Additionally: `src/app/login/page.tsx` is pinned by a second verifier**, `verify-lockout-countdown.ts` (8 assertions, lines 104–148). Full inventory in §17.4.

**Never expose `signatureImageUrl` to any client schema.** Derive a boolean server-side.

### 16.8 Next slice

**UX0-B — Authoritative-logo branding correction.**

Its **frozen implementation contract is §17**, written to be lifted verbatim into a delegation prompt. It closes the only *currently broken* state in the application: three auth screens requesting an intentionally deleted asset (F-47).

**It must not be implemented until the user approves the §17 contract.**

Then **UX0-A** (§11) on the clean baseline UX0-B leaves behind, then **UX0-C** (§11), which may run in parallel with UX0-A.

**Prerequisite before freezing UX0-B:** none outstanding. The former `AGENTS.md` authority gate is **satisfied** (§1.3.1, §16.5 item 1). UX0-B needs only the user's go-ahead to freeze and delegate.

### 16.9 Exact preflight instructions for the continuing agent

Do not trust this document's baseline. Re-establish it.

```bash
git rev-parse HEAD
git rev-parse origin/main
git rev-list --left-right --count origin/main...HEAD
git status --porcelain
```

Then, in order:

1. **Compare `HEAD` against `cd1152663154ed523f95ecef165a1877293e7c83`.** If it differs, diff this plan's assumptions against what landed: re-check the §9 frozen-file pins (the `5eac3f7` baselines and the two M6C SHA-256 pins in particular), and re-read `Project.md` for new carried items.
2. **Classify every working-tree entry against §16.2.** The intentional `public/st-rose-logo.png` deletion and this plan file are expected. **Do not restore the logo.** Any third entry is a hard stop — report it, do not absorb it.
3. **Read `AGENTS.md` at the repository root.** It is tracked and published (commit `7427942`) and travels with every clone, so it is present in your checkout — no external setup, no path to request. It governs agent workflow, scope control, delegation, verification, frozen-boundary handling, Git and publication, and documentation process. This plan is already reconciled against it (§1.3.1); **do not reopen that as a blocker, and do not reintroduce an external-`AGENTS.md` gate.** Amending `AGENTS.md` is a publication-boundary action requiring explicit user authorization.
4. **Re-read the milestone truth in §2.1 and §2.2 before planning any report work.** C4 is approved and frozen; C5 is complete. UX6 is post-approval refinement, not a prerequisite for anything.
5. **Re-run the baseline gates** before implementing, so a pre-existing failure is never attributed to new work:
   ```
   node node_modules/typescript/bin/tsc --noEmit
   node node_modules/next/dist/bin/next lint
   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/verify-checkpoint-c1.ts
   node node_modules/tsx/dist/cli.mjs scripts/verify-checkpoint-c4.ts
   ```
   Note the C4-family exception in §16.6.
6. **Confirm §16.5 item 1 is resolved**, then freeze **exactly one slice at a time** from §11, carrying its acceptance criteria and pinned invariants **verbatim** into the delegation contract.
7. **Honor the reviewer column in §10.** UX0-B, UX1-B, UX1-C, UX2-B, UX3, and UX6 each require a fresh read-only independent reviewer.
8. **Respect the frozen decision gates** (§16.5 items 5–8). Never resolve one by implementing it.
9. **Verify behavior in the repository, never from documentation** (§2.4 standing rule). `UI_ARCHITECTURE.md` documents keyboard shortcuts, a navigation guard, and a retention countdown that do not exist.
10. **Never commit or push** without the user's explicit request.

### 16.10 Decisions already made — do not re-litigate

Recorded so a continuing agent does not reopen settled ground.

**User decisions (revision 2):**

1. The **Whole-System User-Centered UI/UX Improvement Program is authorized**; the `Project.md` deferral is superseded (§2.3).
2. `public/st-rose-logo.png` is **intentionally deleted and permanently retired**. Never restore or substitute it (§1.2, §6).
3. `public/st-rose-logo-official.png` is the **sole branding source of truth** (§6).
4. `AGENTS.md` is **repository-local, tracked, and published** at commit `7427942`. It travels with every clone. Read it at session start; amending it is a publication-boundary action (§1.3).
5. A **compact Workspace icon-rail shell is approved for planning** (§8.1, UX3).
6. The **C4-family verifier invocation quirk is recorded, not fixed** (§16.6).

**Repository-derived decisions:**

7. **C4 is approved and frozen; C5 is complete.** UX6 is post-approval refinement, never a reopening of that sequence (§2.1, §2.2).
8. Dashboard uses **shared primitives with role-specific composition** — not three duplicated dashboards, not scattered role ternaries (§7).
9. **No new permission, role, guard, or route-access rule** anywhere in this program. Every dashboard element maps to an already-permitted data source (§4).
10. **UX0 is mandatory**, and split three ways so frozen-file risk is isolated in UX0-B (§10, §10.1).
11. The **legacy-logo repoint lives in UX0-B**, not UX0-A, because it is not a pure string swap and all three files are M6C shape-pinned (§10.1).
12. The Workspace stays a **unified stateful workspace** — not a wizard, not a modal flow (§8).
13. `lucide-react` **stays**. The taste skill's preference for another icon family is rejected as gratuitous churn (§13).
14. Report **page utilization is frozen by design**; no slice fills the sparse lower half (§14.2).
15. New server actions go in a **new file**, never in the pinned `server-actions.ts` (§9, §16.7).
16. **Navigation visibility is presentation only.** Server guards remain the enforcement boundary; hiding a nav item is never a security control (§11 UX3).
17. `design-taste-frontend`'s marketing-page material is **rejected as inapplicable**, per its own §13 out-of-scope declaration (§3).
18. **Runtime behavior is the source of truth, not architecture documentation** (§2.4 standing rule).

---

## 17. UX0-B — FROZEN IMPLEMENTATION CONTRACT

> **Status: PROVISIONALLY RECORDED — NOT FROZEN FOR IMPLEMENTATION.**
>
> The contract content stands as written and may remain in this document (user direction, revision 4). It is ready to be lifted verbatim into a delegation prompt.
>
> **It is not yet frozen and must not be delegated or implemented without the user's go-ahead.** The former `AGENTS.md` authority gate is **satisfied** (§1.3.1). The contract was re-checked against the published authority at revision 5 and required **no material change** — see §17.0.

### 17.0 Re-check against the published `AGENTS.md` (revision 5)

Performed against `AGENTS.md` at commit `7427942`, read directly from `git show HEAD:AGENTS.md`.

**Outcome: the published authority does not invalidate this contract.** One alignment change was
made; the scope, gates, invariants, and non-goals are otherwise unchanged.

| `AGENTS.md` rule | Effect on §17 |
|---|---|
| §5.4 — independent review required for a **frozen boundary**; reviewer may be Codex **or** Big Pickle / OpenCode, disqualified only by having implemented the candidate | **Changed.** §17.10 previously named a Codex reviewer. Now generalized; whichever agent implements UX0-B, the other reviews it. **This is the only change.** |
| §5.3 — *"A probe earns trust from a negative control"* | Confirms §17.8's mandatory baseline grep. No change. |
| §5.3 — mutation proof not required where the change is not security-critical | Confirms §17's "negative control instead of mutation." No change. |
| §5.1 — targeted → candidate gates → adversarial → final gate | Confirms §17.7's ordering. No change. |
| §5.2 — C4-family invocation exception; record, do not "fix" | Confirms §17.7's note. **Independently re-verified at revision 5:** none of UX0-B's four verifiers imports `react-dom/server`, so all four run under `--conditions=react-server`. No change. |
| §5.5 — manual acceptance required where deterministic tests cannot establish visual behavior | Confirms §17.13's browser/keyboard/responsive/a11y criteria. No change. |
| §6 — identify the exact invalidated assertion, change only the real boundary, never weaken an unrelated assertion | Confirms §17.4.3's "zero assertion changes expected; a failure is a scope signal, not a licence to amend." No change. |
| §7 — UI never grants capabilities; audit semantics preserved; **UI/UX skills advisory only** | Confirms §17.6's non-goals. No change. |
| §3 — a known user-owned dirty path must be explicitly classified before freezing | Confirms §17.12 blocker 4 and the treatment of the intentional logo deletion. No change. |
| §9 — no commit unless instructed; publication requires HEAD = origin = remote, 0/0, clean tree | Confirms §17.9. No change. |

**Gate health re-confirmed on the published baseline** — both pinned verifiers pass *before* UX0-B
begins, so any later failure is attributable to the slice:

```
verify-checkpoint-m6c.ts        PASS
verify-lockout-countdown.ts     PASS
```

**48 px logo treatment is an intended visual target**, subject to manual browser acceptance
(§17.13). It is **not** a domain or security invariant, and minor deviation is acceptable provided
every constraint in §17.5 holds and every assertion in §17.4 still passes.

### 17.1 Purpose

Remove all remaining runtime dependence on the intentionally deleted `public/st-rose-logo.png`, and use `public/st-rose-logo-official.png` consistently and correctly across the affected branding/auth UI.

### 17.2 Baseline and scope

| Field | Value |
|---|---|
| Baseline SHA | `cd1152663154ed523f95ecef165a1877293e7c83` |
| Files in scope | **exactly 3** |
| Files created | **0** |
| Files deleted | 0 by the implementer (the `public/st-rose-logo.png` deletion already exists and is the user's) |
| Reasoning effort | `high` — UI work against pinned files; not `xhigh`, no auth logic or persistence changes |

**Files in scope — nothing else may be modified:**

```
src/app/login/page.tsx
src/features/auth/components/FirstLoginForm.tsx
src/features/auth/components/ForgotPasswordForm.tsx
```

**All three contain a byte-identical logo block.** Verified at revision 3:

```jsx
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-brand-primary text-brand-primary-foreground shadow-sm">
          <Image
            src="/st-rose-logo.png"
            alt="St. Rose Diagnostic Laboratory Logo"
            width={28}
            height={28}
            className="h-7 w-7 object-contain"
            priority
          />
        </div>
```

at `login/page.tsx:84–94`, `FirstLoginForm.tsx:52–62`, `ForgotPasswordForm.tsx:79–89`. One identical replacement, applied three times.

### 17.3 Why this is not a string replacement

Changing only `src` produces a **visibly wrong** result, arguably worse than the current broken image.

`public/st-rose-logo-official.png` is **1254 × 1254, PNG colorType 2 — RGB with no alpha channel** (verified by reading the IHDR directly). It cannot render transparently. Dropping it into the existing `bg-brand-primary` wrapper renders **an opaque white square inside a teal rounded square**.

Three corrections are therefore required together:

1. repoint `src` to the official asset;
2. **remove the colored backing plate** (`bg-brand-primary text-brand-primary-foreground`), so the opaque asset sits on the card surface;
3. correct the sizing — the asset is 1:1 and currently forced into a 28px box inside a 48px plate.

### 17.4 Frozen assertion inventory — READ BEFORE EDITING

**Two verifiers pin these files, not one.** Revision 2 named only M6C and was incomplete.

#### 17.4.1 `scripts/verify-checkpoint-m6c.ts` → `verifyCredentialVisibilityControls()`, lines 594–679

8 `assert()` statements, two of which loop three times → **12 effective conditions**.

| Line | File | Condition |
|---|---|---|
| 596 | FirstLoginForm | `[showAnswer, setShowAnswer] = useState(false)` **and** `type={showAnswer ? "text" : "password"}` |
| 602 | FirstLoginForm | `aria-label={showAnswer ? "Hide recovery answer" : "Show recovery answer"}` |
| 608 | FirstLoginForm | `className="relative"` … `className="pr-10"` … `<button` … `type="button"` … `absolute right-3 top-1/2 -translate-y-1/2` (lazy multiline scan) |
| 616 | login/page | `aria-label={showPassword ? "Hide password" : "Show password"}` |
| 623 | FirstLoginForm **+** login/page | **negative** — neither may contain `tabIndex={-1}` |
| 628 | *(filesystem)* | `/forgot-password` `layout.tsx` and `page.tsx` must exist |
| 633 | login/page | imports `Link` from `next/link`, renders `<Link href="/forgot-password">Forgot password?</Link>`, **and negative** — no `href="#"` |
| 651 ×3 | ForgotPasswordForm | `showAnswer`/`answer`, `showNewPassword`/`password`, `showConfirmPassword`/`confirmPassword` each masked by default |
| 665 ×3 | ForgotPasswordForm | each of the three carries both switching `aria-label`s |
| 673 | ForgotPasswordForm | ≥ 3 `<button type="button">` **and negative** — no `tabIndex={-1}` |

#### 17.4.2 `scripts/verify-lockout-countdown.ts` → 8 assertions on `login/page.tsx` (lines 104–148)

| Line | Condition |
|---|---|
| 104 | contains `getLockoutRetryAfterAction` |
| 110 | contains `await getLockoutRetryAfterAction` |
| 116 | **negative** — must not hard-code thresholds: no standalone `6` on a line with `failure`/`attempt`/`lockout`, no `900000`, no `15 * 60 * 1000` |
| 122 | `disabled=` … `retryAfterMs` or `isLocked` on the same line |
| 128 | contains `minute(s)` / `second(s)` / `retryAfterMs` |
| 134 | contains `loginAction` |
| 140 | contains `useEffect` |
| 147 | contains the exact string `Too many login attempts. Please try again later.` |

#### 17.4.3 The load-bearing conclusion

**Not one of these 20 conditions references the logo, the `<Image>`, the `CardHeader`, or the wrapper `<div>`.** The change surface is fully orthogonal to every pinned assertion.

> **Therefore: UX0-B must require ZERO assertion changes.**
>
> This is the contract's primary safety property. **If any assertion fails, that is the signal that the change went out of scope — not a reason to amend the assertion.** Stop, report, and narrow the change. Do not weaken, rewrite, or delete any assertion in either verifier.
>
> The only condition with any plausible interaction is m6c:623 / m6c:673 — **do not add `tabIndex={-1}` to the image or its wrapper.** There is no reason to; it is recorded so the trap is visible.

### 17.5 Exact required change

Replace the identical block in all three files with:

```jsx
        <div className="mx-auto flex h-12 w-12 items-center justify-center">
          <Image
            src="/st-rose-logo-official.png"
            alt="St. Rose Diagnostic Laboratory"
            width={48}
            height={48}
            className="h-12 w-12 object-contain"
            priority
          />
        </div>
```

Point by point:

| Aspect | From | To | Why |
|---|---|---|---|
| Source | `/st-rose-logo.png` | `/st-rose-logo-official.png` | The former is intentionally deleted; the latter is the sole source of truth (§6). |
| Backing plate | `rounded-xl bg-brand-primary text-brand-primary-foreground shadow-sm` | *removed* | The asset has no alpha and would render as a white block on the teal fill (§17.3). |
| Rendered size | 28 × 28 in a 48px plate | 48 × 48 | Fills the space the plate occupied; keeps the header rhythm identical, so `space-y-3 pb-6 text-center` needs no change. |
| Aspect | 1:1 already | 1:1 preserved | `object-contain` retained as a safety net; `width`/`height` match the asset's 1:1 ratio. |
| Alt text | `"St. Rose Diagnostic Laboratory Logo"` | `"St. Rose Diagnostic Laboratory"` | Screen readers already announce the element as an image; "Logo" is redundant. |
| `priority` | present | **retained** | Above-the-fold on the login route. |

The wrapper `<div>` is **kept** (not inlined onto the `<Image>`) so `mx-auto` centering and the `CardHeader`'s `space-y-3` rhythm are structurally unchanged. Minor deviation from this exact markup is acceptable **only** if every constraint above still holds and every §17.4 assertion still passes.

### 17.6 Explicit non-goals — scope violations if done

- **Do not recreate `public/st-rose-logo.png`.** Not by `git checkout`, not by copying the official asset to that name, not by any other route.
- **Do not introduce any alternate, generated, redrawn, recolored, or placeholder logo**, in any format, even temporarily.
- **Do not add any file to `public/`.**
- **Do not touch `src/rendering/**`.** The report letterhead's `21 × 15 mm` logo box is a **separate, frozen, deferred decision** (§16.5 item 8, UX6). This slice is application branding only.
- **Do not touch `src/components/layout/Sidebar.tsx`.** It already uses the official asset correctly and is the reference implementation.
- Do not change auth logic, form fields, validation, submit handling, or error copy.
- Do not change lockout behavior, the countdown, the retry state, or the lockout error string.
- Do not change login, logout, or any audit behavior.
- Do not restyle the form controls — that is UX5.
- Do not fix Tailwind utility classes encountered along the way — that is UX0-A. `shadow-sm` in the removed wrapper is a *valid* v3 class and its removal here is incidental to deleting the plate, not a token fix.
- Do not correct `architecture/UI_ARCHITECTURE.md` (§16.5 item 9, deferred).
- Do not modify `Project.md`, migrations, or Supabase.

### 17.7 Deterministic gates

Run in this order. **M6C and the lockout verifier run first**, because they are the ones the change could plausibly break.

```
node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/verify-checkpoint-m6c.ts
node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/verify-lockout-countdown.ts
node node_modules/typescript/bin/tsc --noEmit
node node_modules/next/dist/bin/next lint
node node_modules/next/dist/bin/next build
node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/verify-personnel-directory.ts
node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/verify-personnel-signatures.ts
```

The last two pin `auth-guards.ts` and `server-actions.ts` to baseline `5eac3f7`; they prove this slice did not drift into adjacent auth surfaces.

**Note on `next build`:** `Project.md` records that a bare build fails during page-data collection on `/api/users/summary` for a missing `SUPABASE_SECRET_KEY` when no `.env` is present. That is environmental. Use the same placeholder approach already recorded for the P1 slice, and state which was used.

The C4-family exception in §16.6 does **not** apply here — none of these verifiers imports `react-dom/server`.

### 17.8 Closing invariant and its negative control

**Required closing invariant:**

```
grep -rn "st-rose-logo\.png" src/ scripts/ | grep -v official
→ 0 results
```

**Negative control — mandatory, and it must run FIRST.** A probe that cannot report the condition it claims to detect proves nothing. Before making any edit, run the identical command against the unmodified tree and record that it reports exactly these three lines:

```
src/app/login/page.tsx:86:            src="/st-rose-logo.png"
src/features/auth/components/FirstLoginForm.tsx:54:            src="/st-rose-logo.png"
src/features/auth/components/ForgotPasswordForm.tsx:81:            src="/st-rose-logo.png"
```

Both runs — the pre-change positive and the post-change zero — must appear in the slice report. A post-change `0` with no recorded pre-change `3` is **not** accepted as evidence.

**Second invariant:** no new file in `public/`.

```
git status --porcelain public/
→ only " D public/st-rose-logo.png"
```

### 17.9 Commit composition

**The intentional deletion is included in the UX0-B commit.** This is what makes the deletion complete rather than dangling.

Staged set — exactly four paths, nothing else:

```
D  public/st-rose-logo.png                                   (the user's intentional deletion)
M  src/app/login/page.tsx
M  src/features/auth/components/FirstLoginForm.tsx
M  src/features/auth/components/ForgotPasswordForm.tsx
```

`architecture/whole-system-user-centered-ui-ux-improvement-plan.md` is published separately as the planning artifact (§17.11), **not** in this commit.

**No commit is created without the user's explicit request.** `CLAUDE.md` and the standing program rules both apply: implement, verify, leave it in the working tree, and stop.

### 17.10 Independent review boundary

**A fresh read-only independent reviewer is REQUIRED.** Trigger: the slice modifies files carrying frozen, security-adjacent shape assertions — `AGENTS.md` §5.4 requires review for a frozen boundary.

**Who may review.** Either **Codex** or **Big Pickle / OpenCode**, in a fresh context. Per `AGENTS.md` §2 and §5.4, reviewer and implementer are roles rather than fixed identities: **the only disqualifier is having produced the candidate under review.** Claude's scope, diff, and publication review does **not** satisfy this requirement. Whichever agent implements UX0-B, the other reviews it.

**Reviewer packet — the smallest self-sufficient set:**

1. The three diff hunks (they are identical; supply all three so the reviewer can confirm sameness).
2. The §17.4 assertion inventory, both verifiers, with line numbers.
3. `src/components/layout/Sidebar.tsx` lines 38–48 — the **same-layer precedent** showing correct official-asset usage.
4. §6 logo rules and the §17.3 no-alpha finding.
5. Evidence that `public/` gained no file.
6. The negative-control output plus the closing-invariant output.

**Reviewer contract.** READ the packet and the named assertions. DO NOT implement, mutate, rerun the gate suite, or investigate unrelated areas. RETURN blocking findings, should-fix findings, observations, or an explicit no-finding statement.

**Specific questions for the reviewer:**

- Does any of the 20 pinned conditions in §17.4 interact with the changed markup?
- Was any assertion weakened, rewritten, or removed? (Expected answer: none — §17.4.3.)
- Could the official asset render on a colored fill anywhere after this change?
- Is any auth, lockout, or audit behavior altered?

### 17.11 Publication and documentation requirements

1. **Publish this planning artifact first.** The opening sequence is *Planning publication → UX0-B → UX0-A → UX0-C* (§10). `architecture/whole-system-user-centered-ui-ux-improvement-plan.md` is currently untracked and should land as its own documentation commit before implementation begins.
2. **After UX0-B lands,** `architecture/UI_ARCHITECTURE.md` §2.2 row 2 becomes stale — it still names `public/st-rose-logo.png` as the application logo. **Do not correct it inside this slice** (§16.5 item 9 is deferred); bundle it into the UX0 closeout under explicit authorization.
3. **Do not modify `Project.md`.** Program synchronization is a separate publication-boundary task (§2.3, §16.5 item 10).

### 17.12 Blockers before delegation

| # | Blocker | Status |
|---|---|---|
| 1 | ✅ **`AGENTS.md` reconciliation.** Authority published repository-local at commit `7427942`; this contract was re-checked against it at revision 5 and required **no material change** (§1.3.1, §17.0). | **SATISFIED** |
| 2 | Contract content approved by the user. | ✅ **Provisionally recorded** at revision 4. The contract stands as written and may remain in this document; it is **not** thereby frozen for implementation — blocker 1 still gates that. |
| 3 | Planning artifact published (§17.11 item 1). | Open — sequencing preference, not a hard blocker |
| 4 | Working tree classified: only the intentional deletion and the plan artifact present. | ✅ verified at revision 4 |
| 5 | Baseline confirmed at `cd11526`, `HEAD` == `origin/main`. | ✅ verified at revision 4 |

**No authority blocker remains.** Blocker 1 is satisfied and blocker 2 is approved. **UX0-B is ready for final freeze and delegation on the user's go-ahead.** Blocker 3 clears with the publication of this plan.

### 17.13 Acceptance criteria

**Deterministic.** All gates in §17.7 PASS. Closing invariant and negative control in §17.8 both recorded. No assertion in either verifier amended.

**Manual browser acceptance.** All three screens — `/login`, `/first-login/password`, `/forgot-password` — at **375px and 1440px**, each showing the official mark rendering correctly with **no white box and no teal plate**. The browser network panel shows **no 404 for `/st-rose-logo.png`** on any of the three.

**Keyboard acceptance.** On all three screens the password / recovery-answer visibility toggles remain keyboard reachable and correctly labelled, and tab order through each form is unchanged. The image introduces no tab stop.

**Responsive acceptance.** 375 / 768 / 1440. The mark scales without distortion and does not crowd the "St. Rose / Diagnostic Laboratory" wordmark at 375px.

**Accessibility acceptance.** `alt` describes the laboratory and does not say "logo". Both pinned `aria-label` pairs still present on each screen. Card-surface contrast behind the mark is unchanged. No `tabIndex={-1}` added anywhere.

**Behavioral acceptance.** Login succeeds with valid credentials. Login fails correctly with invalid credentials. The lockout countdown still renders and still counts down. Logout still works. **No audit behavior changed** — this slice emits nothing and alters no emit path.

### 17.14 Structured report required from the implementer

1. Files changed.
2. Implementation result.
3. Verification clusters with PASS/FAIL, per §17.7.
4. **Negative control**: the pre-change grep output (expect 3 lines) and the post-change output (expect 0).
5. Confirmation that **no assertion in `verify-checkpoint-m6c.ts` or `verify-lockout-countdown.ts` was amended**.
6. Confirmation that `public/` gained no file and `st-rose-logo.png` was not recreated.
7. Every path created or modified, including temporary files.
8. Unresolved findings or decisions.
9. Elapsed time and approximate usage.
