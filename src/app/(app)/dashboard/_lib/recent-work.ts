import "server-only";
import { SYSTEM_CONSTANTS } from "@/lib/constants";
import { listRecentSessionsAction } from "@/features/server-boundary/server-actions";

/**
 * Minimal dashboard projection of a recent session.
 *
 * Deliberately narrow, and narrower than what now arrives. The underlying transport
 * used to be the full aggregate — `reports[]` with raw `results`, `signatories` and
 * `completedSnapshot` — and this projection existed to keep that off the dashboard.
 * Since SHADCN-07C2 the list transport is itself a summary DTO that cannot express
 * any of them and never fetches them, so this is no longer the only thing standing
 * between the dashboard and a report body. It stays because the two narrowings answer
 * different questions: the DTO decides what a list row may carry, and this decides
 * what a tile needs to say what to work on next.
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

/**
 * Re-exported from the one declaration in `SYSTEM_CONSTANTS.RETENTION`, so the dashboard, its
 * row marker and the History chip cannot drift apart. The name stays here because this is where
 * the dashboard reads it from.
 */
export const EXPIRING_SOON_DAYS = SYSTEM_CONSTANTS.RETENTION.EXPIRING_SOON_DAYS;

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
