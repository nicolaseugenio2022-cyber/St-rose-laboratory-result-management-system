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

- **Claude** — planner, orchestrator, independent reviewer. Never the implementer.
- **Codex CLI** (`codex exec`) — the only agent that writes application code.
- **User** — approves plans and any material change to an approved plan.

The split exists to eliminate duplicated reasoning, duplicated repository reading, and
duplicated verification — not to hit a token quota. Review rigour is unchanged.

**Claude owns:** architecture and scope reconciliation · authority-file interpretation ·
freezing the plan · producing a compact delegation prompt · reviewing the complete diff ·
running the full verification suite · committing once every required gate passes.

**Codex owns:** reading only the frozen scope files and the dependencies those files directly
require · implementing the approved change · source-level inspection that needs no unavailable
runtime tooling · returning a concise delta report. Codex does not rediscover architecture Claude
has already supplied, does not restate project context, and does not run the historical regression
suite.

Codex currently owns **no** verification execution. See Verification split.

## Version control

Neither Claude nor Codex may commit or push unless the user explicitly requests it.
All work stays in the working tree for review.

## Workflow

1. **Inspect** — read the relevant source and authority files before planning.
2. **Plan** — produce a concrete plan: scope, explicit out-of-scope, affected files/areas, acceptance criteria, verification steps.
3. **Stop** — present the plan and wait. Before explicit approval: do not invoke Codex, do not write application code.
4. **Freeze** — on approval the plan is frozen. Then run `git status` and require a clean working tree:
   - Clean — record the current `HEAD` SHA as the review baseline and proceed.
   - Not clean — **stop** and report the existing changes to the user.
   - Never stash, discard, commit, revert, or absorb pre-existing changes automatically.
   - Proceed with a dirty tree only when the user explicitly authorizes it and states how those changes are to be treated.
5. **Delegate** — hand the frozen plan to `codex exec` (see Delegation contract).
6. **Review** — independently inspect the repository (see Review contract). Codex's summary is evidence, never proof.
7. **Correct** — a mistake lying entirely inside the frozen plan may be sent back to Codex without asking. Maximum **2** automatic correction rounds; review again after each. Once exhausted, stop and report.
8. **Declare** — report completion only after independently verifying every acceptance criterion.

## Hard stops — ask the user

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
A wrapper timeout does not necessarily kill the Codex process: it can survive, hold the
thread-store writer lock, and make `resume` fail with `already has an active writer`. `resume` also
rejects `--sandbox`. A fresh `codex exec` scoped to only the remaining work avoids both problems —
it must restate the constraints, since a new session inherits no context. Check for a stranded
process before relaunching.

Every `codex exec` prompt must carry:

- The frozen plan verbatim, including its acceptance criteria.
- The specific invariants that apply, extracted by Claude — not a pointer to go read them.
- "Do not modify `AGENTS.md` or `Project.md`."
- "Implement only this plan. No future-milestone work, no refactors, no unrelated improvements."
- "Do not commit or push. Leave all changes in the working tree."
- The targeted verification to run, and nothing beyond it.

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
- **Claude runs everything**: targeted verifier execution, `tsc`, `lint`, `build`, and the full
  regression suite — M6A, M6B, M6C, the Developer boundary verifier, the Admin invariant verifier,
  the recovery verifier, and C1, C4, C4.2, C5, as applicable to the change.

This is an environment constraint, not a reduction in verification rigour. Every gate still runs;
only the executor changed.

**Never report a Codex gate as passed when Codex could not execute it.** A gate Codex did not run
is not evidence of anything.

When the sandbox is fixed, targeted `tsc`/`lint`/one-verifier may return to Codex as a fast failure
signal, and this section must be updated in the same commit that re-verifies the capability.

### Checkpoint cadence for frozen files

For any slice touching a byte-frozen or shape-pinned file, Claude runs the directly relevant
checkpoint **immediately after that slice**, before downstream UI or verifier work continues.
Shape-pinned assertions fail one at a time and mask each other, so deferring the checkpoint to the
end converts one correction round into several.

## Review contract

Never rely on Codex's summary. Independently check, every time:

- `git status` — unexpected or untracked files.
- `git diff` against the recorded baseline — every hunk.
- Each changed file read in its surrounding context.
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

### Reporting

For passing checks report `check → PASS` (or exit status) and nothing more. Reserve full output for
failures, discrepancies, deviations from the frozen plan, and material findings.
