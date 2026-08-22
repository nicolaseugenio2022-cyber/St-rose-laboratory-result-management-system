"use client";

import React, { useEffect } from "react";
import { RefreshCw } from "lucide-react";
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
 * and no raw error text is rendered.
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
        className="max-w-md space-y-4 rounded-xl border border-brand-border bg-brand-surface p-8 shadow-sm"
      >
        <h2 className="text-lg font-bold text-brand-text">Unable to load this page</h2>
        <p className="text-xs text-brand-text-muted">
          Something went wrong while loading this page. Please try again.
        </p>
        <div className="pt-2">
          <Button variant="primary" size="sm" onClick={() => reset()}>
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Try Again
          </Button>
        </div>
      </div>
    </div>
  );
}
