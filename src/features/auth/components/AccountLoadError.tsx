"use client";

import React, { useEffect, useRef, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

/**
 * Fail-closed account-load failure surface for the authenticated route-group layouts.
 *
 * Rendered INSTEAD OF the shell and children when profile resolution failed on a proven
 * transient transport fault (see loadAuthenticatedShellProfile). Retry re-runs the normal
 * server route resolution via router.refresh() - the full session/profile/role chain runs
 * again; nothing is bypassed. The copy deliberately makes no claim about session validity:
 * DB-backed revalidation did not complete, so neither "signed out" nor "still active" is
 * provable here.
 */
export function AccountLoadError() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    cardRef.current?.focus();
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-brand-background p-4 text-center">
      <div
        ref={cardRef}
        tabIndex={-1}
        role="alert"
        className="max-w-md space-y-4 rounded-xl border border-brand-border bg-brand-surface p-8 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring"
      >
        <h2 className="text-2xl font-bold text-brand-text">Unable to load your account</h2>
        <p className="text-xs text-brand-text-muted">
          We couldn&apos;t load your account information right now. Please try again in a moment.
        </p>
        <div className="pt-2">
          <Button
            variant="primary"
            size="sm"
            isLoading={isPending}
            onClick={() => startTransition(() => router.refresh())}
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Try Again
          </Button>
        </div>
      </div>
    </div>
  );
}
