import React from "react";
import { cn } from "@/utils/cn";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "success" | "warning" | "neutral" | "indigo" | "purple" | "blue" | "danger";
  size?: "sm" | "md";
}

export function Badge({ className, variant = "neutral", size = "md", children, ...props }: BadgeProps) {
  // Square-cornered like StatusBadge, so the system has one badge shape. A pill is reserved
  // for shapes that mean "bounded selector", not applied to every short label.
  // An inset ring rather than a border, matching StatusBadge and the dashboard
  // pills: a border adds 2px to the box, so a size="sm" Badge and a size="sm"
  // StatusBadge were different heights despite identical padding and type.
  const baseStyles =
    "inline-flex items-center whitespace-nowrap rounded-md font-semibold ring-1 ring-inset transition-colors";

  const variants = {
    success: "bg-brand-success-bg text-brand-success ring-brand-success-border",
    warning: "bg-brand-warning-bg text-brand-warning ring-brand-warning-border",
    danger: "bg-brand-danger-bg text-brand-danger ring-brand-danger-border",
    indigo: "bg-indigo-50 text-indigo-700 ring-indigo-200",
    purple: "bg-indigo-50 text-indigo-700 ring-indigo-200",
    blue: "bg-brand-info-bg text-brand-info ring-brand-info-border",
    neutral: "bg-slate-100 text-slate-700 ring-slate-200",
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
