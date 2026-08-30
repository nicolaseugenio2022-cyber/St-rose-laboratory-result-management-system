import React from "react";
import type { EvaluationOutcome, PatientSex } from "@/domain/types";
import type { ParameterSpec } from "@/domain/types/report-definition";
import { resolveReferenceDisplay } from "@/domain/reference-display";
import { cn } from "@/utils/cn";
import { displayUnit } from "../../encoding/evaluate-encoding-result";

/**
 * The worksheet column tracks, exported so the header rendered by DynamicResultForm is laid out
 * from the same definition as the rows beneath it. Two hand-kept copies would drift the first
 * time either side is touched, and a header that does not line up is worse than no header.
 *
 * Narrow: Parameter and Result take the full width, then Unit | Reference | Status share one
 * line, so a row stays one readable block instead of five detached stacked cells. Wide: the five
 * tracks. Reference is minmax(0,auto) so a qualitative report, where no parameter carries a
 * reference, collapses the track to nothing rather than leaving a dead column.
 */
export const PARAMETER_ROW_TRACKS =
  "grid-cols-[auto_minmax(0,1fr)_auto] sm:grid-cols-[minmax(180px,1fr)_minmax(150px,180px)_minmax(45px,auto)_minmax(0,auto)_minmax(70px,auto)] xl:grid-cols-[minmax(220px,1fr)_minmax(200px,260px)_minmax(56px,auto)_minmax(0,auto)_minmax(88px,auto)]";

export interface ParameterRowProps {
  parameter: ParameterSpec;
  isSelected: boolean;
  patientSex?: PatientSex | null;
  outcome?: EvaluationOutcome;
  onToggleSelect: (selected: boolean) => void;
  children: React.ReactNode;
  labelAdornment?: React.ReactNode;
  labelHelp?: React.ReactNode;
  validationMessage?: string;
  validationMessageId?: string;
}

export function ParameterRow({
  parameter,
  isSelected,
  patientSex,
  outcome = "NoEvaluation",
  onToggleSelect,
  children,
  labelAdornment,
  labelHelp,
  validationMessage,
  validationMessageId,
}: ParameterRowProps) {
  const renderedUnit = displayUnit(parameter);
  const reference = resolveReferenceDisplay(parameter.referenceRule, patientSex, renderedUnit);
  const status = outcome === "NoEvaluation" ? "Pending" : outcome;

  return (
    <div
      data-parameter-row
      className={cn(
        // QA-08: one flat result list. The row owns no border, radius or shadow of its own - the
        // hairline between rows is the divider drawn by the encoding list container, so a result
        // can no longer be read against the wrong neighbouring row. Row height is never fixed and
        // nothing is clipped: a validation message, a wrapped sex-unset reference, a
        // ConditionalChoice pair or a computed help line all expand the row.
        "grid items-start gap-x-2 gap-y-1 px-2.5 py-1 text-xs transition-colors duration-150 sm:items-center",
        PARAMETER_ROW_TRACKS,
        // The row being edited is the one thing an encoder must never lose track of. A soft brand
        // wash plus a narrow inset accent marks it without moving anything: the accent border is
        // always present and only changes colour, so no row shifts by a pixel when focus arrives.
        // The control keeps its own focus ring - this marks the row, it does not replace that.
        "border-l-2 border-l-transparent focus-within:border-l-brand-primary focus-within:bg-blue-50/60",
        isSelected
          ? "bg-transparent hover:bg-slate-100/60"
          : "bg-slate-100/70 opacity-60"
      )}
    >
      <div className="col-span-3 flex min-w-0 items-start gap-2 sm:col-span-1">
        <input
          type="checkbox"
          tabIndex={-1}
          data-parameter-selector
          checked={isSelected}
          disabled={!parameter.isSelectable}
          onChange={(event) => onToggleSelect(event.target.checked)}
          className="mt-0.5 h-3.5 w-3.5 shrink-0 cursor-pointer rounded border-slate-300 text-brand-primary pointer-events-auto focus:ring-brand-primary/20 disabled:cursor-not-allowed"
          aria-label={`Select parameter ${parameter.parameterName}`}
        />
        <div className={cn("min-w-0", !isSelected && "opacity-50")}>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="block text-xs font-semibold leading-tight text-slate-900">{parameter.parameterName}</span>
            {labelAdornment}
          </div>
          {labelHelp}
        </div>
      </div>

      <div data-control-column className={cn("col-span-3 min-w-0 sm:col-span-1", !isSelected && "pointer-events-none opacity-40")}>
        {children}
        {validationMessage && (
          <p
            id={validationMessageId}
            data-validation-message
            role="alert"
            className="mt-1 text-[11px] font-semibold normal-case tracking-normal text-rose-700"
          >
            {validationMessage}
          </p>
        )}
      </div>

      <span data-fixed-suffix={parameter.suffixSpec ? "true" : undefined} className="min-w-[45px] text-[11px] font-semibold text-slate-500 font-mono">
        {renderedUnit || ""}
      </span>

      {/* Reference column. Rendered even when empty so the remaining cells keep their track:
          grid items are placed in source order, so omitting this element would shift Status
          into the reference track. An empty span contributes no width, which is what lets the
          minmax(0,auto) track collapse for a qualitative report. */}
      <span className="min-w-0">
        {reference && (
          <span
            data-reference-display
            className="inline-block max-w-[8rem] whitespace-normal break-words text-[11px] font-mono leading-snug text-slate-500 xl:max-w-[14rem]"
          >
            Ref: {reference}
          </span>
        )}
      </span>

      <div data-status-column className="min-w-[70px]">
        <span
          className={cn(
            // Same outcome mapping and same hues as before, with the badge weight taken down:
            // a 1px inset ring instead of a filled border, so a column of statuses reads as a
            // scannable stripe rather than a stack of buttons. Invalid keeps the loudest
            // treatment because it is the only outcome that blocks completion. The text is
            // always the primary signal - colour never carries the meaning alone.
            "inline-block min-w-[70px] rounded px-1.5 py-0.5 text-center text-[11px] font-bold uppercase tracking-wide",
            outcome === "Invalid"
              ? "bg-rose-600 font-extrabold text-white"
              : outcome === "Abnormal" || outcome === "High"
                ? "bg-rose-50 text-rose-800 ring-1 ring-inset ring-rose-300"
                : outcome === "Low"
                  ? "bg-amber-50 text-amber-900 ring-1 ring-inset ring-amber-300"
                : outcome === "Normal"
                  ? "bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-300"
                  : outcome === "Entered"
                    ? "bg-blue-50 text-blue-800 ring-1 ring-inset ring-blue-300"
                  : "bg-transparent font-normal text-slate-500 ring-1 ring-inset ring-slate-200"
          )}
        >
          {status}
        </span>
      </div>
    </div>
  );
}
