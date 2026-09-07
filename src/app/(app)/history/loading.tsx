import React from "react";
import { Skeleton, SkeletonRegion } from "@/components/ui/Skeleton";

// Mirrors SessionHistoryView: four fixed-proportion columns, so the skeleton has the resolved
// geometry of the table it stands in for and swapping in the rows causes no layout shift.
// Duplicated rather than imported: this is a server component and that constant lives in a
// client module. It must be changed with the view's own COLUMN_WIDTH_CLASS.
const TABLE_COLUMN_COUNT = 4;
const COLUMN_WIDTH_CLASS = ["w-[34%]", "w-[20%]", "w-[22%]", "w-[24%]"];

export default function HistoryLoading() {
  return (
    <div className="space-y-4">
      {/* Toolbar: no in-body heading; one control row - search, scope, sort - with the
          result-count line beneath it, at the same padding and field heights as the view. */}
      <div className="rounded-lg border border-brand-border bg-brand-structural px-3 py-2.5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="min-w-0 flex-1 space-y-1.5 lg:max-w-md">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-11 w-full sm:h-9" />
          </div>
          <div className="shrink-0 space-y-1.5">
            <Skeleton className="h-3 w-10" />
            <Skeleton className="h-11 w-56 max-w-full sm:h-9" />
          </div>
          <div className="w-full shrink-0 space-y-1.5 lg:w-56">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-11 w-full sm:h-9" />
          </div>
        </div>
        <div className="mt-2.5 border-t border-brand-border pt-2">
          <Skeleton className="h-3 w-56 max-w-full" />
        </div>
      </div>

      {/* Records: the md+ table panel and the narrow record-card list, each at final size. */}
      <SkeletonRegion isLoading label="Loading session history">
        <div className="hidden overflow-hidden rounded-lg border border-brand-border bg-brand-card shadow-low md:block">
          <table className="w-full table-fixed border-collapse text-left text-xs">
            <caption className="sr-only">Loading patient report session history</caption>
            <thead className="border-b border-brand-border bg-brand-structural">
              <tr>
                {Array.from({ length: TABLE_COLUMN_COUNT }).map((_, columnIndex) => (
                  <th key={columnIndex} scope="col" className={`px-3 py-2 ${COLUMN_WIDTH_CLASS[columnIndex]}`}>
                    <Skeleton className="h-3 w-20 max-w-full" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border-subtle">
              {Array.from({ length: 5 }).map((_, rowIndex) => (
                <tr key={rowIndex}>
                  {Array.from({ length: TABLE_COLUMN_COUNT }).map((__, columnIndex) => (
                    <td key={columnIndex} className="px-3 py-2 align-middle">
                      <Skeleton className="h-4 w-full" />
                      {columnIndex === 0 && (
                        <>
                          <Skeleton className="mt-1 h-3 w-3/4" />
                          <Skeleton className="mt-1 hidden h-3 w-2/3 lg:block" />
                        </>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="space-y-3 md:hidden" aria-hidden="true">
          {Array.from({ length: 3 }).map((_, cardIndex) => (
            <div
              key={cardIndex}
              className="overflow-hidden rounded-lg border border-brand-border bg-brand-card shadow-low"
            >
              <div className="flex items-start justify-between gap-3 px-3.5 py-2.5">
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3.5 w-28" />
                </div>
                <Skeleton className="h-4 w-16" />
              </div>
              <div className="space-y-1.5 border-t border-brand-border-subtle px-3.5 py-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48 max-w-full" />
              </div>
              <div className="flex gap-2 border-t border-brand-border bg-brand-structural px-3.5 py-2">
                <Skeleton className="h-9 w-24" />
                <Skeleton className="h-9 w-20" />
              </div>
            </div>
          ))}
        </div>
      </SkeletonRegion>
    </div>
  );
}
