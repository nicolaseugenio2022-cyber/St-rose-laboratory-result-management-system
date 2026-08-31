"use client";

import React, { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";

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
    <div className="flex min-h-[70vh] items-center justify-center bg-brand-canvas p-6">
      <div
        role="alert"
        className="w-full max-w-md overflow-hidden rounded-lg border border-brand-border-strong bg-brand-card shadow-low"
      >
        <div className="flex items-center gap-3 border-b border-brand-border bg-brand-structural px-4 py-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-brand-warning-border bg-brand-warning-bg text-brand-warning">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          </span>
          <h2 className="text-[13px] font-semibold text-brand-navy">Application Exception</h2>
        </div>
        <div className="space-y-3 px-4 py-4">
          <p className="text-xs leading-relaxed text-brand-text-muted">
            An unexpected error occurred while processing your request. All patient session data remains safely persisted.
          </p>
          {error.digest ? (
            <p className="text-[11px] text-brand-text-muted">
              Support reference:{" "}
              <span className="select-all font-mono text-brand-text">{error.digest}</span>
            </p>
          ) : null}
          <div className="pt-1">
            <Button type="button" size="sm" onClick={() => reset()}>
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Try Again
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
