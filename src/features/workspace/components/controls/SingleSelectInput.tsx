import React from "react";
import { ChevronDown } from "lucide-react";
import type { EvaluationOutcome, PatientSex } from "@/domain/types";
import type { ParameterSpec } from "@/domain/types/report-definition";
import { evaluateEncodingResult } from "../../encoding/evaluate-encoding-result";
import { ParameterRow } from "./ParameterRow";

export interface SingleSelectInputProps {
  parameter: ParameterSpec; value: string; isSelected: boolean; patientSex?: PatientSex | null;
  onChange: (val: string, outcome: EvaluationOutcome) => void;
  onToggleSelect: (selected: boolean) => void;
}

export function SingleSelectInput({ parameter, value, isSelected, patientSex, onChange, onToggleSelect }: SingleSelectInputProps) {
  const outcome = evaluateEncodingResult(value, parameter, patientSex);
  return <ParameterRow parameter={parameter} isSelected={isSelected} patientSex={patientSex} outcome={outcome} onToggleSelect={onToggleSelect}>
    {/* A native select in the shared field styling: the browser arrow is replaced by the lucide
        chevron so the control matches the fields around it, and the element stays a real <select>
        so keyboard, mobile pickers and the grid Tab fast path are untouched. */}
    <div className="relative">
      <select value={value} data-encoding-input data-control-type="SingleSelect" aria-label={parameter.parameterName} disabled={!isSelected} onChange={(event) => onChange(event.target.value, evaluateEncodingResult(event.target.value, parameter, patientSex))} className="block h-11 w-full appearance-none rounded-md border border-brand-border bg-brand-surface pl-3 pr-9 text-[13px] text-brand-text transition-[border-color,box-shadow] hover:border-brand-border-strong focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring disabled:cursor-not-allowed disabled:bg-brand-structural disabled:text-brand-text-muted disabled:opacity-80 sm:h-9">
        <option value="">-- Select --</option>
        {parameter.options?.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-text-muted" />
    </div>
  </ParameterRow>;
}
