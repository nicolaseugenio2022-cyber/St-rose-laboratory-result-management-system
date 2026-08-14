# CLAUDE.md

Orchestration rules for Claude Code in this repository.

Project, domain, clinical, and architectural rules are **not** defined here.
This file governs only the division of labour between Claude, Codex, and the user.

## Authority

Read at session start; treat as authoritative and never restate or override:

- `AGENTS.md` — AI operating rules, requirements integrity, scope control, decision handling
- `Project.md` — confirmed project decisions, milestones, phase gates, render policy
- `LABORATORY_TEMPLATE_SPECIFICATION.md` and `architecture/` — report specifications, ADRs, implementation guidelines

## Roles

- **Claude** — planner, authority interpreter, scope freezer, and decision gate. Not the
  implementer, save for the surgical exception below, and not the routine re-verifier.
- **Codex Implementer** (`codex exec`) — primary implementer **and** primary deterministic verifier.
- **Codex Reviewer** — a fresh read-only session, at high-risk boundaries only. See Independent review.
- **User** — approves plans and any material change to an approved plan.

Operating principle: **one reasoning owner per stage.** Never two agents independently solving the
same problem, reading the same diff, or running the same gate.

**Claude owns, normally only these:** Git preflight and repository integrity · selective authority
interpretation · requirement clarification and user-decision gates · scope and security freeze ·
one minimal Codex contract · generating the bounded diff/patch when independent review is required ·
final Git integrity, status, and frozen-boundary verification · adjudicating findings, evidence
contradictions, and residual risk · committing only after every required gate passes **and** the
user has authorized that commit.

**Codex Implementer owns:** implementation investigation within the frozen scope · the code change ·
Levels A, B, C and D (see Verification ladder) · mutation proofs with byte-verified restore ·
frozen-file integrity by supplied SHA-256 where Git is unavailable · a concise structured report. It does
not rediscover architecture Claude supplied and does not restate project context.

**Claude does not** re-investigate Codex's implementation, rerun a gate Codex executed successfully,
rebuild mutation harnesses, or narrate implementation. See Review contract for when Claude reads code.

**Surgical exception.** Claude may implement directly only when *all* hold: the change is trivial
and tightly bounded; the correct form is already established by the frozen plan; no new
architectural reasoning is required; and delegation overhead would plainly exceed the edit.
Examples: removing an unused prop, correcting a one-line call signature, fixing a verifier fixture
literal, adding an aria-label the frozen plan already specifies. **Never** for feature work,
authentication, authorization, persistence design, migrations, query projection, or anything
security-sensitive — those are delegated or replanned. Anything implemented under this exception is
recorded in the review as Claude-authored.

## Version control

Neither Claude nor Codex may commit or push unless the user explicitly requests it.
All work stays in the working tree for review.

**Authorized `main` publication boundary**, in order: verify the candidate · review the exact diff
and staged set · create the approved implementation commit(s) · **stop for explicit `PROJECT.md`
synchronization authorization** unless already given for this publication, since `AGENTS.md` forbids
modifying `PROJECT.md` automatically · synchronize `PROJECT.md` to the actual committed state,
including completed progress, deferred work, known gaps, and handoff context · review it against the
repository and Git history · commit the documentation synchronization · push only approved commits ·
observe exact-commit CI · verify local `HEAD` against `origin/main`.

## Workflow

1. **Inspect** — read the relevant source and authority files before planning.
2. **Plan** — produce a concrete plan: scope, explicit out-of-scope, affected files/areas, acceptance criteria, verification steps.
3. **Stop** — present the plan and wait. Before explicit approval: do not invoke Codex, do not write application code.
4. **Freeze** — on approval the plan is frozen. Then run `git status` and require a clean working tree:
   - Clean — record the current `HEAD` SHA as the review baseline and proceed.
   - Record the frozen checkpoint contract: baseline SHA · the authority sections relied on ·
     pinned invariants · slice boundaries · acceptance criteria.
   - Not clean — **stop** and report the existing changes to the user.
   - Never stash, discard, commit, revert, or absorb pre-existing changes automatically.
   - Proceed with a dirty tree only when the user explicitly authorizes it and states how those changes are to be treated.
5. **Delegate** — hand the frozen slice to `codex exec` (see Delegation contract).
6. **Review** — independently inspect the repository (see Review contract). Codex's summary is evidence, never proof.
7. **Correct** — a mistake lying entirely inside the frozen plan may be sent back to Codex without asking. Maximum **2** automatic correction rounds; review again after each. Once exhausted, stop and report.
8. **Declare** — report completion only after independently verifying every acceptance criterion.

