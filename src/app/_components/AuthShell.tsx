import React from "react";
import Image from "next/image";

/**
 * The composition every unauthenticated screen sits in.
 *
 * One component because login, first-login and the three recovery stages would otherwise be
 * five near-identical wrappers - five places for one layout to drift, and five places the
 * official mark could be treated differently.
 *
 * **The letterhead.** Every artifact this laboratory produces is a headed sheet: the official
 * mark set at the content margin, the laboratory identity beside it, a divider rule, then the
 * content (`src/rendering/native/theme.ts` - `logoXmm: 15` flush with the 15 mm page margin,
 * `dividerYmm: 23.5`, `contentStartYmm: 26.5`). These screens are that same sheet. Signing in
 * should feel like picking up the laboratory's own form, not visiting a product's login page,
 * so the structure is borrowed from the report rather than from an authentication template.
 *
 * What that rules out, deliberately: the tall brand panel beside the form (a wide dark column
 * holding three lines of text, which is the split-card tell and carried no information), a
 * second surface inside the sheet, gradients, imagery beyond the official mark, and any
 * marketing heading. An operator signing in at the start of a shift needs to find one field
 * and one button.
 *
 * Three surfaces, and only three:
 *   - **Canvas** - the cool blue-gray ground the sheet sits on.
 *   - **Surface** - the white sheet. The only white and the only elevated thing on screen.
 *   - **Structural** - the footer strip, which is chrome rather than task.
 *
 * Everything is left-aligned. A clinical form is left-aligned; a centred heading over centred
 * fields is a marketing composition.
 */
export interface AuthShellProps {
  /** The task, e.g. "Sign in" or "Reset your password". Rendered as the sheet's heading. */
  title: string;
  /** One line. Says what this screen is for, never what the product is. */
  description?: string;
  /**
   * Optional stage rail, rendered above the heading.
   *
   * Above, because it answers "where am I" and the heading then names the step. Recovery and
   * first-login both fill it from the same `AuthSteps` component, which is what makes the two
   * multi-step flows read as one sequence rather than two designs.
   */
  steps?: React.ReactNode;
  children: React.ReactNode;
  /** Optional footer strip at the foot of the sheet, e.g. "Back to login". */
  footer?: React.ReactNode;
  /**
   * The standing "For authorised laboratory personnel." notice beneath the sheet.
   *
   * On by default, because every screen that reaches this shell unauthenticated is a door.
   * `AccountLoadError` renders this same shell from inside the two authenticated layouts,
   * where an admission notice would be addressed to someone who is already admitted - so that
   * one surface turns it off.
   */
  showAccessNotice?: boolean;
}

/**
 * The official mark. Square asset (1254x1254) holding a teal disc on a near-white ground;
 * clipping the square to a circle drops that ground, which is why the sheet's head is white
 * rather than tinted - the mark then sits on its own colour with no visible seam.
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

export function AuthShell({
  title,
  description,
  steps,
  children,
  footer,
  showAccessNotice = true,
}: AuthShellProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-brand-canvas px-4 py-8 sm:px-6">
      <div className="w-full max-w-[27rem]">
        <div className="overflow-hidden rounded-lg border border-brand-border-strong bg-brand-surface shadow-low">
          {/* ── Letterhead ──────────────────────────────────────────────────
              The mark, the laboratory, and what this system is - the same three things the
              printed report heads every page with. The mark already contains the wordmark,
              so the lines beside it do a different job: who this is, then which system. */}
          <header className="px-5 pt-5 sm:px-7 sm:pt-6">
            <div className="flex items-center gap-3.5">
              <BrandMark className="h-12 w-12 shrink-0 rounded-full object-cover sm:h-14 sm:w-14" />
              <div className="min-w-0">
                <p className="text-[15px] font-bold leading-tight tracking-tight text-brand-navy">
                  St. Rose Diagnostic Laboratory
                </p>
                <p className="mt-1 text-[11px] font-medium leading-tight text-brand-text-muted">
                  Laboratory Result Management System
                </p>
              </div>
            </div>

            {/* The letterhead rule: a hairline across the content width, carrying one short
                teal segment at the margin. It is the only accent on the sheet that is not a
                control, and it sits where the report's divider sits. */}
            <div aria-hidden="true" className="mt-4 flex items-end">
              <span className="h-0.5 w-10 shrink-0 rounded-full bg-brand-primary" />
              <span className="h-px flex-1 bg-brand-border" />
            </div>
          </header>

          <main className="px-5 pb-6 pt-5 sm:px-7">
            {steps && <div className="mb-5">{steps}</div>}

            <h1 className="text-[22px] font-bold leading-tight tracking-tight text-brand-navy sm:text-2xl">
              {title}
            </h1>
            {description && (
              <p className="mt-1.5 text-[13px] leading-relaxed text-brand-text-muted">
                {description}
              </p>
            )}

            <div className="mt-5">{children}</div>
          </main>

          {footer && (
            <div className="border-t border-brand-border bg-brand-structural px-5 py-2.5 sm:px-7">
              {footer}
            </div>
          )}
        </div>

        {/* The standing notice, at the foot of the form rather than inside it - the same place
            a paper requisition carries one. Aligned to the sheet's left edge, not centred. */}
        {showAccessNotice && (
          <p className="mt-4 px-1 text-[11px] leading-relaxed text-brand-text-muted">
            For authorised laboratory personnel.
          </p>
        )}
      </div>
    </div>
  );
}
