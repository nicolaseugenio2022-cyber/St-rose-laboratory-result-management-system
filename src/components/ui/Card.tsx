import React from "react";
import { cn } from "@/utils/cn";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "flat" | "outline";
}

export function Card({ className, variant = "default", children, ...props }: CardProps) {
  // A Card is a surface, not a control. The default variant no longer changes on hover:
  // a static panel that reacts to the pointer reads as clickable and invites a click that
  // does nothing. A consumer with a real interactive contract adds its own hover treatment.
  const baseStyles = "rounded-lg bg-brand-card transition-colors";
  const variants = {
    default: "border border-brand-card-border",
    // --color-border-subtle and --color-surface-hover are both #f1f5f9, so this
    // border was invisible against its own fill.
    flat: "border border-brand-card-border bg-brand-surface-hover",
    outline: "border border-brand-card-border",
  };

  return (
    <div className={cn(baseStyles, variants[variant], className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col space-y-0.5 p-4 pb-2", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-sm font-semibold leading-tight tracking-tight text-brand-text", className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-xs text-brand-text-muted leading-relaxed", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4 pt-0", className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center border-t border-brand-border-subtle p-4 pt-3", className)} {...props} />;
}
