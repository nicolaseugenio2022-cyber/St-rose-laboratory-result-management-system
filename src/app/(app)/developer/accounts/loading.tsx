import React from "react";
import { Skeleton, SkeletonRegion } from "@/components/ui/Skeleton";
import { DeveloperAccountDirectorySkeleton } from "./_components/DeveloperAccountDirectorySkeleton";

/**
 * Route placeholder for the Developer Accounts module.
 *
 * Geometry mirrors the resolved view - one structural toolbar, then the records - so nothing
 * jumps when the directory arrives. There is no heading placeholder because the view has no
 * in-body heading: the shell supplies the page title.
 *
 * The directory placeholder is the module's own, so this route placeholder and the module's
 * first-load state - which follow each other on screen - are the same picture.
 *
 * The root carries no `animate-pulse` of its own - `Skeleton` animates itself under
 * `motion-safe:`, so a second timeline here would both desynchronise and, unlike Skeleton,
 * survive a reduced-motion preference.
 */
export default function DeveloperAccountsLoading() {
  return (
    <SkeletonRegion isLoading label="Loading Developer accounts" className="space-y-4 pb-6">
      {/* Summary strip: the three counts, number over label. */}
      <div className="rounded-lg border border-brand-border bg-brand-structural px-3 py-2.5">
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:flex sm:flex-wrap sm:gap-x-7">
          {Array.from({ length: 3 }).map((_, figureIndex) => (
            <div key={figureIndex} className="space-y-1">
              <Skeleton className="h-5 w-10" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>
      </div>

      {/* Filter band: the header row, then search and status, then the result count. Each field
          is 44px below sm and 36px from sm up, under its 11px label line - the geometry the
          shared Input and Select resolve to. */}
      <div className="space-y-2.5 rounded-lg border border-brand-border bg-brand-structural px-3 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Skeleton className="h-3 w-28" />
          {/* Matches the real Add Developer account control: a 44px touch target below sm, and
              the 32px small control that lines up with the fields below it. */}
          <Skeleton className="h-11 w-52 sm:h-8" />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="min-w-0 space-y-1.5 sm:col-span-2">
            <div className="flex h-4 items-center">
              <Skeleton className="h-3 w-28" />
            </div>
            <Skeleton className="h-11 w-full sm:h-9" />
          </div>
          <div className="space-y-1.5">
            <div className="flex h-4 items-center">
              <Skeleton className="h-3 w-12" />
            </div>
            <Skeleton className="h-11 w-full sm:h-9" />
          </div>
        </div>
        <div className="flex h-4 items-center">
          <Skeleton className="h-3 w-56 max-w-full" />
        </div>
      </div>

      <DeveloperAccountDirectorySkeleton />
    </SkeletonRegion>
  );
}
