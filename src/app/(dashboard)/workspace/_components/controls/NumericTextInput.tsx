import React from "react";
import type { EvaluationOutcome, PatientSex } from "@/domain/types";
import type { ParameterSpec } from "@/domain/types/report-definition";
import { fieldSurfaceClassName } from "@/components/ui/Input";
import { cn } from "@/utils/cn";
import { resolveEncodingResult } from "../../_lib/encoding/evaluate-encoding-result";
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
        data-slot="input"
        className={cn(
          // The shared Input field surface - 36px from sm up, 44px below - with a mono value so a
          // column of results reads as a column of numbers.
          fieldSurfaceClassName,
          "block border outline-none font-mono tabular-nums placeholder:font-sans placeholder:text-slate-500 focus-visible:border-ring disabled:cursor-not-allowed",
          outcome === "Invalid" &&
            "border-brand-danger bg-brand-danger-bg font-semibold text-brand-danger hover:border-brand-danger"
        )}
      />
    </ParameterRow>
  );
}
