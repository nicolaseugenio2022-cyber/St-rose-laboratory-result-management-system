import "server-only";
import { listRecentSessionsAction } from "@/features/server-boundary/server-actions";

/**
 * Minimal dashboard projection of a recent session.
 *
 * Deliberately narrow. The underlying transport carries the full aggregate —
 * `reports[]` with raw `results`, `signatories` and `completedSnapshot`. None of
 * that is needed to decide what to work on next, so none of it is carried here.
 */
export interface RecentWorkItem {
  id: string;
  patientName: string;
  status: "Draft" | "Completed";
  accessionNumber: string | null;
  /** Completion time for completed work, creation time for drafts. */
  activityAt: string;
  expiresAt: string | null;
  reportCount: number;
  /** Server-derived ownership. Never recomputed on the client. */
  canReopen: boolean;
}

export interface RecentWork {
  /** The caller's own unfinished sessions. Owner-scoped by the repository query. */
  myDrafts: RecentWorkItem[];
  /** Recently completed sessions visible to the caller. */
  recentCompleted: RecentWorkItem[];
  /** Completed work nearing the end of its retention window. */
  expiringSoon: RecentWorkItem[];
}

export const EXPIRING_SOON_DAYS = 7;

export function daysUntilExpiry(expiresAt: string | null, now = Date.now()): number | null {
  if (!expiresAt) return null;
  return Math.ceil((new Date(expiresAt).getTime() - now) / 86_400_000);
}

/**
 * Reads recent work through the existing authorized operational action.
 *
 * Authorization is entirely the server's: `listRecentSessionsAction` calls
 * `requireOperationalCaller`, which admits only `Admin` and `User` and emits a
 * `SecurityDenial` audit for anyone else. Draft visibility is enforced in the
 * repository query itself — `status.eq.Completed OR (status.eq.Draft AND
 * created_by_user_id = caller)` — so a caller never sees another user's drafts,
 * and there is no Admin override. `canReopen` arrives already derived from
 * `created_by_user_id === caller.userId`.
 *
 * **Never call this for a Developer.** The role gate belongs at the composition
 * boundary so the operational read is never invoked, rather than invoked and
 * rejected.
 */
export async function getRecentWork(limit = 20): Promise<RecentWork> {
  const entries = await listRecentSessionsAction({ limit });

  const items: RecentWorkItem[] = entries.map(({ session, canReopen }) => ({
    id: session.id,
    patientName: session.demographics.fullName || "Unnamed Patient",
    status: session.status,
    accessionNumber: session.accessionNumber,
    activityAt: session.completedAt ?? session.createdAt,
    expiresAt: session.expiresAt ?? null,
    reportCount: session.reports.length,
    canReopen,
  }));

  const byRecency = (a: RecentWorkItem, b: RecentWorkItem) =>
    new Date(b.activityAt).getTime() - new Date(a.activityAt).getTime();

  const completed = items.filter((i) => i.status === "Completed").sort(byRecency);

  return {
    myDrafts: items.filter((i) => i.status === "Draft").sort(byRecency),
    recentCompleted: completed,
    expiringSoon: completed.filter((i) => {
      const d = daysUntilExpiry(i.expiresAt);
      return d !== null && d >= 0 && d <= EXPIRING_SOON_DAYS;
    }),
  };
}
