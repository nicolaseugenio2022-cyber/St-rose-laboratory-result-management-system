import React from "react";
import { Skeleton, SkeletonRegion } from "@/components/ui/Skeleton";

/** One panel of placeholder rows, matching a real list panel's geometry. */
function PanelSkeleton({ rows }: { rows: number }) {
  return (
    <div className="divide-y divide-brand-border-subtle">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center justify-between gap-3 px-3.5 py-2">
          <Skeleton className="h-3.5 w-40" />
          <Skeleton className="h-3.5 w-16" />
        </div>
      ))}
    </div>
  );
}

/** A 2x2 (4-across below xl) strip of figure cells, matching the real description lists. */
function StripSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-px bg-brand-border md:grid-cols-4 xl:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2 bg-brand-card px-4 py-3.5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-6 w-14" />
        </div>
      ))}
    </div>
  );
}

/** The panel shell: a structural header band with the icon disc, as DashboardSection draws it. */
function SectionSkeleton({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border border-brand-border bg-brand-card shadow-low">
      <div className="flex items-center gap-2.5 border-b border-brand-border bg-brand-structural px-4 py-2.5">
        <Skeleton className="h-7 w-7 shrink-0" />
        <div className="space-y-1.5">
          <Skeleton className="h-3.5 w-36" />
          <Skeleton className="h-3 w-52 max-w-full" />
        </div>
      </div>
      {children}
    </div>
  );
}

/**
 * Placeholder for the Developer technical surface.
 *
 * Mirrors the finished composition region for region - health beside statistics,
 * the two diagnostics panels, then activity - so nothing jumps when the awaited
 * data resolves. Decorative throughout: the Suspense boundary conveys the loading
 * state.
 */
export function DeveloperDashboardSkeleton() {
  return (
    // SkeletonRegion announces the loading state once, semantically, while the
    // placeholders inside stay decorative and hidden from assistive technology.
    <SkeletonRegion isLoading label="Loading developer dashboard" className="space-y-4">
      {/* Geometry, not semantics: the placeholders stay decorative divs so they never
          announce an empty description list, while matching the real strips cell for
          cell so nothing shifts when the data resolves. */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 xl:items-start">
        <SectionSkeleton>
          <StripSkeleton />
        </SectionSkeleton>
        <SectionSkeleton>
          <StripSkeleton />
        </SectionSkeleton>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 xl:items-start">
        <SectionSkeleton>
          <PanelSkeleton rows={4} />
        </SectionSkeleton>
        <SectionSkeleton>
          <PanelSkeleton rows={5} />
        </SectionSkeleton>
      </div>

      {/* Recent System Activity is full width, so the placeholder must be too or the page
          jumps on resolve. */}
      <SectionSkeleton>
        <PanelSkeleton rows={6} />
      </SectionSkeleton>
    </SkeletonRegion>
  );
}
