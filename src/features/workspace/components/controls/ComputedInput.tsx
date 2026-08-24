import React from "react";
import type { EvaluationOutcome, PatientSex } from "@/domain/types";
import type { ParameterSpec } from "@/domain/types/report-definition";
import type { CalculationMode } from "@/domain/calculation-mode";
import { resolveComputedValidationMessage } from "@/services/generic-report-resolver";
import { cn } from "@/utils/cn";
import { Info, Lock, Pencil } from "lucide-react";
import { ParameterRow } from "./ParameterRow";

export interface ComputedInputProps {
  parameter: ParameterSpec; value: string; isSelected: boolean; patientSex?: PatientSex | null;
  evaluationOutcome?: EvaluationOutcome;
  computationMetadata?: Record<string, unknown> | null;
  onToggleSelect: (selected: boolean) => void;
  /** Absent means Auto, so an existing caller keeps today's read-only behaviour unchanged. */
  calculationMode?: CalculationMode;
  /** Manual editing. Only supplied for a binding that opted into manual entry. */
  onChange?: (val: string, outcome: EvaluationOutcome) => void;
  onRequestModeChange?: (next: CalculationMode) => void;
}

/**
 * The single control for a formula-bound parameter, in either calculation mode.
 *
 * It owns exactly one ParameterRow and swaps the field inside it. Manual does not delegate to
 * NumericTextInput, because that component owns a ParameterRow of its own and nesting them would
 * duplicate the whole four-column row; the shared clinical rules are reused through the resolver's
 * evaluation instead, which is what already produces `evaluationOutcome` here.
 *
 * The declarative control type stays "Computed" in both modes - the parameter really is
 * formula-bound, and only the operator's chosen mode differs. Mode is exposed separately through
 * the switch's accessible state and `data-calculation-mode`.
 */
export function ComputedInput({
  parameter,
  value,
  isSelected,
  patientSex,
  evaluationOutcome = "NoEvaluation",
  computationMetadata,
  onToggleSelect,
  calculationMode = "Auto",
  onChange,
  onRequestModeChange,
}: ComputedInputProps) {
  const validationMessage = resolveComputedValidationMessage(parameter, evaluationOutcome, computationMetadata);
  const errorId = `${parameter.parameterCode}-computed-error`;
  const supportsManualEntry = Boolean(parameter.formulaBinding?.supportsManualEntry);
  const isManual = calculationMode === "Manual";

  const modeControl = supportsManualEntry ? (
    <button
      type="button"
      role="switch"
      aria-checked={isManual}
      aria-label={`Manual entry for ${parameter.parameterName}`}
      data-calculation-mode-switch={calculationMode}
      onClick={() => onRequestModeChange?.(isManual ? "Auto" : "Manual")}
      className={cn(
        "inline-flex items-center gap-1 rounded border px-1.5 text-[9px] font-bold uppercase transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary/20",
        isManual
          ? "border-amber-300 bg-amber-100 text-amber-800 hover:border-amber-400"
          : "border-blue-200 bg-blue-100 text-blue-700 hover:border-blue-300"
      )}
    >
      {isManual ? <Pencil className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
      {isManual ? "Manual" : "Auto"}
    </button>
  ) : (
    <span className="inline-flex items-center gap-1 rounded border border-blue-200 bg-blue-100 px-1.5 text-[9px] font-bold uppercase text-blue-700"><Lock className="h-3 w-3" />Auto-Calculated</span>
  );

  const helpText = !supportsManualEntry
    ? "Computed automatically from its required inputs"
    : isManual
      ? "Manually entered result"
      : "Client formula — computed from its required inputs";

  return <ParameterRow
    parameter={parameter}
    isSelected={isSelected}
    patientSex={patientSex}
    outcome={evaluationOutcome}
    onToggleSelect={onToggleSelect}
    validationMessage={validationMessage || undefined}
    validationMessageId={validationMessage ? errorId : undefined}
    labelAdornment={modeControl}
    labelHelp={<span className={cn("mt-0.5 flex items-center gap-1 text-[10px] font-medium", isManual ? "text-amber-700" : "text-blue-600")}><Info className={cn("h-3 w-3 shrink-0", isManual ? "text-amber-600" : "text-blue-500")} />{helpText}</span>}
  >
    {isManual ? (
      <input
        type="text"
        inputMode="decimal"
        data-encoding-input
        data-control-type="Computed"
        data-calculation-mode="Manual"
        aria-label={parameter.parameterName}
        value={value}
        disabled={!isSelected}
        aria-invalid={evaluationOutcome === "Invalid"}
        aria-describedby={validationMessage ? errorId : undefined}
        onChange={(event) => onChange?.(event.target.value, evaluationOutcome)}
        placeholder="Enter result..."
        className={cn(
          "w-full rounded-md border px-2.5 py-1 text-xs font-mono transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary",
          evaluationOutcome === "Invalid" ? "border-rose-500 bg-rose-50/60 font-bold text-rose-900" : "border-slate-300 bg-white text-slate-900"
        )}
      />
    ) : (
      <input
        type="text"
        data-encoding-input
        data-control-type="Computed"
        data-calculation-mode="Auto"
        aria-label={parameter.parameterName}
        value={value}
        placeholder="Auto-calculated when inputs present"
        readOnly
        disabled
        aria-invalid={evaluationOutcome === "Invalid"}
        aria-describedby={validationMessage ? errorId : undefined}
        className="w-full cursor-not-allowed rounded-md border border-blue-300 bg-blue-100/70 px-2.5 py-1 text-xs font-bold font-mono text-blue-900 placeholder:font-normal placeholder:text-blue-400"
      />
    )}
  </ParameterRow>;
}
