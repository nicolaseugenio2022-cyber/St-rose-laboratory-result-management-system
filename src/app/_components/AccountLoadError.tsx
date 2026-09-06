"use client";

import React, { useEffect, useRef, useTransition } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { AuthShell } from "./AuthShell";

/**
 * Fail-closed account-load failure surface for the authenticated route-group layouts.
 *
 * Rendered INSTEAD OF the shell and children when profile resolution failed on a proven
 * transient transport fault (see loadAuthenticatedShellProfile). Retry re-runs the normal
 * server route resolution via router.refresh() - the full session/profile/role chain runs
 * again; nothing is bypassed. The copy deliberately makes no claim about session validity:
 * DB-backed revalidation did not complete, so neither "signed out" nor "still active" is
 * provable here.
 *
 * It sits in AuthShell because it replaces a whole authenticated page: the laboratory's own
 * headed sheet on the brand canvas, rather than a lone card floating on a bare ground. The
 * shell's standing admission notice is suppressed here - the reader is already signed in, so
 * "For authorised laboratory personnel." would be addressed to the wrong person. The message
 * and the single retry action are unchanged - no new recovery route, no contact details the
 * application cannot honour.
 */
export function AccountLoadError() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const failureRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    failureRef.current?.focus();
  }, []);

  return (
    <AuthShell title="Unable to load your account" showAccessNotice={false}>
      {/* Focus moves here on mount, as before, so a keyboard or screen-reader user lands on the
          failure rather than at the top of a page whose content never arrived. The shared Alert
          carries role="alert", so the message is announced as well as drawn. */}
      <div ref={failureRef} tabIndex={-1} className="space-y-4 focus-visible:outline-none">
        <Alert variant="destructive">
          We couldn&apos;t load your account information right now. Please try again in a moment.
        </Alert>

        {/* Disabled while the refresh is in flight, so a second press cannot stack another
            route resolution. The label is stable across the pending state - only the icon
            changes - so the button's accessible name does not shift mid-action. */}
        <Button
          type="button"
          variant="primary"
          className="w-full rounded-md sm:w-auto"
          disabled={isPending}
          aria-busy={isPending || undefined}
          onClick={() => startTransition(() => router.refresh())}
        >
          {isPending ? (
            <Loader2 aria-hidden="true" className="h-4 w-4 motion-safe:animate-spin" />
          ) : (
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
          )}
          Try Again
        </Button>
      </div>
    </AuthShell>
  );
}
