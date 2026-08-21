# AGENTS.md

**St. Rose Laboratory Result Management System — project operating authority.**

Governs every AI agent working in this repository — currently Claude (§2), and any implementation or
review agent the user explicitly authorizes later. Read at session start. Never restate it wholesale
into a downstream prompt; carry only the applicable rules inline.

> **This file is the repository-local project operating authority. It takes effect upon
> publication** — the commit that adds it to the repository. From that commit forward it governs
> every agent session, and it travels with every clone. See §12.

---

## 1. Authority

### 1.1 Migration record

The previous project authority was an **external `AGENTS.md` held outside the repository**, on a
different machine, and was **never available on the current working machine**. The user
**explicitly chose to replace it rather than reconcile against it**.

**This file does not reconstruct, reproduce, paraphrase, or infer the contents of that external
file.** It is derived from `PROJECT.md`, `CLAUDE.md`, the approved architecture handoffs, the
repository itself, and the conventions this project already demonstrably follows. No agent may
represent it as equivalent to, or a recovery of, the former external document.

### 1.2 Precedence — separated by concern

**Authority in this project is separated by concern. There is no single universal precedence
ladder, and this section must never be flattened into one.** `PROJECT.md` states the principle
directly: *"Authority is separated by concern."*

#### What `AGENTS.md` governs

This file is authoritative for **process**:

- agent workflow
- scope control
- delegation
- verification
- frozen-boundary handling
- Git and publication
- documentation process

**Within those concerns**, and only within them, this order applies when two of them disagree:

1. **`AGENTS.md`** — agent operating rules, requirements integrity, scope control, decision handling
2. **`PROJECT.md`** — confirmed project decisions, milestones, phase gates, render policy
3. **Approved architecture handoffs** — `architecture/`, ADRs, frozen specifications, approved plans
4. **Repository / runtime truth** — what the code and the running system actually do
5. **Delegated implementation instructions** — a frozen slice contract or delegation prompt

#### What `AGENTS.md` does not override

**This file does not override a domain-specific authority on that authority's own concern.** The
following retain full authority within their domains, and no process rule here may be used to
justify overriding them:

| Authority | Authoritative for |
|---|---|
| `LABORATORY_TEMPLATE_SPECIFICATION.md` and other approved clinical / report specifications | **Clinical and report meaning** — parameters, reference rules, evaluation, omissions, titles, signatory requirements |
| **Completed snapshots** | **Frozen historical state and output** for any completed report |
| `PROJECT.md` | **Project state, milestones, and the authority-by-concern mapping itself** |
| **Approved architecture handoffs** | **Intended implementation design within their bounded slice** |

**A process rule never authorizes a clinical, report-semantic, or historical-output change.** If
following a rule in this file would require one, that is a conflict — stop and report it (§1.4).

### 1.3 Documentation versus runtime

These are **different kinds of authority and must not be collapsed**:

- **Repository / runtime truth is authoritative for what the system currently *does*.**
- **Approved architecture and specifications are authoritative for what the system is *intended* to
  do.**
- **When the two diverge, the divergence is a reportable defect or drift requiring investigation.**
- **Never silently resolve the conflict** by assuming that code always wins or that documentation
  always wins. Neither is true.

**Never claim a capability exists because a document says so** — verify it in the code or in the
running application. **Conversely, never treat existing code as permission to ignore a
specification.** Existing behavior is evidence of what is, not authorization for what should be.

This matches `PROJECT.md`: *"If documentation and implementation disagree, the conflict must be
investigated rather than silently resolved."*

### 1.4 Conflicts

If any two authorities conflict, **stop and report it**. Do not guess, do not average them, and do
not pick the one that makes the current task easier.

---

## 2. Agent roles

**One reasoning owner per stage.** Never two agents independently solving the same problem, reading
the same diff, or running the same gate.

| Agent | Owns |
|---|---|
| **Claude** | The active agent. Planner and architect · scope and contract freezer · authority interpreter · **implementation** · verification · Git and publication integrity owner · reviewer of evidence and milestone boundaries |

