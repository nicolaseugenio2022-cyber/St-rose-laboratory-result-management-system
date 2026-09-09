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
    <div aria-busy="true" aria-label="Loading personnel directory" className="space-y-4 pb-6">
      {/* Section heading: "Signing Personnel", above the block it names. */}
      <Skeleton className="h-4 w-36" />

      {/* Summary strip: the four counts, number over label - the same strip the two account
          directories open with. */}
      <div className="rounded-lg border border-brand-border bg-brand-structural px-3 py-2.5">
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:flex sm:flex-wrap sm:gap-x-7">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="space-y-1">
              <Skeleton className="h-5 w-10" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>
      </div>

      {/* Filter band: the header row and the Add action, then search, role and status, then the
          result count. Each control carries a visible label above it. */}
      <section className="space-y-2.5 rounded-lg border border-brand-border bg-brand-structural px-3 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-11 w-36 shrink-0 sm:h-8" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="min-w-0 space-y-1.5 lg:col-span-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-11 w-full sm:h-9" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-11 w-full sm:h-9" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-11 w-full sm:h-9" />
          </div>
        </div>
        <div className="flex h-4 items-center">
          <Skeleton className="h-3 w-40" />
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

      {/* Second section: "Requesting Physicians". Four counts, one search field beside one status
          select, then a five-column record list - Physician, Assigned examinations, Default for,
          Status, Actions - so the placeholder promises the table that actually arrives. Each row
          reserves two lines in the assignment columns, because a summarised assignment set is a
          chip row above a disclosure and a one-line placeholder would collapse on arrival. */}
      <div className="space-y-4 pt-4">
        <Skeleton className="h-4 w-44" />

        <div className="rounded-lg border border-brand-border bg-brand-structural px-3 py-2.5">
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:flex sm:flex-wrap sm:gap-x-7">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="space-y-1">
                <Skeleton className="h-5 w-10" />
                <Skeleton className="h-3 w-20" />
              </div>
            ))}
          </div>
        </div>

        <section className="space-y-2.5 rounded-lg border border-brand-border bg-brand-structural px-3 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-11 w-36 shrink-0 sm:h-8" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="min-w-0 space-y-1.5 lg:col-span-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-11 w-full sm:h-9" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-14" />
              <Skeleton className="h-11 w-full sm:h-9" />
            </div>
          </div>
          <div className="flex h-4 items-center">
            <Skeleton className="h-3 w-40" />
          </div>
        </section>

        <div className="overflow-hidden rounded-lg border border-brand-border bg-brand-card">
          <div className="flex items-center gap-6 border-b border-brand-border bg-brand-structural px-3 py-2.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="hidden h-3 w-32 lg:block" />
            <Skeleton className="hidden h-3 w-20 lg:block" />
            <Skeleton className="hidden h-3 w-12 lg:block" />
            <Skeleton className="h-3 w-14" />
          </div>
          <div className="divide-y divide-brand-border-subtle">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="flex items-start gap-6 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <Skeleton className="h-3.5 w-52 max-w-full" />
                </div>
                <div className="hidden w-32 shrink-0 space-y-1.5 lg:block">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-2.5 w-20" />
                </div>
                <div className="hidden w-20 shrink-0 space-y-1.5 lg:block">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-2.5 w-12" />
                </div>
                <Skeleton className="hidden h-4 w-14 shrink-0 lg:block" />
                <Skeleton className="h-4 w-14 shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
