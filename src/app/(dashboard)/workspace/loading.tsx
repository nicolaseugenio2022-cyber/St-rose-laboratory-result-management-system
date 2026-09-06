import React from "react";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Placeholder for the Workspace while its route segment loads.
 *
 * It renders inside WorkspaceShell, which already draws the real navigation rail, so it must
 * not draw a rail of its own. What it mirrors is the Focused Clinical Desk frame - the 56px
 * command bar, the one-row clinical ribbon beneath it, then the 240px work queue beside the
 * active report - at the same paddings and cap, so nothing jumps when the real surface arrives.
 *
 * The queue placeholder is hidden below 1152px for the same reason the queue itself is: below
 * that width it is a drawer, and drawing a column here would promise a layout the Workspace is
 * not about to render. Decorative throughout: aria-busy on the region conveys the state once.
 */
export default function WorkspaceLoading() {
  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-brand-canvas" aria-busy="true">
      <span className="sr-only">Loading workspace</span>
      {/* Command bar */}
      <Skeleton className="h-14 w-full shrink-0 rounded-none" />
      {/* Clinical ribbon - one row, always */}
      <Skeleton className="h-9 w-full shrink-0 rounded-none" />
      <div className="mx-auto flex min-h-0 w-full max-w-[1680px] flex-1 gap-3 p-3 sm:px-4 sm:py-3 xl:px-6">
        <Skeleton className="hidden h-full w-60 shrink-0 min-[1152px]:block" />
        <Skeleton className="min-h-0 w-full min-w-0 flex-1" />
      </div>
    </div>
  );
}