**Claude is currently the only agent authorized to work in this repository.** Codex and
Big Pickle / OpenCode are **not used**, and no work is delegated to them, unless the user explicitly
re-authorizes them. An older instruction, prompt, or document that assumes delegation to them does
not by itself constitute that authorization.

**Independence rule.** For any slice requiring independent review (§5.4):

- the agent that produced the candidate **must not** perform the designated independent review of
  that same candidate;
- the reviewer must be an **explicitly user-approved** independent reviewer, in a fresh context;
- Claude still performs scope, diff, and publication review, but **that never substitutes for a
  required independent reviewer** unless the governing frozen contract explicitly permits it.

Because Claude both plans and implements on this account, **Claude can never satisfy a mandatory
independence requirement for its own candidate.** Where §5.4 requires independent review and no
approved reviewer is available, the slice **stops before publication** for the user's decision. That
requirement is never silently waived, self-satisfied, or downgraded to "Claude reviewed it".

**Preferred flow:**

```
plan / freeze → implement → targeted gates
              → approved independent reviewer only when §5.4 requires → publication
```

**Anything Claude implements is recorded as Claude-authored**, and is named explicitly in the
reviewer packet on any slice that requires independent review.

**Do not duplicate verification.** Re-run a gate only when it was interrupted, its evidence is
missing, partial or unattributable, or it is contradicted by the diff or a review finding.
Independent review is *reasoning* review, not a second run of the deterministic suite. Reserve it for
the risk levels named in §5.4.

---

## 3. Preflight

Before freezing any slice, establish and report:

1. local `HEAD`
2. `origin/main`
3. ahead / behind count
4. **working-tree classification** — every entry, individually
5. the published baseline SHA used for planning
6. **which changes are user-owned and which are agent-created**

**A known user-owned dirty path is not automatically an agent-created defect.** It must, however, be
**explicitly classified before a slice is frozen**. Never stash, discard, revert, commit, or absorb a
pre-existing change automatically. An unclassified or unexpected entry is a hard stop.

**There are currently no standing expected working-tree entries.** Any dirty path must be classified
against the active slice or the user's own work before a slice is frozen.

---

## 4. Scope discipline

- **Smallest coherent slice.** Slice by cohesion and risk, never by line count.
- **No speculative abstractions.** Build what the approved slice requires.
- **No unrelated cleanup.** Not even obviously correct cleanup.
- **Reuse existing architecture and components** before adding new ones.
- **Report adjacent findings; do not silently fix them.** A defect noticed in passing is recorded for
  its own slice.
- **Never invent requirements, fields, rules, wording, or styling.** Requirements integrity is
  absolute: an unconfirmed requirement is always asked about, never assumed.

**Ask the user when:** the approved plan must change or scope would expand · an architectural
decision changes · authority conflicts with the plan · a manual approval gate is reached · the work
belongs to a later milestone · the working tree is dirty in an unclassified way · correction rounds
are exhausted.

**Do not ask what the repository can answer.** Where a method is defined, what a verifier pins, which
component renders a route — read the code.

---

## 5. Verification

Lean and risk-proportionate. Run the smallest check capable of catching what the current step could
break.

### 5.1 Ladder

1. **Targeted** — one focused check while iterating, as a fast failure signal.
2. **Candidate gates** — once the diff stops changing, run the deterministic gates whose assertions
   the diff can actually reach, plus `tsc`.
3. **Adversarial** — risk-based mutation proof (§5.3).
4. **Final gate** — after the candidate is stable and every perturbation is restored, run the
   complete required suite **once**, including `lint` and `build`.

**One final full gate at the publication boundary**, unless executable code, verifier logic, or
security configuration changes afterward — then re-run what that change can reach. Documentation-only
changes do not re-trigger it.

**Deterministic PASS evidence applies only to the exact candidate it verified.** If the candidate
changes, the evidence reachable from that change is invalid.

### 5.2 Invocation

Use direct `node` invocations. `npm` / `npx` shims are blocked by the PowerShell execution policy.

```
node node_modules/typescript/bin/tsc --noEmit
node node_modules/next/dist/bin/next lint
node node_modules/next/dist/bin/next build
node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/<name>.ts
```

