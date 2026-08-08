import React from "react";
import { ITemplateParameter } from "@/domain/models/interfaces";
import { EvaluationOutcome } from "@/domain/types";
import { cn } from "@/utils/cn";
import { Lock, Info } from "lucide-react";

export interface ComputedInputProps {
  parameter: ITemplateParameter;
  value: string;
  isSelected: boolean;
  evaluationOutcome?: EvaluationOutcome;
  onToggleSelect: (selected: boolean) => void;
}

export function ComputedInput({
  parameter,
  value,
  isSelected,
  evaluationOutcome = "NoEvaluation",
  onToggleSelect,
}: ComputedInputProps) {
  const hasValue = value.trim() !== "";

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-center justify-between py-1 px-2.5 rounded-lg border transition-all duration-150 gap-2 text-xs",
        isSelected
          ? "bg-transparent border-blue-200/80 shadow-2xs"
          : "bg-slate-50/80 border-slate-200/80 opacity-60"
      )}
    >
      <div className="flex items-center gap-2 min-w-[210px]">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => onToggleSelect(e.target.checked)}
          className="h-3.5 w-3.5 rounded border-slate-300 text-brand-primary focus:ring-brand-primary/20 cursor-pointer pointer-events-auto shrink-0"
          aria-label={`Select parameter ${parameter.parameterName}`}
        />
        <div className={cn(!isSelected && "opacity-50")}>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-slate-800 block leading-tight text-xs">{parameter.parameterName}</span>
            <span className="inline-flex items-center gap-1 text-[9px] font-bold text-blue-700 bg-blue-100 border border-blue-200 px-1.5 py-0.2 rounded uppercase">
              <Lock className="h-3 w-3" />
              Auto-Calculated
            </span>
          </div>
          <span className="text-[10px] text-blue-600 font-medium flex items-center gap-1 mt-0.5">
            <Info className="h-3 w-3 text-blue-500 shrink-0" />
            Computed automatically from Cholesterol, HDL, and Triglycerides
          </span>
        </div>
      </div>

      <div className={cn("flex items-center gap-2 flex-1 justify-end", !isSelected && "opacity-40 pointer-events-none")}>
        <div className="relative flex-1 max-w-[180px]">
          <input
            type="text"
            value={value}
            placeholder="Auto-calculated when inputs present"
            readOnly
            disabled
            className="w-full px-2.5 py-1 text-xs font-mono font-bold rounded-md border border-blue-300 bg-blue-100/70 text-blue-900 cursor-not-allowed placeholder:text-blue-400 placeholder:font-normal"
          />
        </div>

        {parameter.unit && <span className="text-[11px] font-semibold text-slate-500 min-w-[45px] font-mono">{parameter.unit}</span>}

        {hasValue && isSelected && evaluationOutcome !== "NoEvaluation" ? (
          <span
            className={cn(
              "text-[10px] font-extrabold px-2 py-0.5 rounded-md border text-center min-w-[70px] uppercase tracking-wider",
              evaluationOutcome === "Invalid"
                ? "bg-rose-100 text-rose-900 border-rose-400 font-extrabold shadow-2xs"
                : evaluationOutcome === "Normal"
                ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                : "bg-rose-100 text-rose-800 border-rose-300"
            )}
          >
            {evaluationOutcome}
          </span>
        ) : (
          <span className="min-w-[70px]" />
        )}
      </div>
    </div>
  );
}
