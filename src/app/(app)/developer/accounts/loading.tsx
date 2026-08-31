import React from "react";
import { Skeleton, SkeletonRegion } from "@/components/ui/Skeleton";

const ROW_COUNT = 5;

/**
 * Route placeholder for the Developer Accounts module.
 *
 * Geometry mirrors the resolved view - one structural toolbar, then the records - so nothing
 * jumps when the directory arrives. There is no heading placeholder because the view has no
 * in-body heading: the shell supplies the page title.
 *
 * The records are drawn twice for the same reason the real module draws them twice: a table at
 * lg and up, a record list below it. A single shape would promise a layout the page does not
 * deliver at one of the two widths.
 *
 * The root carries no `animate-pulse` of its own - `Skeleton` animates itself under
 * `motion-safe:`, so a second timeline here would both desynchronise and, unlike Skeleton,
 * survive a reduced-motion preference.
 */
export default function DeveloperAccountsLoading() {
  return (
    <SkeletonRegion isLoading label="Loading Developer accounts" className="space-y-4">
      {/* Toolbar: search field, Add action, result count. */}
      <div className="space-y-2.5 rounded-lg border border-brand-card-border bg-brand-structural p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <Skeleton className="h-[3.75rem] w-full lg:max-w-sm lg:flex-1" />
          <div className="flex shrink-0 gap-2 lg:ml-auto">
            <Skeleton className="h-11 w-52 sm:h-8" />
          </div>
        </div>
        <Skeleton className="h-4 w-56 max-w-full" />
      </div>

      {/* Desktop: the bordered directory table. */}
      <div className="hidden overflow-hidden rounded-lg border border-brand-card-border bg-brand-card lg:block">
        <div className="border-b border-brand-card-border bg-brand-background px-3 py-2.5">
          <Skeleton className="h-3 w-64" />
        </div>
        <div className="divide-y divide-brand-border-subtle">
          {Array.from({ length: ROW_COUNT }).map((_, rowIndex) => (
            <div key={rowIndex} className="flex items-center justify-between gap-4 px-3 py-2.5">
              <div className="min-w-0 space-y-1.5">
                <Skeleton className="h-4 w-40 max-w-full" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-5 w-16 shrink-0" />
              <Skeleton className="h-3 w-20 shrink-0" />
              <Skeleton className="h-8 w-72 shrink-0" />
            </div>
          ))}
        </div>
      </div>

      {/* Narrow widths: one card per account. */}
      <div className="space-y-2 lg:hidden">
        {Array.from({ length: ROW_COUNT }).map((_, cardIndex) => (
          <div
            key={cardIndex}
            className="space-y-3 rounded-lg border border-brand-card-border bg-brand-card p-3 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1.5">
                <Skeleton className="h-4 w-36 max-w-full" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-5 w-16 shrink-0" />
            </div>
            <Skeleton className="h-3 w-32" />
            <div className="flex flex-wrap gap-1.5 border-t border-brand-border-subtle pt-2.5">
              <Skeleton className="h-11 w-36" />
              <Skeleton className="h-11 w-56" />
              <Skeleton className="h-11 w-28" />
              <Skeleton className="h-11 w-24" />
            </div>
          </div>
        ))}
      </div>
    </SkeletonRegion>
  );
}
