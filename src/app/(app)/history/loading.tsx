import React from "react";
import { Skeleton, SkeletonRegion } from "@/components/ui/Skeleton";

const TABLE_COLUMN_COUNT = 9;

export default function HistoryLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="h-8 w-48 bg-slate-200 rounded-md mb-2"></div>
          <div className="h-4 w-72 bg-slate-100 rounded-md"></div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="h-24 w-full rounded-xl border border-slate-200 bg-slate-100"></div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <SkeletonRegion isLoading label="Loading session history" className="overflow-x-auto">
          <table className="w-full min-w-[960px] border-collapse text-left text-xs">
            <caption className="sr-only">Loading patient report session history</caption>
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                {Array.from({ length: TABLE_COLUMN_COUNT }).map((_, columnIndex) => (
                  <th key={columnIndex} className="px-4 py-3">
                    <Skeleton className="h-3 w-20" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {Array.from({ length: 5 }).map((_, rowIndex) => (
                <tr key={rowIndex}>
                  {Array.from({ length: TABLE_COLUMN_COUNT }).map((__, columnIndex) => (
                    <td key={columnIndex} className="px-4 py-3">
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