**Known invocation exception — record it, do not "fix" it.** Exactly four verifiers import
`react-dom/server` and therefore **cannot** run under `--conditions=react-server`; under that flag
they fail on `react-dom/server is not supported in React Server Components` **before any assertion
runs**:

- `verify-checkpoint-b4.ts`
- `verify-checkpoint-c4.ts`
- `verify-checkpoint-c4-1.ts`
- `verify-checkpoint-c4-2.ts`

They pass without the flag. Other verifiers require it. Do not "repair" this during unrelated work.

**A verifier that fails to *start* has proved nothing.** Distinguish that from an assertion failure
and report it as such, and never retry with the other invocation to turn a red gate green without
stating which invocation produced which outcome.

### 5.3 Adversarial verification

**Required** when a new security-critical assertion has no behavioural failure demonstrating it can
fail · an assertion could pass because of fixture shape, ordering, or an over-broad predicate · the
verifier is itself part of the boundary being changed.

**Not required** when an existing behavioural test already fails for the prohibited condition · the
invariant is independently proven · the change is not security-critical.

One representative mutation per invariant. Record the invariant, the intended assertion, **the
assertion that actually fired**, and the restore hash. If the wrong assertion fires, the mutation is
not proof. Restore only from a byte-verified backup kept outside the repository.

**A probe earns trust from a negative control.** A check that cannot demonstrate it detects the
absent or failing condition proves nothing.

### 5.4 Independent review

**Required** for: authentication or authorization · Developer isolation · credentials or secrets ·
audit confidentiality · privacy or sensitive data · RLS or security policy · migrations, schema, or
security configuration · destructive or live-database work · a frozen boundary · an unresolved
evidence contradiction · **any publication boundary**.

**Not required** for an ordinary low or medium-risk slice.

**Who may review.** Only an independent reviewer **the user has explicitly approved**, in a fresh
context. **The disqualifier is having produced the candidate under review** (§2 independence rule),
which on the current account excludes Claude from reviewing its own work. No agent becomes an
approved reviewer by being available, by being a different model, or by being named in an older
document.

**If no approved independent reviewer is available, the slice stops before publication** and the
user decides: approve a reviewer, accept the residual risk explicitly, or defer the slice. Claude may
analyse provisionally to surface blockers, and must report the state as **INDEPENDENT REVIEW
PENDING** — that never satisfies the requirement, which stays open until an approved reviewer
completes it or the user waives it having seen the residual risk. **Never silently waive,
self-satisfy, or downgrade an independence requirement.**

**Reviewer packet.** When a review does run, the reviewer is supplied a **bounded packet** — the
smallest *self-sufficient* set, never the full diff by default: the frozen contract and invariants,
security-relevant hunks, schema and security changes, **every changed or deleted existing
assertion**, the closest same-layer precedent, and a concise verification summary. Where the reviewer
cannot run Git, Claude supplies the diff and any expected frozen-file hashes.

### 5.5 Manual acceptance

**Required wherever deterministic tests cannot establish visual or interaction behavior** — layout,
responsive behavior, keyboard flow, focus, contrast, print and preview output, and any live database
effect. Type checks, lint, and build all pass happily on code nothing calls.

Before any live write, enumerate every field the post-write check will assert and **capture a
baseline for each one**. Never assert "unchanged" on a field that was not captured.

---

## 6. Frozen boundaries

Some files are SHA-pinned or shape-pinned by verifiers. **They cannot be changed casually.**

If a frozen boundary genuinely must change:

1. **Identify the exact invalidated assertion** — file and line.
2. **Change only the real boundary.** Decide whether the implementation or the assertion is wrong,
   and correct that one.
3. **Require independent review.**
4. **Never weaken an unrelated assertion**, and never preserve an assertion's letter while defeating
   its purpose.

**Never evade a textual verifier.** A semantically equivalent rewrite made only to slip past an
assertion is prohibited. When correct code conflicts with a verifier's assumption, **stop and report
the conflict**.

**A persistent pin must be checkout- and platform-invariant** — normalize line endings before
hashing, preserve exact-content equality otherwise, and never relax a pin into a substring check.

