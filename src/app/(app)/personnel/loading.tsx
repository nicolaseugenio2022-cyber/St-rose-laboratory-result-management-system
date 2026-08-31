import React from "react";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Route-level placeholder for the Personnel Directory.
 *
 * Mirrors the real module's three blocks - context band with four summary counts, filter
 * toolbar, then the record list - so the layout does not jump when data arrives. There is no
 * title block: the page heading belongs to the app shell, which is already painted by the time
 * this renders. The shared `Skeleton` carries the shimmer and already honours reduced-motion,
 * so nothing here animates on its own.
 */
export default function PersonnelLoading() {
  return (
    <div aria-busy="true" aria-label="Loading personnel directory" className="space-y-4">
      {/* Context line + summary strip */}
      <section className="overflow-hidden rounded-xl border border-brand-border bg-brand-structural">
        <div className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <Skeleton className="h-3 w-80 max-w-full" />
          <Skeleton className="h-11 w-32 shrink-0 sm:h-8" />
        </div>
        <div className="grid grid-cols-2 divide-x divide-y divide-brand-border border-t border-brand-border sm:grid-cols-4 sm:divide-y-0">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="space-y-1.5 px-3 py-2 sm:px-4">
              <Skeleton className="h-5 w-8" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
      </section>

      {/* Filter toolbar: each control carries a visible label above it */}
      <section className="rounded-xl border border-brand-border bg-brand-structural px-3 py-3">
        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-end">
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="grid grid-cols-2 gap-2.5 lg:flex lg:shrink-0">
            <div className="space-y-1.5 lg:w-44">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-1.5 lg:w-36">
              <Skeleton className="h-3 w-14" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        </div>
        <div className="mt-2.5 border-t border-brand-border pt-2.5">
          <Skeleton className="h-3 w-24" />
        </div>
      </section>

      {/* Record list */}
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