**The frozen checkpoint is the working authority for its own slices.** The expensive reading and
reconciliation happen once, at planning. Do not reread unchanged authority files or rederive the
same architecture for each slice. Reconcile again only when: a contradiction surfaces · scope
changes · a directly required dependency introduces a rule the freeze did not capture · the
implementation exposes an assumption never actually established · a security-sensitive finding
warrants it · an authority file changes on disk · or a new session begins. Otherwise continue from
the freeze.

**Slice by cohesion and risk, never by line count.** Prefer one delegation when the work is a
single cohesive reasoning unit with shared invariants and a bounded context packet. Split when
responsibilities are independently understandable · different security boundaries are involved ·
separate investigations need materially different context · combining would produce an oversized
prompt or excessive Codex reasoning · independent rollback and verification would be safer · or
the combined slice would risk the ten-minute foreground wall. Changed-line count is an informal
signal only and is never an authority rule. Each slice must have a single unambiguous completion
boundary. The two-round automatic correction limit applies **per slice**; re-slicing work to
obtain a fresh correction budget is a hard stop.

When one delegation covers both production and verifier changes, the prompt must name the existing
assertions that the production change will invalidate, and state how they are to be repaired.

## Hard stops — ask the user

Inspect before escalating. Questions the repository can answer — where a method is defined, whether
an interface exposes `findAll()`, which component renders a route, what a verifier pins — are
resolved by reading, never by asking. Escalate genuine product, UX, security, or scope decisions.
(This narrows nothing in `AGENTS.md`: unconfirmed *requirements* are still always asked about.)

- The approved plan must change, or scope would expand.
- An architectural decision changes.
- Repository authority conflicts with the plan, or documentation and implementation disagree.
- A manual approval gate defined in `Project.md` is reached — neither Claude nor Codex can satisfy it.
- The work belongs to a later milestone or checkpoint, or is an unrelated improvement.
- The working tree is dirty at freeze time.
- Correction rounds are exhausted.
- The Codex session's actual model or reasoning effort does not match gpt-5.6-sol / high.

## Delegation contract

Implementation delegations must pin the model explicitly. Never rely on ambient global
config — `~/.codex/config.toml` can change between delegations without the plan, the
prompt, or the review noticing:

```
codex exec -m gpt-5.6-sol -c model_reasoning_effort="high" --sandbox workspace-write "<prompt>"
```

Read-only inspection tasks may use `--sandbox read-only`; the model pin still applies.

**After a Codex timeout, prefer a fresh narrowly scoped delegation over `codex exec resume`.**
First establish what actually landed: inspect the working tree, determine whether the Codex process
survived, check for a stranded thread-store writer, and review the partial diff. Never blindly
rerun the original prompt.
A wrapper timeout does not necessarily kill the Codex process: it can survive, hold the
thread-store writer lock, and make `resume` fail with `already has an active writer`. `resume` also
rejects `--sandbox`. A fresh `codex exec` scoped to only the remaining work avoids both problems —
it must restate the constraints, since a new session inherits no context. Check for a stranded
process before relaunching.

Every implementation prompt uses these headings and normally nothing else:

```
BASELINE           baseline SHA; what previous slices already landed
GOAL               the one outcome this slice must produce
FILES IN SCOPE     named paths
EXACT CHANGES      the frozen change, precisely enough to implement without redesign
PINNED INVARIANTS  the applicable invariants, stated inline by Claude
FROZEN HASHES      expected SHA-256 for frozen files Codex must self-check (Git is unavailable to it)
REQUIRED GATES     the Level B/C/D suite for this slice, by name
DO NOT TOUCH       AGENTS.md, Project.md; frozen files; out-of-scope areas
STOP CONDITION     implement and verify only this; no commit or push; leave everything in the
                   working tree; return the structured report below
```

Acceptance criteria and pinned invariants are carried **verbatim**; surrounding narrative is not.

Codex returns exactly this, with no tool-call narration: **1** files changed · **2** implementation
result · **3** verification clusters with PASS/FAIL · **4** mutations, each with invariant, intended
assertion, assertion that actually fired, and restore hash · **5** frozen-file and authority
integrity by supplied SHA-256 · **6** every path it created or modified, including temporary files
(Claude verifies repository state through Git) · **7** unresolved findings or decisions · **8**
elapsed time and approximate usage.

### Prompt economy

Claude has already read the authority files and reconciled scope. The prompt carries the
conclusions, so Codex does not repeat that work:

- Do not instruct Codex to read `AGENTS.md`, `Project.md`, `architecture/`, or unrelated
  directories when the applicable rules are already stated in the prompt.
