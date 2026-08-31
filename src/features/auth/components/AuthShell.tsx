import React from "react";
import Image from "next/image";

/**
 * The composition every unauthenticated screen sits in.
 *
 * One component because login, first-login, the three recovery stages and the account-load
 * failure were four near-identical wrappers, each centring a white card on a bare canvas.
 * Four copies of one layout is four places for it to drift.
 *
 * The three surfaces, in the order an operator meets them:
 *
 *   - **Canvas** is the cool blue-gray ground, so the screen is never mostly white.
 *   - **Identity** is a deep navy panel carrying the official mark and the laboratory name -
 *     beside the form from `lg` up, a compact strip above it below that. It is the only
 *     place identity appears, so the form surface can be entirely about the task.
 *   - **Working** is the elevated white form surface, and the only elevated thing on screen.
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
 * The official mark. Square asset (1254x1254) holding a teal disc; clipping the square to a
 * circle leaves a thin white ring around the disc, which is how it sits on navy.
 * Never cropped further, recoloured, or substituted.
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
      <div className="mx-auto flex w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-brand-border-strong shadow-low lg:flex-row lg:items-stretch">
        {/* ── Identity panel ──────────────────────────────────────────────────
            Beside the form on a desktop, a compact strip above it on a phone.
            Same navy surface either way, so the two layouts read as one design. */}
        <aside className="flex shrink-0 items-center gap-3 bg-brand-navy px-4 py-3.5 text-brand-navy-foreground lg:w-72 lg:flex-col lg:items-start lg:justify-between lg:px-7 lg:py-8">
          <div className="flex items-center gap-3 lg:flex-col lg:items-start lg:gap-5">
            <BrandMark className="h-10 w-10 shrink-0 rounded-full object-cover lg:h-16 lg:w-16" />
            <div className="min-w-0">
              <p className="text-[15px] font-bold leading-tight tracking-tight text-white lg:text-lg">
                St. Rose
              </p>
              <p className="text-xs font-medium leading-tight text-brand-navy-muted lg:mt-0.5">
                Diagnostic Laboratory
              </p>
            </div>
          </div>

          {/* Desktop only: one quiet line of context. It states what the system is, and makes no
              claim the application cannot back up. */}
          <p className="hidden text-xs leading-relaxed text-brand-navy-muted lg:block">
            Laboratory Result Management System. For authorised laboratory personnel.
          </p>
        </aside>

        {/* ── Working surface ─────────────────────────────────────────────── */}
        <main className="flex min-w-0 flex-1 flex-col bg-brand-surface px-4 py-5 sm:px-6 sm:py-6 lg:px-9 lg:py-8">
          <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center lg:max-w-md">
            <header className="mb-4">
              <h1 className="text-lg font-bold tracking-tight text-brand-navy sm:text-xl">
                {title}
              </h1>
              {description && (
                <p className="mt-1 text-xs leading-relaxed text-brand-text-muted sm:text-[13px]">
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
