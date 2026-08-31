import React from "react";
import { Skeleton, SkeletonRegion } from "@/components/ui/Skeleton";

/** One bordered panel of placeholder rows, matching a real list panel's geometry. */
function PanelSkeleton({ rows }: { rows: number }) {
  return (
    <div className="divide-y divide-brand-border-subtle overflow-hidden rounded-lg border border-brand-card-border bg-brand-card">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center justify-between gap-3 px-3 py-2">
          <Skeleton className="h-3.5 w-40" />
          <Skeleton className="h-3.5 w-16" />
        </div>
      ))}
    </div>
  );
}

function SectionSkeleton({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <div className="border-b border-brand-border-subtle pb-1.5">
        <Skeleton className="h-3.5 w-36" />
      </div>
      {children}
    </div>
  );
}

/**
 * Placeholder for the Developer technical surface.
 *
 * Mirrors the finished composition region for region - health strip, two
 * diagnostics panels, a statistics strip, then activity beside administration -
 * so nothing jumps when the awaited data resolves. Decorative throughout: the
 * Suspense boundary conveys the loading state.
 */
export function DeveloperDashboardSkeleton() {
  return (
    // SkeletonRegion announces the loading state once, semantically, while the
    // placeholders inside stay decorative and hidden from assistive technology.
    <SkeletonRegion isLoading label="Loading developer dashboard" className="space-y-5">
      <SectionSkeleton>
        {/* Geometry, not semantics: the placeholder stays decorative divs so it never
            announces an empty description list, while matching the real strip cell for
            cell so nothing shifts when the data resolves. */}
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-brand-card-border bg-brand-card-border md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-1.5 bg-brand-structural px-3 py-2.5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </SectionSkeleton>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <SectionSkeleton>
          <PanelSkeleton rows={4} />
        </SectionSkeleton>
        <SectionSkeleton>
          <PanelSkeleton rows={5} />
        </SectionSkeleton>
      </div>

      <SectionSkeleton>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-brand-card-border bg-brand-card-border md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-1.5 bg-brand-structural px-3 py-2.5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-4 w-12" />
            </div>
          ))}
        </div>
      </SectionSkeleton>

      {/* Mirrors the corrected composition: Recent System Activity is full width now that
          Administration is gone, so the placeholder must be too or the page jumps on
          resolve. */}
      <SectionSkeleton>
        <PanelSkeleton rows={6} />
      </SectionSkeleton>
    </SkeletonRegion>
  );
}
