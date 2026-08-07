import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-brand-background p-4 text-center">
      <div className="max-w-md space-y-4 rounded-xl border border-brand-border bg-brand-surface p-8 shadow-xs">
        <h2 className="text-2xl font-bold text-brand-text">404 — Page Not Found</h2>
        <p className="text-xs text-brand-text-muted">
          The requested page or resource could not be located within St. Rose Laboratory System.
        </p>
        <div className="pt-2">
          <Link href="/dashboard">
            <Button variant="primary" size="sm">
              Return to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
