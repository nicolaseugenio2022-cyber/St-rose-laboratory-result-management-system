import React from "react";
import { cn } from "@/utils/cn";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "success" | "warning" | "neutral" | "indigo" | "purple" | "blue" | "danger";
  size?: "sm" | "md";
}

export function Badge({ className, variant = "neutral", size = "md", children, ...props }: BadgeProps) {
  const baseStyles = "inline-flex items-center font-semibold rounded-full transition-colors duration-150";

  const variants = {
    success: "bg-brand-success-bg text-brand-success border border-brand-success-border",
    warning: "bg-brand-warning-bg text-brand-warning border border-brand-warning-border",
    danger: "bg-brand-danger-bg text-brand-danger border border-brand-danger-border",
    indigo: "bg-indigo-50 text-indigo-700 border border-indigo-200",
    purple: "bg-indigo-50 text-indigo-700 border border-indigo-200",
    blue: "bg-brand-info-bg text-brand-info border border-brand-info-border",
    neutral: "bg-slate-100 text-slate-700 border border-slate-200",
  };

  const sizes = {
    sm: "px-2 py-0.5 text-[11px]",
    md: "px-2.5 py-0.5 text-xs",
  };

  return (
    <span className={cn(baseStyles, variants[variant], sizes[size], className)} {...props}>
      {children}
    </span>
  );
}
