import React from "react";
import { ChevronDown } from "lucide-react";
import type { EvaluationOutcome, PatientSex } from "@/domain/types";
import type { ParameterSpec } from "@/domain/types/report-definition";
import { fieldSurfaceClassName } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import { evaluateEncodingResult } from "../../_lib/encoding/evaluate-encoding-result";
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
      <select value={value} data-encoding-input data-control-type="SingleSelect" aria-label={parameter.parameterName} disabled={!isSelected} onChange={(event) => onChange(event.target.value, evaluateEncodingResult(event.target.value, parameter, patientSex))} data-slot="native-select" className={cn(fieldSurfaceClassName, "block appearance-none border outline-none focus-visible:border-ring disabled:cursor-not-allowed", "pl-3 pr-9")}>
        <option value="">-- Select --</option>
        {parameter.options?.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-text-muted" />
    </div>
  </ParameterRow>;
}
