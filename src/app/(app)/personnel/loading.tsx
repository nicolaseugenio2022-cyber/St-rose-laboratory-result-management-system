import React from "react";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Route-level placeholder for the Personnel Directory.
 *
 * Mirrors the real module's three blocks - the summary panel with its header band and four
 * metric tiles, the filter toolbar, then the record list - so the layout does not jump when
 * data arrives. There is no title block: the page heading belongs to the app shell, which is
 * already painted by the time this renders. The shared `Skeleton` carries the shimmer and
 * already honours reduced-motion, so nothing here animates on its own.
 */
export default function PersonnelLoading() {
  return (
    <div aria-busy="true" aria-label="Loading personnel directory" className="space-y-4">
      {/* Summary panel: structural header band, then the metric strip */}
      <section className="overflow-hidden rounded-lg border border-brand-border bg-brand-card shadow-low">
        <div className="flex flex-col gap-2 border-b border-brand-border bg-brand-structural px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <Skeleton className="h-3 w-80 max-w-full" />
          <Skeleton className="h-11 w-32 shrink-0 sm:h-8" />
        </div>
        <div className="grid grid-cols-2 gap-px bg-brand-border sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="flex flex-col gap-1 bg-brand-card px-3.5 py-3">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-6 w-10" />
            </div>
          ))}
        </div>
      </section>

      {/* Filter toolbar: each control carries a visible label above it */}
      <section className="rounded-lg border border-brand-border bg-brand-structural px-3 py-2.5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-11 w-full sm:h-9" />
          </div>
          <div className="grid grid-cols-2 gap-3 lg:flex lg:shrink-0">
            <div className="space-y-1.5 lg:w-44">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-11 w-full sm:h-9" />
            </div>
            <div className="space-y-1.5 lg:w-36">
              <Skeleton className="h-3 w-14" />
              <Skeleton className="h-11 w-full sm:h-9" />
            </div>
          </div>
        </div>
        <div className="mt-2.5 border-t border-brand-border pt-2">
          <Skeleton className="h-3 w-24" />
        </div>
      </section>

      {/* Record list: a structural header band and six ~48px rows in a white panel */}
      <div className="overflow-hidden rounded-lg border border-brand-border bg-brand-card">
        <div className="flex items-center gap-6 border-b border-brand-border bg-brand-structural px-3 py-2.5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="hidden h-3 w-12 lg:block" />
          <Skeleton className="hidden h-3 w-20 lg:block" />
          <Skeleton className="hidden h-3 w-16 lg:block" />
          <Skeleton className="h-3 w-12" />
        </div>
        <div className="divide-y divide-brand-border-subtle">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="flex items-center gap-6 px-3 py-2.5">
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-44 max-w-full" />
                <Skeleton className="h-2.5 w-24 max-w-full" />
              </div>
              <Skeleton className="hidden h-4 w-24 lg:block" />
              <Skeleton className="hidden h-3 w-16 lg:block" />
              <Skeleton className="hidden h-3 w-16 lg:block" />
              <Skeleton className="h-4 w-14" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
