"use client";

import React, { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App Router Caught Error:", error);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6 bg-slate-50">
      <div className="bg-white rounded-2xl border border-slate-200 p-8 max-w-md w-full text-center shadow-lg space-y-4">
        <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">Application Exception</h2>
          <p className="text-xs text-slate-500 mt-1">
            An unexpected error occurred while processing your request. All patient session data remains safely persisted.
          </p>
        </div>
        {error.message && (
          <div className="bg-slate-100 p-3 rounded-lg text-left font-mono text-[11px] text-slate-700 break-words border border-slate-200">
            {error.message}
          </div>
        )}
        <button
          type="button"
          onClick={() => reset()}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg bg-brand-primary text-white hover:bg-brand-primary-hover transition-colors shadow-sm"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Try Again
        </button>
      </div>
    </div>
  );
}
