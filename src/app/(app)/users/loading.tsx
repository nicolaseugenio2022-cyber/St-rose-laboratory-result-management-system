import React from "react";
import { Skeleton, SkeletonRegion } from "@/components/ui/Skeleton";

const DIRECTORY_ROW_COUNT = 6;

/**
 * Route placeholder for the staff account directory.
 *
 * Geometry mirrors the finished view - one structural toolbar, then the bordered directory -
 * so nothing jumps when the server-rendered directory resolves. There is no heading
 * placeholder because the view has no in-body heading; the shell supplies it.
 *
 * The root no longer carries `animate-pulse`. Skeleton animates itself under
 * `motion-safe:`, so the root pulse was a second, unsynchronised timeline on top of it - and
 * unlike Skeleton it was not withdrawn for a reduced-motion operator.
 */
export default function UsersLoading() {
  return (
    <SkeletonRegion isLoading label="Loading staff accounts" className="space-y-6">
      {/* Toolbar: search, role filter, actions, result count. */}
      <div className="space-y-2.5 rounded-lg border border-brand-card-border bg-brand-structural p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <Skeleton className="h-[3.75rem] w-full lg:max-w-sm" />
          <Skeleton className="h-[3.75rem] w-full lg:w-52" />
          {/* Matches the real Add staff account control, which is held to a 44px touch target
              below sm and drops to the compact 32px size above it. */}
          <div className="flex shrink-0 gap-2 lg:ml-auto">
            <Skeleton className="h-11 w-36 sm:h-8" />
          </div>
        </div>
        <Skeleton className="h-4 w-48" />
      </div>

      {/* Directory. One border, matching the single bordered container the shared Table
          primitive draws for itself - the finished view no longer nests it inside a second one. */}
      <div className="overflow-hidden rounded-lg border border-brand-card-border bg-brand-card">
        <div className="border-b border-brand-card-border bg-brand-structural px-3 py-2">
          <Skeleton className="h-3 w-56" />
        </div>
        <div className="divide-y divide-brand-border-subtle">
          {Array.from({ length: DIRECTORY_ROW_COUNT }).map((_, rowIndex) => (
            <div key={rowIndex} className="flex items-center justify-between gap-3 px-3 py-3">
              <div className="min-w-0 space-y-1.5">
                <Skeleton className="h-4 w-40 max-w-full" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-8 w-48 shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </SkeletonRegion>
  );
}