---

## 7. Security and domain preservation

- **Role permissions are server-authoritative.** Every guard stays where it is.
- **UI changes never grant capabilities.** Hiding or showing a control is presentation only and is
  never a security control. Enforcement remains in the server guards.
- **Audit semantics must not change accidentally.** Event type, category, actor derivation,
  `target_reference`, and `details` shape are all load-bearing. `developer_involved` is
  database-derived and never written by application code.
- **Clinical and report semantics are authoritative** — parameters, reference rules, evaluation
  outcomes, omissions, titles, signatory order.
- **Completed snapshots are authoritative** and are never clinically recomputed at render time.
- **Never expose `signatureImageUrl` to a client schema.** Derive a boolean server-side.
- **UI/UX and design skills are advisory only** and are subordinate to every rule in this section.

---

## 8. Supabase and production SQL

- Agents **may** inspect the database read-only and **prepare** migrations and SQL.
- Agents **must not apply production SQL**, DDL, or any schema change.
- **The user applies approved SQL manually in Supabase.**
- **Live verification happens afterward**, against the applied state.

A dashboard project ref is not proof of the target database — confirm by data fingerprint. PostgREST
may take up to a minute to expose new functions after a schema reload, so immediate absence is not
evidence of failure.

---

## 9. Git and publication

- **No commit unless the current workflow instructs or allows it.** Work stays in the working tree
  for review.
- When a commit is made, **report its SHA and subject, and the exact push range**.
- **No push without the user's authorization.**
- **Publication requires:** local `HEAD` == `origin/main` == remote SHA · `0/0` ahead-behind · clean
  tree.
- Review the exact diff and the staged set before committing. Never stage a path outside the slice.
- Never weaken Git's ownership protection (for example `safe.directory`) to work around a sandbox.

**`PROJECT.md` is never modified automatically.** Synchronizing it is a separate, explicitly
authorized publication step.

---

## 10. Documentation

- **Architecture handoffs must survive context loss.** Another implementation agent must be able to
  continue from the document alone: baseline SHA, repository state, frozen boundaries, unresolved
  decisions, next slice, and exact preflight instructions.
- **`PROJECT.md` is synchronized when milestone or project truth materially changes** — completed
  progress, deferred work, known gaps, handoff context. Under explicit authorization only.
- **Do not document transient implementation noise as permanent architecture.** Scaffolding,
  intermediate states, and one-off debugging details do not belong in an authority file.
- Record known exceptions and residuals honestly rather than quietly working around them.

---

## 11. Current program

**A Whole-System User-Centered UI/UX Improvement Program is the approved active direction.**

- Governing handoff: `architecture/whole-system-user-centered-ui-ux-improvement-plan.md`
- Focus: usability · visual hierarchy · consistency · speed · accessibility · keyboard efficiency ·
  responsive behavior · error prevention · workflow clarity · professional clinical polish
- **Do not redesign working behavior purely for aesthetics.**
- **UI UX Pro Max** and **Taste** are **advisory skills only**, subordinate to §7.

**Branding.** `public/st-rose-logo-official.png` is the **sole** branding source of truth.
**Never generate, substitute, recreate, or redraw any other logo.** `public/st-rose-logo.png` is
intentionally deleted and permanently retired.

---

## 12. Status of this file

**This file is authoritative from the commit that publishes it.** It is a tracked repository file
and travels with every clone, so any agent working in any clone has the complete project authority
available without external setup.

It supersedes the former external `AGENTS.md` for all purposes from that point forward (§1.1).

**Two authority questions were resolved by the user before publication**, and both resolutions are
final:

- **Documentation versus runtime** — §1.3. Runtime is authoritative for what the system *does*;
  approved specifications are authoritative for what it is *intended* to do; divergence is a
  reportable defect requiring investigation, never silently resolved in either direction.
- **Concern separation** — §1.2. This file governs process. It does not override domain-specific
  authorities on their own concerns, and §1.2 must never be flattened into one universal ladder.

**Amending this file is a publication-boundary action** requiring explicit user authorization, the
same as `PROJECT.md` (§9).
