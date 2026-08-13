import React from "react";

export default function DeveloperAccountsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row">
        <div>
          <div className="mb-2 h-8 w-72 rounded-md bg-slate-200"></div>
          <div className="h-4 w-80 rounded-md bg-slate-100"></div>
        </div>
        <div className="h-9 w-32 rounded-lg bg-slate-200"></div>
      </div>

      <div className="h-16 w-full rounded-xl border border-slate-200 bg-slate-100"></div>

      <div className="overflow-hidden rounded-xl border border-slate-200">
        <div className="h-11 bg-slate-100"></div>
        {[1, 2, 3, 4].map((row) => (
          <div key={row} className="h-16 border-t border-slate-100 bg-slate-50"></div>
        ))}
      </div>
    </div>
  );
}
