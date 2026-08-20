import React from "react";
import type { EvaluationOutcome, PatientSex } from "@/domain/types";
import type { ParameterSpec } from "@/domain/types/report-definition";
import { resolveReferenceDisplay } from "@/domain/reference-display";
import { cn } from "@/utils/cn";
import { displayUnit } from "../../encoding/evaluate-encoding-result";

export interface ParameterRowProps {
  parameter: ParameterSpec;
  isSelected: boolean;
  patientSex?: PatientSex | null;
  outcome?: EvaluationOutcome;
  onToggleSelect: (selected: boolean) => void;
  children: React.ReactNode;
  labelAdornment?: React.ReactNode;
  labelHelp?: React.ReactNode;
  validationMessage?: string;
  validationMessageId?: string;
}

export function ParameterRow({
  parameter,
  isSelected,
  patientSex,
  outcome = "NoEvaluation",
  onToggleSelect,
  children,
  labelAdornment,
  labelHelp,
  validationMessage,
  validationMessageId,
}: ParameterRowProps) {
  const renderedUnit = displayUnit(parameter);
  const reference = resolveReferenceDisplay(parameter.referenceRule, patientSex, renderedUnit);
  const status = outcome === "NoEvaluation" ? "Pending" : outcome;

  return (
    <div
      data-parameter-row
      className={cn(
        "grid grid-cols-1 gap-2 rounded-lg border px-2.5 py-1 text-xs transition-all duration-150 sm:grid-cols-[minmax(210px,1fr)_minmax(150px,180px)_minmax(45px,auto)_minmax(70px,auto)] sm:items-center xl:grid-cols-[minmax(260px,1fr)_minmax(200px,280px)_minmax(56px,auto)_minmax(88px,auto)]",
        isSelected
          ? "border-slate-200 bg-transparent shadow-sm hover:border-slate-300"
          : "border-slate-200/80 bg-slate-50/80 opacity-60"
      )}
    >
      <div className="flex min-w-0 items-start gap-2">
        <input
          type="checkbox"
          tabIndex={-1}
          data-parameter-selector
          checked={isSelected}
          disabled={!parameter.isSelectable}
          onChange={(event) => onToggleSelect(event.target.checked)}
          className="mt-0.5 h-3.5 w-3.5 shrink-0 cursor-pointer rounded border-slate-300 text-brand-primary pointer-events-auto focus:ring-brand-primary/20 disabled:cursor-not-allowed"
          aria-label={`Select parameter ${parameter.parameterName}`}
        />
        <div className={cn("min-w-0", !isSelected && "opacity-50")}>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="block text-xs font-bold leading-tight text-slate-800">{parameter.parameterName}</span>
            {labelAdornment}
          </div>
          {reference && (
            <span data-reference-display className="mt-0.5 inline-block rounded border border-slate-200/60 bg-slate-100/90 px-1 text-[10px] font-mono text-slate-500">
              Ref: {reference}
            </span>
          )}
          {labelHelp}
        </div>
      </div>

      <div data-control-column className={cn("min-w-0", !isSelected && "pointer-events-none opacity-40")}>
        {children}
        {validationMessage && (
          <p
            id={validationMessageId}
            data-validation-message
            role="alert"
            className="mt-1 text-[10px] font-semibold normal-case tracking-normal text-rose-700"
          >
            {validationMessage}
          </p>
        )}
      </div>

      <span data-fixed-suffix={parameter.suffixSpec ? "true" : undefined} className="min-w-[45px] text-[11px] font-semibold text-slate-500 font-mono">
        {renderedUnit || ""}
      </span>

      <div data-status-column className="min-w-[70px]">
        <span
          className={cn(
            "inline-block min-w-[70px] rounded-md border px-2 py-0.5 text-center text-[10px] font-extrabold uppercase tracking-wider",
            outcome === "Invalid"
              ? "border-rose-400 bg-rose-100 text-rose-900 shadow-sm"
              : outcome === "Abnormal" || outcome === "High"
                ? "border-rose-300 bg-rose-100 text-rose-800"
                : outcome === "Low"
                  ? "border-amber-300 bg-amber-100 text-amber-900"
                : outcome === "Normal"
                  ? "border-emerald-300 bg-emerald-100 text-emerald-800"
                  : outcome === "Entered"
                    ? "border-blue-200 bg-blue-50 text-blue-800"
                  : "border-slate-200 bg-slate-100 font-normal text-slate-500"
          )}
        >
          {status}
        </span>
      </div>
    </div>
  );
}
