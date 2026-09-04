import React from "react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  /** Optional lucide icon component. Rendered small and muted, never as an illustration. */
  icon?: React.ComponentType<{ className?: string }>;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Optional single next action. */
  action?: React.ReactNode;
  /** Heading level, so the state slots into the surrounding document outline. */
  headingLevel?: 2 | 3 | 4;
}

/**
 * Compact operational empty state.
 *
 * A structural-tint panel, so an empty region reads as a quiet part of the page rather
 * than a blank white hole: a muted icon on a white disc, a real heading, one line of
 * guidance and at most one action. No illustration, no tall card.
 *
 * Distinguish the cases in the copy: nothing exists yet, nothing matches the current
 * filter, and a load error are three different messages.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  headingLevel = 3,
  className,
  ...props
}: EmptyStateProps) {
  const Heading = `h${headingLevel}` as "h2" | "h3" | "h4";

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-1 rounded-lg border border-brand-border bg-brand-structural px-6 py-7 text-center",
        className
      )}
      {...props}
    >
      {Icon && (
        <span className="mb-1.5 flex h-9 w-9 items-center justify-center rounded-full border border-brand-border bg-brand-surface">
          <Icon className="h-4 w-4 text-brand-text-muted" aria-hidden="true" />
        </span>
      )}
      <Heading className="text-[13px] font-semibold text-brand-navy">{title}</Heading>
      {description && (
        <p className="max-w-sm text-xs leading-relaxed text-brand-text-muted">{description}</p>
      )}
      {action && <div className="mt-2.5">{action}</div>}
    </div>
  );
}
