import React, { forwardRef } from "react";
import { Loader2 } from "lucide-react";

import { Button as RheaButton } from "@/components/shadcn/button";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger" | "success" | "warning";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

/**
 * The one button - the application-facing contract over the shadcn Rhea primitive.
 *
 * The public API is unchanged, so no consumer needs an edit: five application variants,
 * three sizes, isLoading, a forwarded ref and every native button prop. What changed is
 * the rendering underneath. `@/components/shadcn/button` is the generated Rhea primitive
 * and supplies the fill, radius, press feedback, transition and icon sizing, the Rhea focus
 * rule in globals.css supplies the keyboard focus indicator, and the shadcn
 * semantic tokens in globals.css point those at the St. Rose palette.
 *
 * Hierarchy is still carried by fill, not by size: teal is the primary action, navy the
 * secondary one, outline the reversible alternative, ghost the quiet utility, danger the
 * destructive one - Rhea's tinted destructive rather than a solid red block.
 *
 * CLIENT-QA-04 adds `success` and `warning` on exactly the shape `danger` already established:
 * a soft tinted surface carrying its own meaning at rest, not a transparent control that only
 * acquires colour on hover. The status toggles in the four directories painted a ghost button
 * with the very hover classes these variants now own, so the same intent was restated at four
 * call sites and read as plain text until the pointer arrived. They map onto the Rhea `ghost`
 * base because Rhea has no success or warning fill of its own; the base contributes geometry,
 * radius, focus, press and disabled behaviour, and VARIANT_STATES supplies the rest of the
 * appearance from existing brand tokens.
 */
const RHEA_VARIANT = {
  primary: "default",
  secondary: "secondary",
  outline: "outline",
  ghost: "ghost",
  danger: "destructive",
  success: "ghost",
  warning: "ghost",
} as const;

/**
 * Where Rhea's states were tuned for a near-black primary on white, the St. Rose fills
 * need their established state colours. Every value here is an existing application
 * token, and each entry replaces exactly one Rhea state class:
 * - primary: Rhea lightens to 80% on hover, which leaves white text at 4.3:1 on teal;
 *   the application deepens instead, as it always has.
 * - secondary: the shadcn `secondary` token is the quiet structural fill the registry
 *   expects, so the navy fill of the application's secondary action lives here.
 * - outline / ghost: Rhea hovers to the muted fill, which is the same structural tint
 *   as the table-header and filter bands these buttons sit on; the hover step is the
 *   established structural-hover so it reads on both surfaces.
 * - danger: Rhea's tinted destructive fill, plus the resting border its neighbours now carry.
 *   Nothing about the red is softened - the fill, the foreground and the hover step are Rhea's
 *   untouched. Only the edge is added, because once Activate and Deactivate drew one an action
 *   group read as two bordered controls and one borderless red patch. The border is the
 *   destructive colour at low alpha, so it states the same meaning the fill already states.
 * - success / warning: the established `-bg` tint at rest, the established foreground, and the
 *   established `-border` token drawn as a real border in the same hue. The tint alone sat at
 *   about 4% luminance from a white row, which stated the meaning but drew no edge; the border
 *   is what makes the control read as a control at rest. Hover fills to that same border tone,
 *   so the button closes into one soft chip rather than switching to a structural grey.
 */
const VARIANT_STATES = {
  primary: "hover:bg-brand-primary-hover",
  secondary: "bg-brand-navy text-brand-navy-foreground hover:bg-brand-navy-hover",
  outline: "hover:bg-brand-structural-hover",
  ghost: "hover:bg-brand-structural-hover",
  danger: "border-destructive/25 hover:border-destructive/35",
  success:
    "border-brand-success-border bg-brand-success-bg text-brand-success hover:bg-brand-success-border hover:text-brand-success",
  warning:
    "border-brand-warning-border bg-brand-warning-bg text-brand-warning hover:bg-brand-warning-border hover:text-brand-warning",
} as const;

const RHEA_SIZE = {
  sm: "sm",
  md: "default",
  lg: "lg",
} as const;

/**
 * Rhea's own heights are 28 / 32 / 36. The application keeps its established 32 / 36 / 44
 * so a control still lines up with the 36px field beside it on a desktop and still reaches
 * a 44px target where it must; the field primitives migrate in a later slice and the heights
 * are revisited with them. Each entry overrides only the height, gap, padding and type size
 * of the Rhea size it extends - everything else is Rhea's.
 */
const SIZE_GEOMETRY = {
  sm: "h-8 gap-1.5 px-3 text-xs",
  md: "h-9 gap-2 px-3.5 text-[13px]",
  lg: "h-11 gap-2.5 px-5 text-sm",
} as const;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", isLoading = false, disabled, children, ...props }, ref) => {
    return (
      <RheaButton
        ref={ref}
        variant={RHEA_VARIANT[variant]}
        size={RHEA_SIZE[size]}
        disabled={disabled || isLoading}
        aria-busy={isLoading || undefined}
        className={cn(VARIANT_STATES[variant], SIZE_GEOMETRY[size], className)}
        {...props}
      >
        {/* The label survives the pending state. Replacing children with "Loading..."
            discarded the only thing that said WHICH action was running, changed the
            accessible name mid-submit, and jumped the width -- reflowing the dialog
            footer it sits in. aria-busy carries the state instead; the primitive sizes
            the spinner to its icon slot. */}
        {isLoading && <Loader2 aria-hidden="true" className="animate-spin" />}
        {children}
      </RheaButton>
    );
  }
);

Button.displayName = "Button";