- State the relevant invariants inline. Omit invariants the change cannot touch.
- Name the files in scope. Codex may open additional files only when an import or call path
  directly requires it.
- Require the structured report above and nothing more — no restatement of the frozen plan, no
  tool-call narration.

Scope discipline, hard stops, and the clean-tree requirement are unchanged. A shorter prompt
must never mean a vaguer one.

### Verification split

**Codex runs every deterministic gate**, using these proven direct-`node` invocations. Never `npm`
or `npx` — the PowerShell execution policy blocks their shims.

```
node node_modules/typescript/bin/tsc --noEmit
node node_modules/next/dist/bin/next lint
node node_modules/next/dist/bin/next build
node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/<name>.ts
```

`--conditions=react-server` is required or the verifiers fail on the `server-only` import. Codex
must never install anything, add or change a dependency, or work around the sandbox; when a command
cannot start it says so plainly and stops.

Verifier menu, **each as applicable** — M6A, M6B, M6C, M6D, the Developer boundary verifier, the
Admin invariant verifier, the recovery verifier, C1, C4, C4.2, C5. A menu, not a mandatory sequence.
Claude names the required suite in the contract from the checkpoint's actual risk and scope, and
that selection must fully cover the candidate change.

**Git stays Claude's.** Codex's sandbox runs as a different Windows principal, so Git refuses the
repository as dubiously owned. Codex therefore cannot verify working-tree cleanliness, untracked
files, diff scope, or frozen-file integrity against Git objects — Claude owns all of it. **Never add
a `safe.directory` exception or otherwise weaken Git's ownership protection to work around this.**
Where Codex needs a self-check, Claude supplies expected SHA-256 hashes in the contract and Codex
verifies them with `fs` and `crypto`.

**Never report a Codex gate as passed when Codex could not execute it.** A gate Codex did not run
is not evidence of anything. Widening Codex capability requires a fresh probe, recorded here in the
same change.

### Verification ladder

Targeted implementation checks → affected verifier/checkpoint → required risk-based adversarial
proof → restored candidate → one final complete gate. Run the smallest check capable of catching
what the current step could plausibly break.

**Codex runs A, B, C and D.** Claude runs only a required gate Codex could not execute — that gate
alone, never the suite again.

- **A — during implementation.** One targeted verifier script as a fast failure signal.
- **B — stable candidate.** Once the diff stops changing, run only the verifiers whose assertions
  the diff can actually reach, plus `tsc`. Illustrative, not a matrix: shape-pinned or M6C surface
  → M6C · Developer authorization or invisibility → Developer boundary verifier · Admin account
  invariants → Admin invariant verifier · recovery or authentication → recovery verifier plus the
  relevant auth checkpoint · UI-only → `tsc` and `lint` · security-sensitive query projection →
  the relevant verifier plus source review. When two checks are plausible, run the broader one.
- **C — adversarial.** Risk-based mutation proof (below), against the candidate tree.
- **D — final gate.** After the candidate and verifier tree are stable and every temporary
  perturbation is restored, run the complete required suite **once**, including `lint` and `build`.

Do not run the full suite before Level C; Level D re-covers it. A second Level D run is required
only when something changes afterwards: executable production code, acceptance-relevant verifier
logic, security configuration, shared build or runtime configuration, or an artifact whose project
rules explicitly invalidate the prior gate. Documentation-only changes do not re-trigger it.

**Frozen files keep a stricter cadence.** For any slice touching a byte-frozen or shape-pinned file,
run the directly relevant checkpoint **immediately after that slice**, before downstream UI or
verifier work continues. Shape-pinned assertions fail one at a time and mask each other, so
deferring converts one correction round into several.

### Adversarial verification — risk-based

Mutation proof — *prove the assertion bites* — is **required** when any of these holds: a new
security-critical assertion was added and no existing behavioural failure demonstrates it can fail ·
the assertion could pass because of fixture shape, ordering, masking, or an over-broad predicate ·
the verifier is itself part of the security boundary being changed · that verifier has previously
shown a false-positive or masking risk.

**Not** required when an existing behavioural test already fails for the prohibited condition and
passes for the correct one · the assertion duplicates an invariant already independently proven ·
the change is not security-critical · or the mutation would only prove a framework, type, or lint
rule enforced elsewhere.

One representative mutation per security invariant, not one per assertion. **Never reduce the set of
invariants covered in order to reduce execution count.**

- **A mutation must not alter any construct an earlier assertion counts or shape-matches**, or it
  trips that assertion first and the intended one is never reached. If masking surfaces anyway, add
  only the minimum extra mutation isolating the masked assertion.
