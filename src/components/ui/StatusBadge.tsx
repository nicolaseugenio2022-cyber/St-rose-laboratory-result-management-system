import React from "react";
import type { EvaluationOutcome, SessionStatus } from "@/domain/types";
import { Badge as RheaBadge } from "@/components/shadcn/badge";
import { badgeShapeClassName } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

/** Account lifecycle state, as already used by the Users and Personnel screens. */
export type AccountStatus = "Active" | "Inactive";

export type StatusBadgeStatus = EvaluationOutcome | SessionStatus | AccountStatus;

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: StatusBadgeStatus;
  /** Override the visible text. The domain term is the default and should normally stand. */
  label?: string;
  size?: "sm" | "md";
}

/**
 * Shared status badge for the existing domain vocabularies.
 *
 * Domain terminology is authoritative and is NOT restyled into new language:
 * `EvaluationOutcome` (Low, Normal, High, Entered, Abnormal, Informational,
 * NoEvaluation, Invalid), `SessionStatus` (Draft, Completed) and account state
 * (Active, Inactive) are rendered under their own names.
 *
 * The clinical tints below reproduce the mapping already established by
 * `ParameterRow`'s outcome column — Invalid strongest, Abnormal/High rose, Low
 * amber, Normal emerald, Entered blue, unevaluated slate. This component exists
 * to stop that mapping being retyped per screen; it does not introduce a new
 * one, and no status is assigned a colour implying clinical meaning it did not
 * already carry. The Rhea primitive underneath supplies shape and layout only:
 * it contributes no colour to a clinical status.
 *
 * Colour is never the sole signal — the status word itself is the label.
 *
 * Typing against the domain unions is deliberate: if `EvaluationOutcome` or
 * `SessionStatus` ever changes, this fails to compile rather than silently
 * rendering an unstyled status.
 */
export function StatusBadge({ status, label, size = "md", className, ...props }: StatusBadgeProps) {
  const tones: Record<StatusBadgeStatus, string> = {
    // EvaluationOutcome — mirrors ParameterRow's existing semantics
    // A light surface with a 1px inset ring, and Invalid alone solid, matching the
    // worksheet exactly: Invalid is the only outcome that blocks completion.
    Invalid: "bg-rose-600 text-white ring-rose-600",
    Abnormal: "bg-rose-50 text-rose-800 ring-rose-300",
    High: "bg-rose-50 text-rose-800 ring-rose-300",
    Low: "bg-amber-50 text-amber-900 ring-amber-300",
    Normal: "bg-emerald-50 text-emerald-800 ring-emerald-300",
    Entered: "bg-blue-50 text-blue-800 ring-blue-300",
    Informational: "bg-slate-50 text-slate-600 ring-slate-300",
    NoEvaluation: "bg-slate-50 text-slate-600 ring-slate-300",

    // SessionStatus
    Draft: "bg-amber-50 text-amber-900 ring-amber-300",
    Completed: "bg-emerald-50 text-emerald-800 ring-emerald-300",

    // Account lifecycle
    Active: "bg-emerald-50 text-emerald-800 ring-emerald-300",
    Inactive: "bg-slate-50 text-slate-600 ring-slate-300",
  };

  const sizes = {
    sm: "px-1.5 py-0.5 text-[10px]",
    md: "px-2 py-0.5 text-[11px]",
  };

  return (
    <RheaBadge
      className={cn(
        badgeShapeClassName,
        "uppercase tracking-wide",
        tones[status],
        sizes[size],
        className
      )}
      {...props}
    >
      {label ?? status}
    </RheaBadge>
  );
}
