import React from "react";
import type { EvaluationOutcome, PatientSex } from "@/domain/types";
import type { ParameterSpec } from "@/domain/types/report-definition";
import { fieldSurfaceClassName } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import { evaluateEncodingResult } from "../../_lib/encoding/evaluate-encoding-result";
import { ParameterRow } from "./ParameterRow";
import type { WorksheetColumnPolicy } from "../../_lib/encoding/worksheet-columns";

export interface FreeTextInputProps {
  parameter: ParameterSpec; value: string; isSelected: boolean; patientSex?: PatientSex | null;
  onChange: (val: string, outcome: EvaluationOutcome) => void;
  onToggleSelect: (selected: boolean) => void;
  /** Passed straight through to the row, which owns the worksheet geometry. */
  columns?: WorksheetColumnPolicy;
}

export function FreeTextInput({ parameter, value, isSelected, patientSex, onChange, onToggleSelect, columns }: FreeTextInputProps) {
  const outcome = evaluateEncodingResult(value, parameter, patientSex);
  return <ParameterRow parameter={parameter} isSelected={isSelected} patientSex={patientSex} outcome={outcome} onToggleSelect={onToggleSelect} columns={columns}>
    <input type="text" data-encoding-input data-control-type="FreeText" aria-label={parameter.parameterName} value={value} disabled={!isSelected} onChange={(event) => onChange(event.target.value, evaluateEncodingResult(event.target.value, parameter, patientSex))} placeholder="Free text finding..." data-slot="input" className={cn(fieldSurfaceClassName, "block w-full border outline-none placeholder:text-slate-500 focus-visible:border-ring disabled:cursor-not-allowed")} />
  </ParameterRow>;
}
