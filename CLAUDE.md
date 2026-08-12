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

Every `codex exec` prompt must carry:

- The frozen plan verbatim, including its acceptance criteria.
- "Obey AGENTS.md, Project.md, the report specifications, and existing repository authority."
- "Do not modify `AGENTS.md` or `Project.md`."
- "Implement only this plan. No future-milestone work, no refactors, no unrelated improvements."
- "Do not commit or push. Leave all changes in the working tree."
- The verification to run.

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

### Rerunning verification

When Codex completed normally and supplied verification evidence, do not mechanically rerun the
whole suite — the bar in `Project.md` (Milestone Completion Rules) and
`architecture/IMPLEMENTATION_GUIDELINES.md` is already evidenced. Rerun what a specific reason
demands:

- Codex was interrupted, timed out, or failed — then run the full required verification (as in C5.1).
- Verification evidence is missing, partial, or unattributable to this run.
- Codex's report conflicts with the actual diff.
- A verification script itself changed — validate it by running it.
- An acceptance criterion is not adequately supported by the diff plus the evidence.
- Anything in the implementation looks suspicious, and running is the cheapest way to settle it.

State which reason applied. When none does, say the evidence was accepted and why that was sound.

### Reporting

For passing checks report `check → PASS` (or exit status) and nothing more. Reserve full output for
failures, discrepancies, deviations from the frozen plan, and material findings.
