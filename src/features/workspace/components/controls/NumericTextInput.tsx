import React from "react";
import type { EvaluationOutcome, PatientSex } from "@/domain/types";
import type { ParameterSpec } from "@/domain/types/report-definition";
import { cn } from "@/utils/cn";
import { resolveEncodingResult } from "../../encoding/evaluate-encoding-result";
import { ParameterRow } from "./ParameterRow";

export interface NumericTextInputProps {
  parameter: ParameterSpec;
  value: string;
  isSelected: boolean;
  patientSex?: PatientSex | null;
  onChange: (val: string, outcome: EvaluationOutcome) => void;
  onToggleSelect: (selected: boolean) => void;
}

export function NumericTextInput({ parameter, value, isSelected, patientSex, onChange, onToggleSelect }: NumericTextInputProps) {
  const resolution = resolveEncodingResult(value, parameter, patientSex);
  const outcome = resolution.outcome;
  const errorId = `${parameter.parameterCode}-numeric-error`;
  return (
    <ParameterRow
      parameter={parameter}
      isSelected={isSelected}
      patientSex={patientSex}
      outcome={outcome}
      onToggleSelect={onToggleSelect}
      validationMessage={resolution.validationMessage || undefined}
      validationMessageId={resolution.validationMessage ? errorId : undefined}
    >
      <input
        type="text"
        inputMode="decimal"
        data-encoding-input
        data-control-type="NumericText"
        aria-label={parameter.parameterName}
        value={value}
        disabled={!isSelected}
        aria-invalid={outcome === "Invalid"}
        aria-describedby={outcome === "Invalid" ? errorId : undefined}
        onChange={(event) => {
          const nextResolution = resolveEncodingResult(event.target.value, parameter, patientSex);
          onChange(event.target.value, nextResolution.outcome);
        }}
        placeholder="Enter result..."
        className={cn(
          "w-full rounded-md border px-2.5 py-1 text-xs font-mono transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary",
          outcome === "Invalid" ? "border-rose-500 bg-rose-50/60 font-bold text-rose-900" : "border-slate-300 bg-white text-slate-900"
        )}
      />
    </ParameterRow>
  );
}
