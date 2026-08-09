import React from "react";

export default function WorkspaceLoading() {
  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col p-6 animate-pulse">
      <div className="flex justify-between items-center mb-6">
        <div className="h-8 w-64 bg-slate-200 rounded-md"></div>
        <div className="h-10 w-40 bg-slate-200 rounded-md"></div>
      </div>
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-50 rounded-xl border border-slate-200"></div>
        <div className="bg-slate-50 rounded-xl border border-slate-200"></div>
      </div>
    </div>
  );
}
