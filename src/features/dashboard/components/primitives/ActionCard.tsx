import React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/utils/cn";

export interface ActionCardProps {
  title: string;
  description?: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
  /** Emphasised treatment for the one action the role most likely needs next. */
  emphasis?: "primary" | "default";
  className?: string;
}

/**
 * A single next action.
 *
 * The whole card is one real <Link>, so it is reachable and activatable by
 * keyboard and announces a meaningful name — rather than a click-only <div>
 * with a nested button, which is the pattern this replaces.
 */
export function ActionCard({
  title,
  description,
  href,
  icon: Icon,
  emphasis = "default",
  className,
}: ActionCardProps) {
  const isPrimary = emphasis === "primary";
  return (
    <Link
      href={href}
      className={cn(
        "group flex items-start gap-3 rounded-lg border px-4 py-3.5 transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring focus-visible:ring-offset-2",
        isPrimary
          ? "border-brand-primary bg-brand-primary text-brand-primary-foreground hover:bg-brand-primary-hover"
          : "border-brand-card-border bg-brand-card hover:border-slate-300 hover:bg-brand-surface-hover",
        className
      )}
    >
      {Icon && (
        <span
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
            isPrimary ? "bg-white/15" : "bg-brand-tint text-brand-primary"
          )}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className={cn("block text-xs font-bold", isPrimary ? "" : "text-brand-text")}>
          {title}
        </span>
        {description && (
          <span
            className={cn(
              "mt-0.5 block text-xs leading-relaxed",
              isPrimary ? "opacity-90" : "text-brand-text-muted"
            )}
          >
            {description}
          </span>
        )}
      </span>
      <ArrowRight
        className={cn(
          "mt-0.5 h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5",
          isPrimary ? "" : "text-brand-text-subtle"
        )}
        aria-hidden="true"
      />
    </Link>
  );
}
