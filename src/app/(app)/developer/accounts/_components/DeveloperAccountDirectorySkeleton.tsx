import React from "react";
import { Skeleton } from "@/components/ui/Skeleton";

const ROW_COUNT = 5;

/**
 * Placeholder for the Developer account directory, sized to the resolved geometry.
 *
 * Drawn twice for the same reason the real directory is drawn twice: a table panel at lg and
 * up, a record list below it. A single shape would promise a layout the page does not deliver
 * at one of the two widths.
 *
 * Shared by the route's `loading.tsx` and by the module's own first-load state, so the two
 * placeholders that appear back to back before the directory arrives are the same picture.
 * Presentational only: it carries no state and announces nothing - the caller wraps it in a
 * `SkeletonRegion`.
 */
export function DeveloperAccountDirectorySkeleton() {
  return (
    <>
      {/* Desktop: the white table panel with its structural header band. Rows are py-2 around
          the 32px action controls, which is the height the resolved rows settle at. */}
      <div className="hidden overflow-hidden rounded-lg border border-brand-border bg-brand-card shadow-low lg:block">
        <div className="flex h-8 items-center gap-6 border-b border-brand-border bg-brand-structural px-3">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="ml-auto h-3 w-16" />
        </div>
        <div className="divide-y divide-brand-border-subtle">
          {Array.from({ length: ROW_COUNT }).map((_, rowIndex) => (
            <div key={rowIndex} className="flex items-center gap-6 px-3 py-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-5 w-24 shrink-0" />
              <Skeleton className="h-4 w-24 shrink-0" />
              <Skeleton className="ml-auto h-8 w-[28rem] max-w-full" />
            </div>
          ))}
        </div>
      </div>

      {/* Narrow widths: one white record per account - header row, meta line, and the actions
          in a structural footer band. */}
      <div className="space-y-2 lg:hidden">
        {Array.from({ length: ROW_COUNT }).map((_, cardIndex) => (
          <div
            key={cardIndex}
            className="overflow-hidden rounded-lg border border-brand-border bg-brand-card shadow-low"
          >
            <div className="flex items-start justify-between gap-3 px-3.5 py-2.5">
              <Skeleton className="h-5 w-36 max-w-full" />
              <Skeleton className="h-5 w-20 shrink-0" />
            </div>
            <div className="px-3.5 pb-2.5">
              <Skeleton className="h-4 w-32" />
            </div>
            <div className="flex flex-wrap gap-1.5 border-t border-brand-border bg-brand-structural px-3.5 py-2.5">
              <Skeleton className="h-11 w-36" />
              <Skeleton className="h-11 w-56" />
              <Skeleton className="h-11 w-28" />
              <Skeleton className="h-11 w-24" />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
