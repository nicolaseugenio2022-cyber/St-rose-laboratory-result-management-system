import React from "react";

export default function UsersLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="h-8 w-48 bg-slate-200 rounded-md mb-2"></div>
          <div className="h-4 w-96 bg-slate-100 rounded-md"></div>
        </div>
        <div className="h-10 w-32 bg-slate-200 rounded-md"></div>
      </div>

      {/* Toolbar */}
      <div className="h-16 w-full bg-slate-100 rounded-xl border border-slate-200"></div>

      {/* Table */}
      <div className="h-96 w-full bg-slate-50 rounded-xl border border-slate-200"></div>
    </div>
  );
}
