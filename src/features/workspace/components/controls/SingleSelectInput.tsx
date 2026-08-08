import React from "react";
import { ITemplateParameter } from "@/domain/models/interfaces";
import { EvaluationOutcome } from "@/domain/types";
import { referenceEvaluationService } from "@/services/reference-evaluation-service";
import { cn } from "@/utils/cn";

export interface SingleSelectInputProps {
  parameter: ITemplateParameter;
  value: string;
  isSelected: boolean;
  onChange: (val: string, outcome: EvaluationOutcome) => void;
  onToggleSelect: (selected: boolean) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLSelectElement>) => void;
}

export function SingleSelectInput({
  parameter,
  value,
  isSelected,
  onChange,
  onToggleSelect,
  onKeyDown,
}: SingleSelectInputProps) {
  const outcome = referenceEvaluationService.evaluateResult(value, parameter.referenceRule);

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    const newOutcome = referenceEvaluationService.evaluateResult(val, parameter.referenceRule);
    onChange(val, newOutcome);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLSelectElement>) => {
    if (e.key === "Enter" && onKeyDown) {
      onKeyDown(e);
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-center justify-between py-1 px-2.5 rounded-lg border transition-all duration-150 gap-2 text-xs",
        isSelected
          ? "bg-transparent border-slate-200 shadow-2xs hover:border-slate-300"
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
          <span className="font-bold text-slate-800 block leading-tight text-xs">{parameter.parameterName}</span>
          {parameter.referenceRule && parameter.referenceRule.evaluationType === "ExpectedValue" && (
            <span className="text-[10px] text-slate-500 font-mono inline-block mt-0.5 bg-slate-100/90 px-1 py-0.2 rounded border border-slate-200/60">
              Expected: {parameter.referenceRule.expectedValue}
            </span>
          )}
        </div>
      </div>

      <div className={cn("flex items-center gap-2 flex-1 justify-end", !isSelected && "opacity-40 pointer-events-none")}>
        <div className="relative flex-1 max-w-[180px]">
          <select
            value={value}
            disabled={!isSelected}
            onChange={handleSelectChange}
            onKeyDown={handleKeyDown}
            className="w-full px-2.5 py-1 text-xs rounded-md border font-medium bg-white text-slate-800 focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary focus:outline-none"
          >
            <option value="">-- Select --</option>
            {parameter.options?.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        {parameter.unit && <span className="text-[11px] font-semibold text-slate-500 min-w-[45px] font-mono">{parameter.unit}</span>}

        <span
          className={cn(
            "text-[10px] font-extrabold px-2 py-0.5 rounded-md border text-center min-w-[70px] uppercase tracking-wider",
            outcome === "Invalid"
              ? "bg-rose-100 text-rose-900 border-rose-400 font-extrabold shadow-2xs"
              : outcome === "Abnormal"
              ? "bg-rose-100 text-rose-800 border-rose-300"
              : outcome === "Normal"
              ? "bg-emerald-100 text-emerald-800 border-emerald-300"
              : "bg-slate-100 text-slate-500 border-slate-200 font-normal"
          )}
        >
          {outcome === "NoEvaluation" ? "Pending" : outcome}
        </span>
      </div>
    </div>
  );
}
