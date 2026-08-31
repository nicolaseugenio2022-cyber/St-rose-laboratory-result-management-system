import React from "react";
import { cn } from "@/utils/cn";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "success" | "warning" | "neutral" | "indigo" | "purple" | "blue" | "danger" | "navy";
  size?: "sm" | "md";
}

/**
 * Short categorical label.
 *
 * Square-cornered like StatusBadge, so the system has one badge shape, and ringed
 * rather than bordered so a size="sm" Badge and a size="sm" StatusBadge are the same
 * height. `navy` is the identity chip - a role label beside a username, never a status.
 */
export function Badge({ className, variant = "neutral", size = "md", children, ...props }: BadgeProps) {
  const baseStyles =
    "inline-flex items-center whitespace-nowrap rounded-md font-semibold ring-1 ring-inset transition-colors";

  const variants = {
    success: "bg-brand-success-bg text-brand-success ring-brand-success-border",
    warning: "bg-brand-warning-bg text-brand-warning ring-brand-warning-border",
    danger: "bg-brand-danger-bg text-brand-danger ring-brand-danger-border",
    indigo: "bg-indigo-50 text-indigo-700 ring-indigo-200",
    purple: "bg-indigo-50 text-indigo-700 ring-indigo-200",
    blue: "bg-brand-info-bg text-brand-info ring-brand-info-border",
    neutral: "bg-brand-structural text-brand-text-muted ring-brand-border",
    navy: "bg-brand-navy text-brand-navy-foreground ring-brand-navy",
  };

  const sizes = {
    sm: "px-1.5 py-0.5 text-[10px]",
    md: "px-2 py-0.5 text-[11px]",
  };

  return (
    <span className={cn(baseStyles, variants[variant], sizes[size], className)} {...props}>
      {children}
    </span>
  );
}
