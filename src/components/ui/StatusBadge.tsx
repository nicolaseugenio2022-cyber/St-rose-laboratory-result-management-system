import React from "react";
import type { EvaluationOutcome, SessionStatus } from "@/domain/types";
import { cn } from "@/utils/cn";

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
 * already carry.
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
    Invalid: "border-rose-400 bg-rose-100 text-rose-900",
    Abnormal: "border-rose-300 bg-rose-100 text-rose-800",
    High: "border-rose-300 bg-rose-100 text-rose-800",
    Low: "border-amber-300 bg-amber-100 text-amber-900",
    Normal: "border-emerald-300 bg-emerald-100 text-emerald-800",
    Entered: "border-blue-200 bg-blue-50 text-blue-800",
    Informational: "border-slate-200 bg-slate-100 text-slate-500",
    NoEvaluation: "border-slate-200 bg-slate-100 text-slate-500",

    // SessionStatus
    Draft: "border-amber-300 bg-amber-100 text-amber-900",
    Completed: "border-emerald-300 bg-emerald-100 text-emerald-800",

    // Account lifecycle
    Active: "border-emerald-300 bg-emerald-100 text-emerald-800",
    Inactive: "border-slate-200 bg-slate-100 text-slate-500",
  };

  const sizes = {
    sm: "px-1.5 py-0.5 text-[10px]",
    md: "px-2 py-0.5 text-[11px]",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border font-semibold uppercase tracking-wider",
        tones[status],
        sizes[size],
        className
      )}
      {...props}
    >
      {label ?? status}
    </span>
  );
}
