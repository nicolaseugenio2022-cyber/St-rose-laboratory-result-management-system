import React from "react";

export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Banner Skeleton */}
      <div className="h-32 rounded-xl bg-slate-200"></div>
      
      {/* Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 rounded-xl bg-slate-100 border border-slate-200"></div>
        ))}
      </div>
      
      {/* Actions Skeleton */}
      <div className="h-48 rounded-xl bg-slate-100 border border-slate-200"></div>
    </div>
  );
}
