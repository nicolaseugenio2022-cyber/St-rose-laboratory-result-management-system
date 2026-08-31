import React from "react";
import { cn } from "@/utils/cn";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * default - a working surface: white, bordered, low shadow.
   * flat    - a structural grouping tint with no shadow; for a region inside a surface.
   * outline - white and bordered with no shadow; for a surface nested in another surface.
   */
  variant?: "default" | "flat" | "outline";
}

/**
 * A panel, not a decoration.
 *
 * The panel is the unit of section grouping: one white working surface with an optional
 * structural header band (CardHeader) and an optional structural footer band (CardFooter).
 * Content inside a panel is grouped by bands, hairlines and tints - never by another card,
 * so a card inside a card cannot be reached through this API by accident.
 *
 * A Card is a surface, not a control: it never reacts to hover. A consumer with a real
 * interactive contract adds its own treatment.
 */
export function Card({ className, variant = "default", children, ...props }: CardProps) {
  const baseStyles = "rounded-lg border border-brand-border";
  const variants = {
    default: "bg-brand-card shadow-low",
    flat: "bg-brand-structural",
    outline: "bg-brand-card",
  };

  return (
    <div className={cn(baseStyles, variants[variant], className)} {...props}>
      {children}
    </div>
  );
}

/**
 * Structural header band. A row: the title (and description) on the left and any
 * actions on the right; it wraps on narrow screens.
 */
export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 rounded-t-lg border-b border-brand-border bg-brand-structural px-4 py-2.5",
        className
      )}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("text-[13px] font-semibold leading-tight tracking-tight text-brand-navy", className)}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("mt-0.5 text-[11px] leading-snug text-brand-text-muted", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4", className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-b-lg border-t border-brand-border bg-brand-structural px-4 py-2.5",
        className
      )}
      {...props}
    />
  );
}
