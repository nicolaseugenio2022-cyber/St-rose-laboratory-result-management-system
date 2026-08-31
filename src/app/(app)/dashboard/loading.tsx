import React from "react";
import { Skeleton, SkeletonRegion } from "@/components/ui/Skeleton";

/**
 * Route-level dashboard placeholder.
 *
 * Shaped like the finished composition - a compact orientation line, a primary
 * action pair, then two list regions - so the page does not reflow when the
 * real dashboard resolves. It stands in for whichever role composition renders,
 * so it stays deliberately generic rather than mirroring any one of them.
 */
export default function DashboardLoading() {
  return (
    // SkeletonRegion keeps the live region on the announcement alone. The hand-rolled
    // wrapper had aria-live on the element that contains the placeholders, which makes
    // the whole arriving dashboard a live-region mutation to be read aloud.
    <SkeletonRegion isLoading label="Loading dashboard" className="space-y-5">

      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 border-b border-brand-border-subtle pb-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-3.5 w-72 max-w-full" />
      </div>

      <div className="space-y-2.5">
        <div className="border-b border-brand-border-subtle pb-1.5">
          <Skeleton className="h-3.5 w-40" />
        </div>
        <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-[2fr_1fr]">
          <Skeleton className="h-16 w-full rounded-md" />
          <Skeleton className="h-16 w-full rounded-md" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[3fr_2fr]">
        {[0, 1].map((panel) => (
          <div key={panel} className="space-y-2.5">
            <div className="border-b border-brand-border-subtle pb-1.5">
              <Skeleton className="h-3.5 w-36" />
            </div>
            <div className="divide-y divide-brand-border-subtle overflow-hidden rounded-lg border border-brand-card-border bg-brand-card">
              {Array.from({ length: 4 }).map((_, row) => (
                <div key={row} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0 space-y-1">
                    <Skeleton className="h-3.5 w-44 max-w-full" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                  <Skeleton className="h-6 w-16 rounded-md" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </SkeletonRegion>
  );
}
