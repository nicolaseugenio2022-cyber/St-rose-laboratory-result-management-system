import React from "react";
import { SessionHistoryView } from "./_components/SessionHistoryView";
import { listRecentSessionsAction } from "@/features/server-boundary/server-actions";
import type { SessionHistoryEntryTransport } from "@/features/server-boundary/server-actions";
import { describeErrorShape } from "@/lib/safe-error";

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

  return <SessionHistoryView initialEntries={initialEntries} />;
}
