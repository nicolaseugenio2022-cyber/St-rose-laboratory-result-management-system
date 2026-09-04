import React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

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
 * keyboard and announces a meaningful name - rather than a click-only <div>
 * with a nested button. Nothing is nested inside it that is separately
 * clickable, so the link keeps one unambiguous target.
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
        "group flex items-center gap-3.5 rounded-lg border px-4 py-3",
        // 150ms sits in the feedback band. Only the scale moves, so only the scale
        // is withdrawn under reduced motion; the colour step still answers the press.
        "transition-[color,background-color,border-color,transform] duration-150",
        "active:scale-[0.99] motion-reduce:active:scale-100",
        // Transparent offset: the page ground is #f8fafc, so a default white offset
        // ringed every focused card in a colour the page does not contain.
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
        isPrimary
          ? "border-brand-primary bg-brand-primary text-brand-primary-foreground shadow-low hover:bg-brand-primary-hover"
          : "border-brand-border bg-brand-card shadow-low hover:border-brand-border-strong hover:bg-brand-surface-hover",
        className
      )}
    >
      {Icon && (
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-md",
            isPrimary ? "bg-white/15" : "bg-brand-tint text-brand-primary"
          )}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className={cn("block text-[15px] font-semibold leading-tight tracking-tight", isPrimary ? "" : "text-brand-navy")}>
          {title}
        </span>
        {description && (
          <span
            className={cn(
              "mt-0.5 block text-[11px] leading-snug",
              isPrimary ? "opacity-90" : "text-brand-text-muted"
            )}
          >
            {description}
          </span>
        )}
      </span>
      <ArrowRight
        className={cn(
          "h-4 w-4 shrink-0 transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transform-none",
          isPrimary ? "opacity-80" : "text-brand-text-muted"
        )}
        aria-hidden="true"
      />
    </Link>
  );
}
