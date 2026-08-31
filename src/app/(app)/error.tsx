"use client";

import React, { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";

/**
 * Segment boundary for the (app) route group.
 *
 * Two jobs. (1) During a profile-read outage, intercept the parallel page throws that share the
 * layout's rejected read so they cannot reach the root boundary and replace the layout's
 * fail-closed AccountLoadError surface - this boundary's output lands in the children slot the
 * failing layout does not render. (2) For a page failure under a healthy shell, show a
 * restrained in-shell retry state instead of the full-screen root boundary. Server error
 * objects are redacted by Next.js in production, so no client-side classification is attempted
 * and no raw error text is rendered. The only correlation handle shown is the opaque `digest`
 * hash Next.js attaches, and only when it supplies one (QA-09A).
 */
export default function AppRouteGroupError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("(app) segment caught error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-4 text-center">
      <div
        role="alert"
        className="w-full max-w-md rounded-lg border border-brand-border bg-brand-card shadow-low"
      >
        <div className="flex items-center gap-3 rounded-t-lg border-b border-brand-border bg-brand-structural px-4 py-3 text-left">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-brand-danger-border bg-brand-danger-bg text-brand-danger">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          </span>
          <h2 className="text-[13px] font-semibold text-brand-navy">Unable to load this page</h2>
        </div>
        <div className="space-y-3 px-4 py-4">
          <p className="text-xs leading-relaxed text-brand-text-muted">
            Something went wrong while loading this page. Please try again.
          </p>
          {error.digest ? (
            <p className="text-[11px] text-brand-text-muted">
              Support reference:{" "}
              <span className="select-all font-mono text-brand-text">{error.digest}</span>
            </p>
          ) : null}
          <div className="pt-1">
            <Button variant="primary" size="sm" onClick={() => reset()}>
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Try Again
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
