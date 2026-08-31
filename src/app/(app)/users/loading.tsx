import React from "react";
import { Skeleton, SkeletonRegion } from "@/components/ui/Skeleton";

const DIRECTORY_ROW_COUNT = 6;

/**
 * A labelled field placeholder: the 11px label line above a field that is 44px below sm and
 * 36px from sm up, which is the geometry the shared Input and Select resolve to.
 */
function FieldSkeleton({ labelWidth, className = "" }: { labelWidth: string; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex h-4 items-center">
        <Skeleton className={`h-3 ${labelWidth}`} />
      </div>
      <Skeleton className="h-11 w-full sm:h-9" />
    </div>
  );
}

/**
 * Route placeholder for the staff account directory.
 *
 * Geometry mirrors the finished Admin view - one structural toolbar, then the white directory
 * panel at md and up and the record cards below it - so nothing jumps when the server-rendered
 * directory resolves. There is no heading placeholder because the view has no in-body heading;
 * the shell supplies it.
 *
 * The root no longer carries `animate-pulse`. Skeleton animates itself under
 * `motion-safe:`, so the root pulse was a second, unsynchronised timeline on top of it - and
 * unlike Skeleton it was not withdrawn for a reduced-motion operator.
 */
export default function UsersLoading() {
  return (
    <SkeletonRegion isLoading label="Loading staff accounts" className="space-y-4">
      {/* Toolbar: search, role filter, the Add action, and the result count. */}
      <div className="rounded-lg border border-brand-border bg-brand-structural px-3 py-2.5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <FieldSkeleton labelWidth="w-28" className="min-w-0 flex-1 lg:max-w-sm" />
          <FieldSkeleton labelWidth="w-10" className="w-full shrink-0 lg:w-52" />
          {/* Matches the real Add staff account control: a 44px touch target below sm, and the
              36px medium control that lines up with the fields above it. */}
          <div className="flex shrink-0 gap-2 lg:ml-auto">
            <Skeleton className="h-11 w-40 sm:h-9" />
          </div>
        </div>
        <div className="mt-2 flex h-4 items-center">
          <Skeleton className="h-3 w-48" />
        </div>
      </div>

      {/* Desktop: the white table panel with its structural header band. Rows are py-2 around
          the 32px action controls, which is the height the resolved rows settle at. */}
      <div className="hidden overflow-hidden rounded-lg border border-brand-border bg-brand-card shadow-low md:block">
        <div className="flex h-8 items-center gap-6 border-b border-brand-border bg-brand-structural px-3">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="ml-auto h-3 w-16" />
        </div>
        <div className="divide-y divide-brand-border-subtle">
          {Array.from({ length: DIRECTORY_ROW_COUNT }).map((_, rowIndex) => (
            <div key={rowIndex} className="flex items-center gap-6 px-3 py-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-5 w-24 shrink-0" />
              <Skeleton className="h-5 w-16 shrink-0" />
              <Skeleton className="h-4 w-24 shrink-0" />
              <Skeleton className="ml-auto h-8 w-72 max-w-full" />
            </div>
          ))}
        </div>
      </div>

      {/* Narrow widths: one white record per account - header row, meta line, and the actions
          in a structural footer band. */}
      <div className="space-y-2 md:hidden">
        {Array.from({ length: DIRECTORY_ROW_COUNT }).map((_, cardIndex) => (
          <div
            key={cardIndex}
            className="overflow-hidden rounded-lg border border-brand-border bg-brand-card shadow-low"
          >
            <div className="flex items-start justify-between gap-3 px-3.5 py-2.5">
              <Skeleton className="h-5 w-36 max-w-full" />
              <Skeleton className="h-5 w-16 shrink-0" />
            </div>
            <div className="flex items-center gap-2 px-3.5 pb-2.5">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-4 w-28" />
            </div>
            <div className="flex flex-wrap gap-2 border-t border-brand-border bg-brand-structural px-3.5 py-2.5">
              <Skeleton className="h-11 w-20" />
              <Skeleton className="h-11 w-36" />
              <Skeleton className="h-11 w-28" />
              <Skeleton className="h-11 w-24" />
            </div>
          </div>
        ))}
      </div>
    </SkeletonRegion>
  );
}
