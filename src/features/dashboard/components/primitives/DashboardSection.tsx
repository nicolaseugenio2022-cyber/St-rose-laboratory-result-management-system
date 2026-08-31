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
 * navigable outline: the shell Header provides the page-level h1, and every
 * dashboard region heading is an <h2>. Composition-agnostic - Administrator,
 * Laboratory User and Developer all compose from this rather than each
 * inventing a section shell.
 *
 * The region is divider-led rather than boxed. A card here would mean every
 * list inside it became a card inside a card.
 */
export function DashboardSection({
  title,
  description,
  action,
  children,
  className,
}: DashboardSectionProps) {
  const headingId = React.useId();
  const descriptionId = `${headingId}-description`;
  return (
    <section
      aria-labelledby={headingId}
      // The qualifier ("Newest first", "From your recent sessions") changes what the
      // region means, so it is bound to the region rather than left as loose text.
      aria-describedby={description ? descriptionId : undefined}
      className={cn("space-y-2.5", className)}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-brand-border-subtle pb-1.5">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
          <h2 id={headingId} className="text-xs font-semibold uppercase tracking-wide text-brand-text">
            {title}
          </h2>
          {description && (
            <p id={descriptionId} className="min-w-0 text-[11px] text-brand-text-muted">{description}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
