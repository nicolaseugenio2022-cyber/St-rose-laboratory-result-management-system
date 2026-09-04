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
    <SkeletonRegion isLoading label="Loading Developer accounts" className="space-y-4">
      {/* Toolbar: search field, Add action, result count. The field is 44px below sm and 36px
          from sm up, under its 11px label line - the geometry the shared Input resolves to. */}
      <div className="rounded-lg border border-brand-border bg-brand-structural px-3 py-2.5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="min-w-0 flex-1 space-y-1.5 lg:max-w-sm">
            <div className="flex h-4 items-center">
              <Skeleton className="h-3 w-14" />
            </div>
            <Skeleton className="h-11 w-full sm:h-9" />
          </div>
          {/* Matches the real Add Developer account control: a 44px touch target below sm, and
              the 36px medium control that lines up with the field beside it. */}
          <div className="flex shrink-0 gap-2 lg:ml-auto">
            <Skeleton className="h-11 w-52 sm:h-9" />
          </div>
        </div>
        <div className="mt-2 flex h-4 items-center">
          <Skeleton className="h-3 w-56 max-w-full" />
        </div>
      </div>

      <DeveloperAccountDirectorySkeleton />
    </SkeletonRegion>
  );
}
