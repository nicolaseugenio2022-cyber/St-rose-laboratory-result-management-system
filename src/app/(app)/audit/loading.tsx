import React from "react";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Route-level placeholder for the Audit Log.
 *
 * Mirrors the resolved page exactly: one structural filter surface, then one working surface that
 * holds the records AND the pagination footer. It previously opened with a title-and-description
 * header block that the page no longer renders — the shell owns the page title — so the skeleton
 * reserved ~90px that nothing ever filled, and the whole page jumped upward on resolve.
 *
 * The shared `Skeleton` carries the shimmer and already honours reduced motion, so nothing here
 * animates on its own.
 */
export default function AuditLoading() {
  return (
    <div aria-busy="true" aria-label="Loading audit log" className="space-y-6 pb-12">
      {/* Structural filter surface */}
      <div className="space-y-2.5 rounded-lg border border-brand-card-border bg-brand-structural p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-8 w-24" />
        </div>
        <div className="grid gap-x-3 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="space-y-1.5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </div>
      </div>

      {/* Working surface: records plus the pagination footer, one border for both */}
      <div className="overflow-hidden rounded-lg border border-brand-card-border bg-brand-card">
        <div className="hidden h-9 border-b border-brand-card-border bg-brand-structural md:block" />
        <div className="divide-y divide-brand-border-subtle">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="px-3 py-3">
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-3 border-t border-brand-card-border bg-brand-structural px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
          <Skeleton className="h-3 w-40" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-11 w-24 sm:h-8" />
            <Skeleton className="h-11 w-24 sm:h-8" />
          </div>
        </div>
      </div>
    </div>
  );
}
