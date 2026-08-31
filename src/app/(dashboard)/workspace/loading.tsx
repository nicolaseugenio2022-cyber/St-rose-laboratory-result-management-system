import React from "react";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Placeholder for the Workspace while its route segment loads.
 *
 * It renders inside WorkspaceShell, which already draws the real navigation rail, so it must
 * not draw a rail of its own. What it mirrors is the Workspace's own frame - the 56px command
 * bar, then the 280px catalog beside the encoding pane's sticky strip and worksheet - at the
 * same paddings and cap, so nothing jumps when the real surface arrives. Decorative
 * throughout: aria-busy on the region conveys the state once.
 */
export default function WorkspaceLoading() {
  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-brand-canvas" aria-busy="true">
      <span className="sr-only">Loading workspace</span>
      <Skeleton className="h-14 w-full shrink-0 rounded-none" />
      <div className="mx-auto flex min-h-0 w-full max-w-[1680px] flex-1 gap-3 p-3 sm:px-4 sm:py-3 xl:px-6">
        <Skeleton className="hidden h-full w-[280px] shrink-0 lg:block" />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
          <Skeleton className="h-12 w-full shrink-0" />
          <Skeleton className="min-h-0 w-full flex-1" />
        </div>
      </div>
    </div>
  );
}
