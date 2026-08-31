import React from "react";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Route-level placeholder for the Audit Log.
 *
 * Mirrors the resolved page exactly: one structural toolbar, then one white working surface
 * that holds the records AND the pagination footer - a fixed-width table at md and up, compact
 * record cards on a structural ground below it. The shell owns the page title, so nothing here
 * reserves space for one, and the page does not jump on resolve.
 *
 * The shared `Skeleton` carries the shimmer and already honours reduced motion, so nothing here
 * animates on its own.
 */

// The same proportions the resolved table is budgeted on (see AUDIT_COLUMN_WIDTH in
// AuditLogView). Duplicated rather than imported: this is a server component and that
// constant lives in a client module.
const AUDIT_COLUMN_WIDTH = ["w-[14%]", "w-[26%]", "w-[19%]", "w-[12%]", "w-[19%]", "w-[10%]"];

export default function AuditLoading() {
  return (
    <div aria-busy="true" aria-label="Loading audit log" className="space-y-4 pb-6">
      {/* Structural toolbar: eyebrow left, primary action right, five labelled fields */}
      <div className="space-y-2.5 rounded-lg border border-brand-border bg-brand-structural px-3 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-11 w-24 sm:h-8" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="space-y-1.5">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-11 w-full sm:h-9" />
            </div>
          ))}
        </div>
      </div>

      {/* Working surface: records plus the pagination footer, one border for both */}
      <div className="overflow-hidden rounded-lg border border-brand-border bg-brand-card shadow-low">
        {/* md and up: structural header band, then two-line rows in the budgeted columns */}
        <div className="hidden md:block">
          <div className="flex items-center border-b border-brand-border bg-brand-structural">
            {AUDIT_COLUMN_WIDTH.map((width, index) => (
              <div key={index} className={`px-2.5 py-2.5 ${width}`}>
                <Skeleton className="h-3 w-20 max-w-full" />
              </div>
            ))}
          </div>
          <div className="divide-y divide-brand-border-subtle">
            {Array.from({ length: 8 }).map((_, row) => (
              <div key={row} className="flex items-center">
                {AUDIT_COLUMN_WIDTH.map((width, column) => (
                  <div key={column} className={`px-2.5 py-2 ${width}`}>
                    {column === 1 ? (
                      <div className="space-y-1">
                        <Skeleton className="h-3.5 w-3/4" />
                        <Skeleton className="h-2.5 w-1/2" />
                      </div>
                    ) : (
                      <Skeleton className={column === 5 ? "ml-auto h-8 w-8" : "h-3.5 w-full"} />
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* below md: compact record cards on a structural ground */}
        <div className="space-y-3 bg-brand-structural p-3 md:hidden">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="overflow-hidden rounded-lg border border-brand-border bg-brand-card shadow-low"
            >
              <div className="space-y-2 px-3.5 py-2.5">
                <div className="flex items-start justify-between gap-3">
                  <Skeleton className="h-4 w-2/5" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <Skeleton className="h-3.5 w-3/5" />
                <Skeleton className="h-3 w-1/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <div className="flex justify-end border-t border-brand-border bg-brand-structural px-3.5 py-2">
                <Skeleton className="h-11 w-28" />
              </div>
            </div>
          ))}
        </div>

        {/* Pagination footer band */}
        <div className="flex flex-col gap-2 border-t border-brand-border bg-brand-structural px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
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
