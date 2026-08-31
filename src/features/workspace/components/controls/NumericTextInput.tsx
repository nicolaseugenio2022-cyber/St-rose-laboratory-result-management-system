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
          // The shared Input field geometry - 36px from sm up, 44px below - with a mono value so a
          // column of results reads as a column of numbers.
          "block h-11 w-full rounded-md border bg-brand-surface px-3 font-mono text-[13px] tabular-nums text-brand-text transition-[border-color,box-shadow] placeholder:font-sans placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring focus-visible:border-brand-primary disabled:cursor-not-allowed disabled:bg-brand-structural disabled:text-brand-text-muted disabled:opacity-80 sm:h-9",
          outcome === "Invalid"
            ? "border-brand-danger bg-brand-danger-bg font-semibold text-brand-danger hover:border-brand-danger focus-visible:border-brand-danger focus-visible:ring-brand-danger"
            : "border-brand-border hover:border-brand-border-strong"
        )}
      />
    </ParameterRow>
  );
}
