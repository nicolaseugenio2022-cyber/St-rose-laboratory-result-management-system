import React from "react";
import type { EvaluationOutcome, PatientSex } from "@/domain/types";
import type { ParameterSpec } from "@/domain/types/report-definition";
import { resolveComputedValidationMessage } from "@/services/generic-report-resolver";
import { Info, Lock } from "lucide-react";
import { ParameterRow } from "./ParameterRow";

export interface ComputedInputProps {
  parameter: ParameterSpec; value: string; isSelected: boolean; patientSex?: PatientSex | null;
  evaluationOutcome?: EvaluationOutcome;
  computationMetadata?: Record<string, unknown> | null;
  onToggleSelect: (selected: boolean) => void;
}

export function ComputedInput({ parameter, value, isSelected, patientSex, evaluationOutcome = "NoEvaluation", computationMetadata, onToggleSelect }: ComputedInputProps) {
  const validationMessage = resolveComputedValidationMessage(parameter, evaluationOutcome, computationMetadata);
  const errorId = `${parameter.parameterCode}-computed-error`;
  return <ParameterRow
    parameter={parameter}
    isSelected={isSelected}
    patientSex={patientSex}
    outcome={evaluationOutcome}
    onToggleSelect={onToggleSelect}
    validationMessage={validationMessage || undefined}
    validationMessageId={validationMessage ? errorId : undefined}
    labelAdornment={<span className="inline-flex items-center gap-1 rounded border border-blue-200 bg-blue-100 px-1.5 text-[9px] font-bold uppercase text-blue-700"><Lock className="h-3 w-3" />Auto-Calculated</span>}
    labelHelp={<span className="mt-0.5 flex items-center gap-1 text-[10px] font-medium text-blue-600"><Info className="h-3 w-3 shrink-0 text-blue-500" />Computed automatically from its required inputs</span>}
  >
    <input
      type="text"
      data-encoding-input
      data-control-type="Computed"
      value={value}
      placeholder="Auto-calculated when inputs present"
      readOnly
      disabled
      aria-invalid={evaluationOutcome === "Invalid"}
      aria-describedby={validationMessage ? errorId : undefined}
      className="w-full cursor-not-allowed rounded-md border border-blue-300 bg-blue-100/70 px-2.5 py-1 text-xs font-bold font-mono text-blue-900 placeholder:font-normal placeholder:text-blue-400"
    />
  </ParameterRow>;
}
