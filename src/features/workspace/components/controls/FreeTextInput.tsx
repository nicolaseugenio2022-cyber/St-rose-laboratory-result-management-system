import React from "react";
import type { EvaluationOutcome, PatientSex } from "@/domain/types";
import type { ParameterSpec } from "@/domain/types/report-definition";
import { evaluateEncodingResult } from "../../encoding/evaluate-encoding-result";
import { ParameterRow } from "./ParameterRow";

export interface FreeTextInputProps {
  parameter: ParameterSpec; value: string; isSelected: boolean; patientSex?: PatientSex | null;
  onChange: (val: string, outcome: EvaluationOutcome) => void;
  onToggleSelect: (selected: boolean) => void;
}

export function FreeTextInput({ parameter, value, isSelected, patientSex, onChange, onToggleSelect }: FreeTextInputProps) {
  const outcome = evaluateEncodingResult(value, parameter, patientSex);
  return <ParameterRow parameter={parameter} isSelected={isSelected} patientSex={patientSex} outcome={outcome} onToggleSelect={onToggleSelect}>
    <input type="text" data-encoding-input data-control-type="FreeText" aria-label={parameter.parameterName} value={value} disabled={!isSelected} onChange={(event) => onChange(event.target.value, evaluateEncodingResult(event.target.value, parameter, patientSex))} placeholder="Free text finding..." className="block h-11 w-full rounded-md border border-brand-border bg-brand-surface px-3 text-[13px] text-brand-text transition-[border-color,box-shadow] placeholder:text-slate-500 hover:border-brand-border-strong focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring disabled:cursor-not-allowed disabled:bg-brand-structural disabled:text-brand-text-muted disabled:opacity-80 sm:h-9" />
  </ParameterRow>;
}
