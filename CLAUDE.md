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

- **Claude** — planner, orchestrator, independent reviewer, and sole executor of verification.
  Not the implementer, save for the surgical exception below.
- **Codex CLI** (`codex exec`) — the primary implementer; writes essentially all application code.
- **User** — approves plans and any material change to an approved plan.

Operating principle: **think deeply once → implement narrowly → verify intelligently → full-check once.**

The split exists to eliminate duplicated reasoning, duplicated repository reading, and
duplicated verification — not to hit a token quota. Review rigour is unchanged. Some checkpoints
consume more Claude tokens, others more Codex tokens. That is expected and is never a target.

**Claude owns:** architecture and scope reconciliation · authority-file interpretation ·
security and authorization reasoning · freezing the plan and its slices · producing a compact
delegation prompt · reviewing the complete diff · running all verification · judging whether the
acceptance criteria actually passed · naming residual risks · committing only after every required
gate passes **and** the user has authorized that commit.

**Codex owns:** reading only the frozen scope files and the dependencies those files directly
require · implementing the approved change · source-level inspection that needs no unavailable
runtime tooling · returning a concise delta report. Codex does not rediscover architecture Claude
has already supplied, does not restate project context, and does not run the historical regression
suite.

Codex currently owns **no** verification execution. See Verification split.

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

**Slice at artifact boundaries, from the start.** Prefer several small delegations over one large
one that risks the ten-minute foreground wall. A common shape is repository/service/domain, then
page/UI, then integration/verifier/wiring — a guideline, not a required three. Use one slice when
the change is small; never split a cohesive change just to produce slices. Each slice must have a
single unambiguous completion boundary. The two-round automatic correction limit applies **per
slice**; re-slicing work to obtain a fresh correction budget is a hard stop.

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
DO NOT TOUCH       AGENTS.md, Project.md; frozen files; out-of-scope areas
STOP CONDITION     implement only this; no verification commands; no commit or push;
                   leave everything in the working tree; return a delta-only report
