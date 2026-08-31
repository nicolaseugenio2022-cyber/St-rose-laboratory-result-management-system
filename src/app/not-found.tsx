import React from "react";
import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-brand-canvas p-4 text-center">
      <div className="w-full max-w-md overflow-hidden rounded-lg border border-brand-border-strong bg-brand-surface shadow-low">
        <div className="flex items-center gap-3 border-b border-brand-border bg-brand-structural px-4 py-3 text-left">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-brand-border bg-brand-surface text-brand-text-muted">
            <SearchX className="h-4 w-4" aria-hidden="true" />
          </span>
          <h2 className="text-[13px] font-semibold text-brand-navy">404 — Page Not Found</h2>
        </div>
        <div className="space-y-4 px-4 py-4">
          <p className="text-xs leading-relaxed text-brand-text-muted">
            The requested page or resource could not be located within St. Rose Laboratory System.
          </p>
          <Link href="/dashboard" className="inline-flex rounded-md focus-visible:outline-none">
            <Button variant="primary" size="sm" tabIndex={-1}>
              Return to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
