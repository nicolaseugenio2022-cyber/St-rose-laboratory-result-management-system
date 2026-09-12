import React from "react";
import { SessionHistoryView } from "./_components/SessionHistoryView";
import { listRecentSessionsAction } from "@/features/server-boundary/server-actions";
import type { SessionHistoryEntryTransport } from "@/features/server-boundary/server-actions";
import { describeErrorShape } from "@/lib/safe-error";
import { getCurrentUserProfile } from "@/lib/auth-guards";

export const runtime = "nodejs";

export default async function HistoryPage() {
  // First page fetched during server render so rows arrive with the HTML instead of after
  // hydrate + a server-action round trip. On failure the view falls back to its own client
  // fetch and error handling - the page never gains a new error surface.
  let initialEntries: SessionHistoryEntryTransport[] | undefined;
  try {
    initialEntries = await listRecentSessionsAction({ limit: 50 });
  } catch (error: unknown) {
    // The fallback is unchanged - the view still fetches for itself and the operator sees no new
    // surface. What changes is that the failure is no longer invisible: a bare `catch {}` left no
    // server-side trace at all, so a persistent backend fault here looked identical to a healthy
    // render that simply deferred to the client. Shape only; never the message, payload or rows.
    console.error("History initial session load failed.", {
      route: "/history",
      stage: "listRecentSessionsAction",
      ...describeErrorShape(error),
    });
    initialEntries = undefined;
  }

  // The viewer's capability is resolved HERE, on the server, from the authenticated account -
  // the same way Personnel decides whether to offer its management controls. It reaches the view
  // as a boolean and nothing more: no profile, no role string, no account identity. It decides
  // what is shown; `deleteCompletedSessionAction` decides what is allowed.
  const viewer = await getCurrentUserProfile();
  const canDeleteCompleted = viewer?.role === "Admin";

  return (
    <SessionHistoryView
      initialEntries={initialEntries}
      canDeleteCompleted={canDeleteCompleted}
    />
  );
}
