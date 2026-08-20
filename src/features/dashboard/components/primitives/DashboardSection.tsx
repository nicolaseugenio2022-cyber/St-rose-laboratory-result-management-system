import React from "react";
import { cn } from "@/utils/cn";

export interface DashboardSectionProps {
  title: string;
  description?: string;
  /** Optional right-aligned control, e.g. a "view all" link. */
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/**
 * Titled dashboard region.
 *
 * Uses a real <section> with an accessible name so the dashboard has a
 * navigable outline: the page heading is the banner's <h1>, each section is an
 * <h2>. Composition-agnostic — Administrator, Laboratory User and Developer
 * all compose from this rather than each inventing a section shell.
 */
export function DashboardSection({
  title,
  description,
  action,
  children,
  className,
}: DashboardSectionProps) {
  const headingId = React.useId();
  return (
    <section aria-labelledby={headingId} className={cn("space-y-3", className)}>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 id={headingId} className="text-sm font-bold tracking-tight text-brand-text">
            {title}
          </h2>
          {description && (
            <p className="mt-0.5 text-xs text-brand-text-muted">{description}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
