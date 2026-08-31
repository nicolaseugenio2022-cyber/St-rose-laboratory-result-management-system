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
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring",
        isManual
          ? "border-brand-warning-border bg-brand-warning-bg text-brand-warning hover:border-brand-warning"
          : "border-brand-info-border bg-brand-tint text-brand-info hover:border-brand-primary"
      )}
    >
      {isManual ? <Pencil className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
      {isManual ? "Manual" : "Auto"}
    </button>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-md border border-brand-info-border bg-brand-tint px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-brand-info"><Lock className="h-3 w-3" />Auto-Calculated</span>
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
    labelHelp={<span className={cn("mt-0.5 flex items-center gap-1 text-[11px] font-medium", isManual ? "text-brand-warning" : "text-brand-info")}><Info className="h-3 w-3 shrink-0" />{helpText}</span>}
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
          "block h-11 w-full rounded-md border bg-brand-surface px-3 font-mono text-[13px] tabular-nums text-brand-text transition-[border-color,box-shadow] placeholder:font-sans placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring focus-visible:border-brand-primary disabled:cursor-not-allowed disabled:bg-brand-structural disabled:text-brand-text-muted disabled:opacity-80 sm:h-9",
          evaluationOutcome === "Invalid"
            ? "border-brand-danger bg-brand-danger-bg font-semibold text-brand-danger hover:border-brand-danger focus-visible:border-brand-danger focus-visible:ring-brand-danger"
            : "border-brand-border hover:border-brand-border-strong"
        )}
      />
    ) : (
      // Visibly read-only: a structural tint instead of the white working surface, the value in
      // navy mono so it still reads as a key figure. The Auto chip beside the label is the
      // indicator; this field never invites typing.
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
        className={cn(
          "block h-11 w-full cursor-not-allowed rounded-md border px-3 font-mono text-[13px] font-semibold tabular-nums placeholder:font-sans placeholder:font-normal placeholder:text-brand-text-muted sm:h-9",
          evaluationOutcome === "Invalid"
            ? "border-brand-danger-border bg-brand-danger-bg text-brand-danger"
            : "border-brand-border bg-brand-structural text-brand-navy"
        )}
      />
    )}
  </ParameterRow>;
}