```

Acceptance criteria and pinned invariants are carried **verbatim**; surrounding narrative is not.
Codex runs no verification, so a prompt never names a command for Codex to execute — if a gate
matters as context, say Claude will run it.

### Prompt economy

Claude has already read the authority files and reconciled scope. The prompt carries the
conclusions, so Codex does not repeat that work:

- Do not instruct Codex to read `AGENTS.md`, `Project.md`, `architecture/`, or unrelated
  directories when the applicable rules are already stated in the prompt.
- State the relevant invariants inline. Omit invariants the change cannot touch.
- Name the files in scope. Codex may open additional files only when an import or call path
  directly requires it.
- Require a delta-only report: changed files, results, deviations. Not a restatement of the
  frozen plan.

Scope discipline, hard stops, and the clean-tree requirement are unchanged. A shorter prompt
must never mean a vaguer one.

### Verification split

**Environment constraint — current.** Codex cannot execute `tsx` or `npm` inside its sandbox here.
Two independent blockers have been observed: `npx tsx` attempts a registry fetch and fails
(`tsx` is not in `node_modules`), and PowerShell's execution policy blocks `npx.ps1` / `npm.ps1`.

Until that capability is explicitly re-verified:

- **Codex runs no verification.** Do not ask Codex to run `npm` or `tsx`. If a prompt names a gate
  for context, instruct Codex to report plainly that it could not start it — never to install
  anything, add a dependency, or work around the sandbox.
- **Claude runs everything**: targeted verifier execution, `tsc`, `lint`, `build`, and the
  regression gates the change actually puts at risk. Candidates, **each as applicable** — M6A, M6B,
  M6C, M6D, the Developer boundary verifier, the Admin invariant verifier, the recovery verifier,
  C1, C4, C4.2, C5. This is a menu, not a mandatory sequence: no checkpoint is obliged to rerun
  every historical verifier. Claude selects the required suite from the checkpoint's actual risk and
  scope, and that selection must fully cover the candidate change.

This is an environment constraint, not a reduction in verification rigour. Every gate the change
requires still runs; only the executor changed.

**Never report a Codex gate as passed when Codex could not execute it.** A gate Codex did not run
is not evidence of anything.

When the sandbox is fixed, targeted `tsc`/`lint`/one-verifier may return to Codex as a fast failure
signal, and this section must be updated in the same commit that re-verifies the capability.

### Intermediate verification — risk-based

Do not run the regression suite after every slice. After a slice Claude runs the **smallest check
capable of catching the regression that slice could plausibly cause**. Illustrative, not a matrix:
shape-pinned or M6C surface → M6C · Developer authorization or invisibility → Developer boundary
verifier · Admin account invariants → Admin invariant verifier · recovery or authentication →
recovery verifier plus the relevant auth checkpoint · UI-only → `tsc` and `lint` · security-sensitive
query projection → the relevant verifier plus source review. When two checks are plausible, run the
broader one.

**Frozen files keep a stricter cadence.** For any slice touching a byte-frozen or shape-pinned file,
run the directly relevant checkpoint **immediately after that slice**, before downstream UI or
verifier work continues. Shape-pinned assertions fail one at a time and mask each other, so
deferring converts one correction round into several.

## Review contract

Never rely on Codex's summary. Independently check, every time:

- `git status` — unexpected or untracked files.
- `git diff` against the recorded baseline — every hunk.
- Every hunk read, in surrounding context, at a depth set by the file's **role, not its size**.
  **Deep** — authentication · authorization · session and token handling · password and recovery
  logic · repositories and query filters · mutation services · server actions · persistence
  boundaries · migrations · verifier assertions · anything touching a frozen invariant. A two-line
  change in these is still deep.
  **Lighter structural** — loading states, wrappers, static labels, uncomplicated presentational
  components, unless a defect or security boundary points there. No untracked new file is
  classified without first being opened.
- **Scan coverage must equal the candidate tree.** Any repository-wide credential, security, or
  compliance scan used for sign-off must cover tracked modifications, new tracked files, **and new
  untracked in-scope files**. Plain `git grep` and `git diff` see only tracked content: use
  `git grep --untracked`, or scan the new paths explicitly. Never describe a scan as
  repository-wide when the tool examined only tracked files — evidence must state what was actually
  examined.
- `AGENTS.md` and `Project.md` untouched (check both `Project.md` and `PROJECT.md`; same file on Windows).
- No invented requirements, fields, rules, or styling; nothing beyond plan scope.
- Each acceptance criterion, individually, against the implementation itself — not against Codex's claim about it.
- Any modified `scripts/verify-checkpoint-*.ts` read in full. A passing test Codex edited proves nothing until its assertions are read.
- **Delegation identity** — read the actual session rollout, do not assume the flags took effect:
  `ls -t ~/.codex/sessions/*/*/*/rollout-*.jsonl | head -1`, confirm it is the delegation just run
  (`"originator":"codex_exec"`, correct `cwd`), then extract `"model"` and `"reasoning_effort"`.
  Report both in the review, and whether they matched **gpt-5.6-sol / high**.

The checks above are the review and are never skipped. They are reading, not execution.

### Running verification

The full suite is Claude's responsibility, run once, after the diff review. Codex's targeted
`tsc`/`lint`/verifier results are a fast failure signal, not a substitute — do not re-run them
merely to duplicate evidence, and do not treat their absence as a pass.

Accept Codex's targeted results at face value only for the gates it actually ran and reported.
Re-run one of those gates when:

- Codex was interrupted, timed out, or failed.
- Its evidence is missing, partial, or unattributable to this run.
- Its report conflicts with the actual diff.
- A verification script itself changed — validate it by running it.
- Something in the implementation looks suspicious and running is the cheapest way to settle it.

State which reason applied. When none does, say the targeted evidence was accepted and why that
was sound.

A gate that Codex never ran is not evidence of anything. Claude runs it.

After the last slice and the diff review, run the required suite **once**. Do not repeat an
expensive gate without a concrete reason. When a correction invalidates something a passing gate
covered, rerun only the invalidated gate plus whatever final confidence check the change warrants.
Sign-off still requires valid, current evidence for every required gate.

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
