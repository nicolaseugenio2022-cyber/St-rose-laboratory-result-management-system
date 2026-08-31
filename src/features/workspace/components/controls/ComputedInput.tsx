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
 * duplicate the whole five-column row; the shared clinical rules are reused through the resolver's
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
        "inline-flex items-center gap-1 rounded border px-1.5 text-[11px] font-bold uppercase transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring",
        isManual
          ? "border-amber-300 bg-amber-100 text-amber-800 hover:border-amber-400"
          : "border-brand-info-border bg-brand-tint text-brand-info hover:border-brand-info-border"
      )}
    >
      {isManual ? <Pencil className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
      {isManual ? "Manual" : "Auto"}
    </button>
  ) : (
    <span className="inline-flex items-center gap-1 rounded border border-brand-info-border bg-brand-tint px-1.5 text-[11px] font-bold uppercase text-brand-info"><Lock className="h-3 w-3" />Auto-Calculated</span>
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
    labelHelp={<span className={cn("mt-0.5 flex items-center gap-1 text-[11px] font-medium", isManual ? "text-amber-700" : "text-brand-info")}><Info className={cn("h-3 w-3 shrink-0", isManual ? "text-amber-600" : "text-brand-info")} />{helpText}</span>}
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
          "h-8 w-full rounded-md border px-2.5 text-sm font-mono transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring focus-visible:border-brand-primary",
          evaluationOutcome === "Invalid" ? "border-rose-500 bg-rose-50/60 font-bold text-rose-900" : "border-brand-border bg-brand-card text-brand-text"
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
        className="h-8 w-full cursor-not-allowed rounded-md border border-brand-info-border bg-brand-tint px-2.5 text-sm font-bold font-mono text-brand-info placeholder:font-normal placeholder:text-brand-text-subtle"
      />
    )}
  </ParameterRow>;
}
