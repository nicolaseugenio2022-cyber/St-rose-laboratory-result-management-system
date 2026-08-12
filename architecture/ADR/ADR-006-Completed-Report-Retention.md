# ADR-006: Completed Report Retention, Replacement, and Snapshot Authority

## Status

Accepted

## Context

Completed laboratory reports are clinical records rendered exclusively from a frozen completion snapshot. The approved retention policy also permits an authorized user to replace a completed report within 30 days. These appear to conflict: replacement implies change, while the snapshot is immutable by construction. The conflict is resolved by distinguishing *when* composition happens from *what* rendering consumes.

## Decision

**Retention.** Completed reports are retained for 30 days from the original completion: `expires_at = original completed_at + 30 days`.

**The retention anchor is immutable.** Replacement never restarts or extends the retention window. A replacement may record `last_replaced_at` and `updated_at` for audit purposes; those timestamps never affect `completed_at` or `expires_at`.

**Snapshot authority is absolute at render time.** Preview, Print, and PDF consume only the currently persisted frozen snapshot. Render-time clinical recomputation from current definitions remains forbidden without exception.

**Replacement is re-completion, never mutation.** Within the retention window:

1. An eligible completed session is reopened in the existing Workspace under an explicit Replacement Mode, retaining the original completed-record identity and retention anchor.
2. Edits occur through the existing domain encoding workflow. No second report editor exists.
3. Re-completion revalidates through the existing validation and completion pipeline.
4. A completely new completion snapshot is composed at re-completion time.
5. The new snapshot atomically replaces the persisted completed record.
6. Preview, Print, and PDF thereafter consume only the newly frozen snapshot.

A frozen snapshot object is never mutated, patched, or bypassed. It is replaced wholesale by a newly composed frozen snapshot, or not at all.

**Atomicity.** Replacement is transactional at the database level. Sequential client-side writes do not satisfy this requirement. Replacement of the session record, reports, results, signatories, and completed snapshot either succeeds completely or leaves the existing completed record entirely unchanged. The transactional boundary is a server-side database function invoked exclusively from the application server boundary after session and role authorization. It is never reachable from the browser.

**No version history.** Single-record replacement semantics. Prior snapshots are not retained.

**Immutability after expiry.** Once `expires_at < NOW()`, a completed report cannot be reopened, edited, or replaced under any circumstances.

**Visibility.** `Admin` and `User` may retrieve all completed reports system-wide within the retention policy. No per-encoder ownership model is introduced. `Developer` does not receive routine Completed History access; its role is technical monitoring, not clinical record access.

## Consequences

- The Report Engine is unaffected. Composition continues to occur at completion time, and rendering continues to consume a frozen snapshot. No second composition path is introduced and the Phase C freeze is preserved.
- Replacement cannot extend retention, so a report cannot be kept editable indefinitely through repeated replacement.
- Atomicity requires a server-side transactional boundary; the client cannot provide it.
- Prior report content is unrecoverable after replacement, which is the accepted cost of single-record semantics.
- Persistence failures must surface as errors and must never present an empty or stale history.

## Related

`SECURITY_MODEL.md` §6.2, §6.3;
`Project.md` §Completed Snapshot Authority, Milestone 4 Report Engine Architecture Freeze;
`DATABASE_DESIGN.md` §4.4.1;
`ADR-005`.
