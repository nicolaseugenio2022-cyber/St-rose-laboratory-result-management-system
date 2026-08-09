import React from "react";
import type { EvaluationOutcome, PatientSex } from "@/domain/types";
import type { ParameterSpec } from "@/domain/types/report-definition";
import { formatConditionalChoiceValue, parseConditionalChoiceValue } from "../encoding/report-encoding";
import { ParameterRow } from "./controls/ParameterRow";
import { evaluateEncodingResult } from "../encoding/evaluate-encoding-result";

export function ConditionalChoiceInput({ parameter, value, isSelected, patientSex, onChange, onToggleSelect }: {
  parameter: ParameterSpec; value: string; isSelected: boolean; patientSex?: PatientSex | null;
  onChange: (value: string, outcome: EvaluationOutcome) => void;
  onToggleSelect: (selected: boolean) => void;
}) {
  const spec = parameter.conditionalChoiceSpec;
  if (!spec) return null;
  const parsed = parseConditionalChoiceValue(value, spec);
  const outcome = evaluateEncodingResult(value, parameter, patientSex);
  const change = (label: string, result: string) => {
    const nextValue = formatConditionalChoiceValue(label, result);
    onChange(nextValue, evaluateEncodingResult(nextValue, parameter, patientSex));
  };
  return <ParameterRow parameter={parameter} isSelected={isSelected} patientSex={patientSex} outcome={outcome} onToggleSelect={onToggleSelect}>
    <div className="flex gap-2">
      <select value={parsed.label} disabled={!isSelected} onChange={(event) => change(event.target.value, parsed.result)} data-encoding-input data-control-type="ConditionalChoice" className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2.5 py-1">
        <option value="">-- Finding --</option>{spec.labelChoices.map((choice) => <option key={choice} value={choice}>{choice}</option>)}
      </select>
      <select value={parsed.result} disabled={!isSelected || !parsed.label} onChange={(event) => change(parsed.label, event.target.value)} data-encoding-input data-control-type="ConditionalChoice" className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2.5 py-1">
        <option value="">-- Result --</option>{spec.resultOptions.map((choice) => <option key={choice} value={choice}>{choice}</option>)}
      </select>
    </div>
  </ParameterRow>;
}
