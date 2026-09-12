import React from "react";
import { ChevronDown } from "lucide-react";
import type { EvaluationOutcome, PatientSex } from "@/domain/types";
import type { ParameterSpec } from "@/domain/types/report-definition";
import { formatConditionalChoiceValue, parseConditionalChoiceValue } from "../_lib/encoding/report-encoding";
import { ParameterRow } from "./controls/ParameterRow";
import type { WorksheetColumnPolicy } from "../_lib/encoding/worksheet-columns";
import { evaluateEncodingResult } from "../_lib/encoding/evaluate-encoding-result";

/**
 * Two native selects side by side in the shared field styling. The pair shares the Result
 * track, so padding and the chevron are a step tighter than the single-select control; the
 * elements stay real <select>s, in the same DOM order, so the grid Tab fast path walks
 * Finding then Result exactly as before.
 */
const PAIRED_SELECT_CLASS =
  "block h-11 w-full appearance-none rounded-md border border-brand-border bg-brand-surface pl-2.5 pr-7 text-[13px] text-brand-text transition-[border-color,box-shadow] hover:border-brand-border-strong focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring disabled:cursor-not-allowed disabled:bg-brand-structural disabled:text-brand-text-muted disabled:opacity-80 sm:h-9";

export function ConditionalChoiceInput({ parameter, value, isSelected, patientSex, onChange, onToggleSelect, columns }: {
  parameter: ParameterSpec; value: string; isSelected: boolean; patientSex?: PatientSex | null;
  onChange: (value: string, outcome: EvaluationOutcome) => void;
  onToggleSelect: (selected: boolean) => void;
  /** Passed straight through to the row, which owns the worksheet geometry. */
  columns?: WorksheetColumnPolicy;
}) {
  const spec = parameter.conditionalChoiceSpec;
  if (!spec) return null;
  const parsed = parseConditionalChoiceValue(value, spec);
  const outcome = evaluateEncodingResult(value, parameter, patientSex);
  const change = (label: string, result: string) => {
    const nextValue = formatConditionalChoiceValue(label, result);
    onChange(nextValue, evaluateEncodingResult(nextValue, parameter, patientSex));
  };
  return <ParameterRow parameter={parameter} isSelected={isSelected} patientSex={patientSex} outcome={outcome} onToggleSelect={onToggleSelect} columns={columns}>
    <div className="flex gap-1.5">
      <div className="relative min-w-0 flex-1">
        <select value={parsed.label} disabled={!isSelected} onChange={(event) => change(event.target.value, parsed.result)} data-encoding-input data-control-type="ConditionalChoice" className={PAIRED_SELECT_CLASS}>
          <option value="">-- Finding --</option>{spec.labelChoices.map((choice) => <option key={choice} value={choice}>{choice}</option>)}
        </select>
        <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-brand-text-muted" />
      </div>
      <div className="relative min-w-0 flex-1">
        <select value={parsed.result} disabled={!isSelected || !parsed.label} onChange={(event) => change(parsed.label, event.target.value)} data-encoding-input data-control-type="ConditionalChoice" className={PAIRED_SELECT_CLASS}>
          <option value="">-- Result --</option>{spec.resultOptions.map((choice) => <option key={choice} value={choice}>{choice}</option>)}
        </select>
        <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-brand-text-muted" />
      </div>
    </div>
  </ParameterRow>;
}
