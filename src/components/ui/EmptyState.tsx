import React from "react";
import { cn } from "@/utils/cn";

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
 * Deliberately small: a muted icon, a real heading, one line of guidance and at
 * most one action. No large illustration and no tall blank card — an empty
 * table should not push the rest of the screen off the viewport.
 *
 * Distinguish the cases in the copy: nothing exists yet, nothing matches the
 * current filter, and a load error are three different messages.
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
        "flex flex-col items-center justify-center gap-1.5 px-6 py-8 text-center",
        className
      )}
      {...props}
    >
      {Icon && <Icon className="h-6 w-6 text-brand-text-subtle" aria-hidden="true" />}
      <Heading className="text-sm font-semibold text-brand-text">{title}</Heading>
      {description && (
        <p className="max-w-sm text-xs leading-relaxed text-brand-text-muted">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
