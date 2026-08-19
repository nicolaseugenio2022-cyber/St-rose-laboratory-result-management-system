import React from "react";

export default function AuditLoading() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-pulse">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="h-8 w-40 bg-slate-200 rounded-md mb-2"></div>
          <div className="h-4 w-80 bg-slate-100 rounded-md"></div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="h-4 w-24 rounded bg-slate-100"></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-20 rounded bg-slate-100"></div>
              <div className="h-10 w-full rounded-lg bg-slate-100"></div>
            </div>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="h-11 border-b border-slate-200 bg-slate-100"></div>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-16 border-b border-slate-100 bg-slate-50 last:border-b-0"></div>
        ))}
      </div>

      <div className="h-14 w-full rounded-xl border border-slate-200 bg-white shadow-sm"></div>
    </div>
  );
}
