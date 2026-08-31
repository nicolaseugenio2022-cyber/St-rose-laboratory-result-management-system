import React from "react";
import { cn } from "@/utils/cn";

export interface DashboardSectionProps {
  title: string;
  description?: string;
  /** Optional lucide icon, drawn small beside the title as the region's mark. */
  icon?: React.ComponentType<{ className?: string }>;
  /** Optional right-aligned control, e.g. a "view all" link. */
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /**
   * panel - a white working surface with a structural header band; the children are the
   *         panel body and must not draw their own outer border.
   * bare  - a titled region with no surface of its own, for content that is already a
   *         surface (a single action card).
   */
  variant?: "panel" | "bare";
}

/**
 * Titled dashboard region.
 *
 * Uses a real <section> with an accessible name so the dashboard has a
 * navigable outline: the shell Header provides the page-level h1, and every
 * dashboard region heading is an <h2>. Composition-agnostic - Administrator,
 * Laboratory User and Developer all compose from this rather than each
 * inventing a section shell.
 *
 * The panel variant is the system's grouping unit: one surface, one band, and the
 * rows, tiles or lists inside it are grouped by hairlines and tints rather than by
 * a second card. The icon is decorative - the title carries the meaning.
 */
export function DashboardSection({
  title,
  description,
  icon: Icon,
  action,
  children,
  className,
  variant = "panel",
}: DashboardSectionProps) {
  const headingId = React.useId();
  const descriptionId = `${headingId}-description`;
  const isPanel = variant === "panel";

  return (
    <section
      aria-labelledby={headingId}
      // The qualifier ("Newest first", "From your recent sessions") changes what the
      // region means, so it is bound to the region rather than left as loose text.
      aria-describedby={description ? descriptionId : undefined}
      className={cn(
        isPanel
          ? "overflow-hidden rounded-lg border border-brand-border bg-brand-card shadow-low"
          : "space-y-2",
        className
      )}
    >
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-x-4 gap-y-1",
          isPanel
            ? "border-b border-brand-border bg-brand-structural px-4 py-2.5"
            : "border-b border-brand-border-strong pb-1.5"
        )}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          {Icon && (
            <span
              aria-hidden="true"
              className={cn(
                "flex shrink-0 items-center justify-center rounded-md text-brand-primary",
                isPanel ? "h-7 w-7 border border-brand-border bg-brand-surface" : "h-6 w-6 bg-brand-tint"
              )}
            >
              <Icon className="h-4 w-4" />
            </span>
          )}
          <div className="min-w-0">
            <h2 id={headingId} className="text-[13px] font-semibold leading-tight tracking-tight text-brand-navy">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-0.5 min-w-0 text-[11px] leading-snug text-brand-text-muted">
                {description}
              </p>
            )}
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