- **Capture full stderr on the first execution.** Record for every mutation: the invariant tested ·
  the intended assertion message · the message that **actually** fired · the restore hash result.
  **If the wrong assertion fires the mutation is not proof** — isolate and rerun it.
- **One verifier per mutation** unless two prove genuinely distinct guarantees, such as a textual
  pin and a behavioural outcome.
- **Restore only from a byte-verified backup and confirm the restored tree by hash.** Never use
  `git checkout --` to undo a perturbation. Claude confirms restoration independently through Git
  during postflight.

## Review contract

Claude's review is **repository integrity plus adjudication**, not a second code review. Never rely
on Codex's summary for these; check them independently, every time:

- `git status` — unexpected or untracked files.
- `git diff --stat` against the recorded baseline — nothing outside the frozen scope.
- Frozen-file integrity by hash against the baseline commit.
- **Scan coverage must equal the candidate tree.** Any repository-wide credential, security, or
  compliance scan used for sign-off must cover tracked modifications, new tracked files, **and new
  untracked in-scope files**. Plain `git grep` and `git diff` see only tracked content: use
  `git grep --untracked`, or scan the new paths explicitly. Never describe a scan as
  repository-wide when the tool examined only tracked files — evidence must state what was actually
  examined.
- `AGENTS.md` and `Project.md` untouched (check both `Project.md` and `PROJECT.md`; same file on Windows).
- No invented requirements, fields, rules, or styling; nothing beyond plan scope.
- Every acceptance criterion accounted for by evidence — Codex's, and the reviewer's where one was required.
- **Delegation identity** — read the actual session rollout, do not assume the flags took effect:
  `ls -t ~/.codex/sessions/*/*/*/rollout-*.jsonl | head -1`, confirm it is the delegation just run
  (`"originator":"codex_exec"`, correct `cwd`), then extract `"model"` and `"reasoning_effort"`.
  Report both, and whether they matched **gpt-5.6-sol / high**.

**Claude does not routinely deep-read the diff.** When a slice requires a fresh Codex Reviewer, that
reviewer performs the code review; Claude repeating it is the duplicated reasoning v2 exists to
remove. Claude deep-reads code only when the reviewer raises a finding · implementer and reviewer
evidence conflict · a new security or authority decision is required · or a publication rule demands
Claude inspection. On a low-risk slice with no reviewer, Claude reads the diff hunks of
security-critical files and of any modified verifier — a weakened existing assertion is invisible to
mutation proof.

### Independent review

No automatic reviewer. For an ordinary low or medium-risk slice, Codex implementation plus its
deterministic verification is sufficient; Claude reviews the evidence summary and does not redo it.

A **fresh read-only Codex Reviewer is required** when the slice touches authentication or
authorization · Developer isolation · credential or secret handling · audit confidentiality or
visibility · privacy or sensitive-data handling · RLS or security policy · migrations, schema, or
security configuration · destructive or live-database work · a frozen security boundary · or when
implementation evidence contains an unresolved contradiction. It is also mandatory at a publication
boundary.

Because Codex cannot run Git, **Claude generates and supplies the bounded diff or patch.** The
reviewer receives only the frozen contract · that diff · relevant authority pointers · the
verification summary · expected frozen-file hashes where relevant. Never unrelated repository
context.

The reviewer independently reviews security-critical production hunks and verifier changes against
the contract and authority, and **reports findings only**. It does not reimplement and does not
rerun the deterministic suite; one focused verifier rerun is allowed solely to resolve a specific
finding. Independent review is reasoning review, never deterministic-suite duplication.

### Running verification

**If Codex executed a required gate successfully, Claude does not rerun it merely for independent
confirmation.** If Codex could not execute one required gate, Claude runs that gate alone — never
the suite again.

Re-run a gate Codex reported only when Codex was interrupted, timed out, or failed · its evidence is
missing, partial, or unattributable to this run · or its report conflicts with the diff or with
reviewer findings. State which reason applied; when none does, say the evidence was accepted.

Sign-off requires valid, current evidence for every required gate. When a correction invalidates
something a passing gate covered, rerun only the invalidated gate.

### Reporting

For passing checks report `check → PASS` (or exit status) and nothing more. Reserve full output for
failures, discrepancies, deviations from the frozen plan, and material findings.

Between slices, report a delta only — never restate the frozen plan or its architecture:

```
Slice X — PASS / FAIL
Changed:         <files or boundary>
Targeted check:  <result>
Finding:         <only if relevant>
Next:            <next slice>
```

Expand for security findings, failed gates, architecture conflicts, scope changes, and decisions
needing the user. Give the full checkpoint summary once, at completion.
