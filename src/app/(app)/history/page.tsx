import React from "react";
import { SessionHistoryView } from "@/features/history/components/SessionHistoryView";
import { listRecentSessionsAction } from "@/features/server-boundary/server-actions";
import type { SessionHistoryEntryTransport } from "@/features/server-boundary/server-actions";

export const runtime = "nodejs";

export default async function HistoryPage() {
  // First page fetched during server render so rows arrive with the HTML instead of after
  // hydrate + a server-action round trip. On failure the view falls back to its own client
  // fetch and error handling - the page never gains a new error surface.
  let initialEntries: SessionHistoryEntryTransport[] | undefined;
  try {
    initialEntries = await listRecentSessionsAction({ limit: 50 });
  } catch {
    initialEntries = undefined;
  }

  return <SessionHistoryView initialEntries={initialEntries} />;
}
