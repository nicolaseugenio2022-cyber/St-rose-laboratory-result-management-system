import React from "react";
import Image from "next/image";

/**
 * The composition every unauthenticated screen sits in.
 *
 * One component because login, first-login, the three recovery stages and the account-load
 * failure were four near-identical `min-h-screen flex items-center justify-center` wrappers,
 * each centring a white card on a bare canvas. Four copies of one layout is four places for it
 * to drift, and the result read as a generic form page rather than as this system's front door.
 *
 * The shape is deliberately plain:
 *
 *   - **Canvas** carries the brand tint, so the screen is not mostly white before anything loads.
 *   - **Structural** is the identity panel - shown beside the form from `lg` up, and collapsing
 *     to a compact header strip below it. It is the only place the mark and the laboratory name
 *     appear, so the form surface can be entirely about the task.
 *   - **Working** is the elevated form surface, and it is the only elevated thing on screen.
 *
 * No gradient, no imagery beyond the official mark, no glass, no marketing heading. An operator
 * signing in at the start of a shift needs to find one field and one button.
 */
export interface AuthShellProps {
  /** The task, e.g. "Sign in" or "Reset your password". Rendered as the form surface's heading. */
  title: string;
  /** One line. Says what this screen is for, never what the product is. */
  description?: string;
  /** Optional slot above the fields - a stage indicator, a status alert. */
  banner?: React.ReactNode;
  children: React.ReactNode;
  /** Optional footer inside the form surface, e.g. "Back to login". */
  footer?: React.ReactNode;
}

/**
 * The official mark. Square asset (1254x1254), so a square box preserves its ratio exactly.
 * Never cropped, recoloured, or substituted.
 */
function BrandMark({ className }: { className?: string }) {
  return (
    <Image
      src="/st-rose-logo-official.png"
      alt=""
      width={128}
      height={128}
      className={className}
      priority
    />
  );
}

export function AuthShell({ title, description, banner, children, footer }: AuthShellProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-canvas px-4 py-6 sm:px-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-0 lg:flex-row lg:items-stretch">
        {/* ── Identity panel ──────────────────────────────────────────────────
            Beside the form on a desktop, a compact strip above it on a phone.
            Same surface either way, so the two layouts read as one design. */}
        <aside
          className="flex shrink-0 items-center gap-3 rounded-t-xl border border-b-0 border-brand-border bg-brand-structural px-4 py-3.5 lg:w-72 lg:flex-col lg:items-start lg:justify-between lg:rounded-l-xl lg:rounded-tr-none lg:border-b lg:border-r-0 lg:px-6 lg:py-8"
        >
          <div className="flex items-center gap-3 lg:flex-col lg:items-start lg:gap-5">
            <BrandMark className="h-10 w-10 shrink-0 object-contain lg:h-16 lg:w-16" />
            <div className="min-w-0">
              <p className="text-sm font-bold leading-tight tracking-tight text-brand-text lg:text-lg">
                St. Rose
              </p>
              <p className="text-xs font-medium leading-tight text-brand-text-muted lg:mt-0.5">
                Diagnostic Laboratory
              </p>
            </div>
          </div>

          {/* Desktop only: one quiet line of context. It states what the system is, and makes no
              claim the application cannot back up. */}
          <p className="hidden text-xs leading-relaxed text-brand-text-muted lg:block">
            Laboratory Result Management System. For authorised laboratory personnel.
          </p>
        </aside>

        {/* ── Working surface ─────────────────────────────────────────────── */}
        <main className="flex min-w-0 flex-1 flex-col rounded-b-xl border border-brand-border bg-brand-surface px-4 py-5 shadow-low sm:px-6 sm:py-6 lg:rounded-l-none lg:rounded-r-xl lg:px-8 lg:py-8">
          <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center lg:max-w-md">
            <header className="mb-4">
              <h1 className="text-lg font-bold tracking-tight text-brand-text sm:text-xl">
                {title}
              </h1>
              {description && (
                <p className="mt-1 text-xs leading-relaxed text-brand-text-muted sm:text-sm">
                  {description}
                </p>
              )}
            </header>

            {banner && <div className="mb-4">{banner}</div>}

            {children}

            {footer && (
              <div className="mt-5 border-t border-brand-border-subtle pt-4">{footer}</div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
