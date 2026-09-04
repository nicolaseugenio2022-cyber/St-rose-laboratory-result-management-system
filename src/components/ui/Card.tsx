import React from "react";
import { Card as RheaCard, CardContent as RheaCardContent } from "@/components/shadcn/card";
import { cn } from "@/lib/utils";

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
 *
 * The container is the Rhea card primitive with its own spacing scheme switched off:
 * Rhea pads and gaps the card itself and rounds it to 24px, which is a different panel
 * idea from the banded one above. `text-[1em]` restores plain font-size inheritance in
 * place of Rhea's `text-sm`, and `overflow-visible` keeps a popover opened inside a panel
 * from being clipped. The bands themselves are not Rhea's header/footer, whose grid and
 * `--card-spacing` padding exist for a layout this system does not use.
 */
export function Card({ className, variant = "default", children, ...props }: CardProps) {
  // shadow-sm is the low elevation step: globals.css collapses the size ramp so xs/sm and
  // the bare shadow all resolve to --shadow-low. Naming the step this way rather than
  // shadow-low is what lets shadow-none actually replace it on the flat and outline
  // variants instead of both landing on the element.
  const variants = {
    default: "bg-brand-card shadow-sm",
    flat: "bg-brand-structural shadow-none",
    outline: "bg-brand-card shadow-none",
  };

  return (
    <RheaCard
      className={cn(
        "gap-0 overflow-visible rounded-lg border border-brand-border py-0 text-[1em] text-brand-text ring-0",
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </RheaCard>
  );
}

/**
 * Structural header band. A row: the title (and description) on the left and any
 * actions on the right; it wraps on narrow screens.
 */
export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="card-header"
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
      data-slot="card-title"
      className={cn("text-[13px] font-semibold leading-tight tracking-tight text-brand-navy", className)}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      data-slot="card-description"
      className={cn("mt-0.5 text-[11px] leading-snug text-brand-text-muted", className)}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <RheaCardContent className={cn("p-4", className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-b-lg border-t border-brand-border bg-brand-structural px-4 py-2.5",
        className
      )}
      {...props}
    />
  );
}
