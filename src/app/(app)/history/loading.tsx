import React from "react";
import { Skeleton, SkeletonRegion } from "@/components/ui/Skeleton";

const TABLE_COLUMN_COUNT = 9;

export default function HistoryLoading() {
  return (
    <div className="space-y-6">
      {/* Geometry mirrors the corrected view: no in-body heading, and one compact control
          row - search, scope and sort - rather than the old two-line toolbar. */}
      <div className="h-[5.25rem] w-full rounded-lg border border-brand-card-border bg-brand-structural"></div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-brand-card-border bg-brand-card">
        <SkeletonRegion isLoading label="Loading session history" className="overflow-x-auto">
          <table className="w-full min-w-[960px] border-collapse text-left text-xs">
            <caption className="sr-only">Loading patient report session history</caption>
            <thead>
              <tr className="border-b border-brand-card-border bg-brand-structural">
                {Array.from({ length: TABLE_COLUMN_COUNT }).map((_, columnIndex) => (
                  <th key={columnIndex} className="px-2.5 py-2.5">
                    <Skeleton className="h-3 w-20" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border-subtle">
              {Array.from({ length: 5 }).map((_, rowIndex) => (
                <tr key={rowIndex}>
                  {Array.from({ length: TABLE_COLUMN_COUNT }).map((__, columnIndex) => (
                    <td key={columnIndex} className="px-2.5 py-2.5">
                      <Skeleton className="h-4 w-full" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </SkeletonRegion>
      </div>
    </div>
  );
}
