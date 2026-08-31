import React from "react";
import { Skeleton, SkeletonRegion } from "@/components/ui/Skeleton";

/** The panel shell every dashboard region uses: a structural header band above the body. */
function PanelSkeleton({ rows }: { rows: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-brand-border bg-brand-card shadow-low">
      <div className="space-y-1.5 border-b border-brand-border bg-brand-structural px-4 py-2.5">
        <Skeleton className="h-3.5 w-36" />
        <Skeleton className="h-3 w-48 max-w-full" />
      </div>
      <div className="divide-y divide-brand-border-subtle">
        {Array.from({ length: rows }).map((_, row) => (
          <div key={row} className="flex items-center justify-between gap-3 px-3.5 py-2">
            <div className="min-w-0 space-y-1">
              <Skeleton className="h-3.5 w-44 max-w-full" />
              <Skeleton className="h-3 w-28" />
            </div>
            <Skeleton className="h-8 w-16 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Route-level dashboard placeholder.
 *
 * Shaped like the finished composition - one titled start action, then two panel
 * regions - so the page does not reflow when the real dashboard resolves. It stands
 * in for whichever role composition renders, so it stays deliberately generic rather
 * than mirroring any one of them.
 */
export default function DashboardLoading() {
  return (
    // SkeletonRegion keeps the live region on the announcement alone, so the arriving
    // dashboard is not read aloud as a live-region mutation.
    <SkeletonRegion isLoading label="Loading dashboard" className="space-y-4">
      <div className="space-y-2">
        <div className="border-b border-brand-border-strong pb-1.5">
          <Skeleton className="h-3.5 w-40" />
        </div>
        <Skeleton className="h-14 w-full rounded-lg" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[3fr_2fr]">
        <PanelSkeleton rows={4} />
        <PanelSkeleton rows={4} />
      </div>
    </SkeletonRegion>
  );
}
