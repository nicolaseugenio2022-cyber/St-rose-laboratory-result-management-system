import React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The stage rail shared by the two multi-step authentication flows.
 *
 * Recovery and first-login are both server-enforced sequences, and each had grown its own
 * indicator - a three-column rule with numerals in one, a two-column trail with "Step 1" /
 * "Step 2" ordinals and visible "Done / Current step / Not started" captions in the other.
 * Two designs for one idea is what made the unauthenticated screens read as three products.
 * This is that one idea, rendered once.
 *
 * It is presentation for an order the route guards already enforce. It defines no step, adds
 * none, and reorders none.
 *
 * **State is never carried by colour alone.** A filled segment is teal, but a completed step
 * also swaps in a check glyph, the current step is the only one set in navy semibold, and every
 * step carries a screen-reader word alongside `aria-current="step"` on the active one. The
 * polite live region restates position when the stage advances, because a heading that changes
 * silently is not an announcement - and it restates only on change, so it does not chatter.
 */
export interface AuthStepsProps {
  /** Accessible name for the sequence, e.g. "Password recovery progress". */
  label: string;
  /** One label per step, in the order the guards enforce. */
  steps: readonly string[];
  /** Zero-based index of the step currently on screen. */
  currentIndex: number;
}

export function AuthSteps({ label, steps, currentIndex }: AuthStepsProps) {
  const current = steps[currentIndex];

  return (
    <nav aria-label={label}>
      {/* The visible counter is aria-hidden and the announcement is a separate polite region:
          read together they would say the position twice. */}
      <p
        aria-hidden="true"
        className="text-[11px] font-semibold tabular-nums text-brand-text-muted"
      >
        Step {currentIndex + 1} of {steps.length}
      </p>
      <p role="status" className="sr-only">
        Step {currentIndex + 1} of {steps.length}: {current}.
      </p>

      {/* Equal flexible columns rather than a fixed grid, so the same component serves a
          two-step and a three-step sequence and a label wraps inside its own column instead
          of widening the rail. */}
      <ol className="mt-2 flex gap-2">
        {steps.map((step, index) => {
          const isDone = index < currentIndex;
          const isCurrent = index === currentIndex;

          return (
            <li
              key={step}
              aria-current={isCurrent ? "step" : undefined}
              className="min-w-0 flex-1"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "block h-[3px] rounded-full",
                  isDone || isCurrent ? "bg-brand-primary" : "bg-brand-border"
                )}
              />
              <span
                className={cn(
                  "mt-1.5 flex items-start gap-1 text-[11px] leading-tight",
                  isCurrent ? "font-semibold text-brand-navy" : "font-medium text-brand-text-muted"
                )}
              >
                {isDone && (
                  <Check aria-hidden="true" className="mt-px h-3 w-3 shrink-0 text-brand-primary" />
                )}
                <span className="min-w-0">{step}</span>
              </span>
              <span className="sr-only">
                {isDone ? "Completed" : isCurrent ? "Current step" : "Not started"}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
