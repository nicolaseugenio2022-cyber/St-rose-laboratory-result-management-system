import React from "react";
import type { EvaluationOutcome, PatientSex } from "@/domain/types";
import type { ParameterSpec } from "@/domain/types/report-definition";
import { resolveReferenceDisplay } from "@/domain/reference-display";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { cn } from "@/utils/cn";
import { displayUnit } from "../../_lib/encoding/evaluate-encoding-result";

/**
 * The worksheet column tracks, exported so the header rendered by DynamicResultForm is laid out
 * from the same definition as the rows beneath it. Two hand-kept copies would drift the first
 * time either side is touched, and a header that does not line up is worse than no header.
 *
 * **Every track is fixed, and that is the whole point.** Each ParameterRow is its own
 * independent grid, so a content-sized track (`auto`, `minmax(_,auto)`, `min-content`) is
 * resolved separately per row against that row's own content. The previous Unit, Reference
 * and Status tracks were all content-sized, so a row whose unit read "x10³/µL" resolved a
 * wider Unit track than one reading "%", and every column after it - including the Result
 * input - started at a different x position. Nothing but identical, content-independent
 * track sizes can align independent grids; widening the content-sized tracks until one
 * fixture happens to line up does not, because the next fixture re-resolves them.
 *
 * Parameter alone is `minmax(0,1fr)`: it is the only flexible track, it absorbs all
 * remaining width, and a `1fr` resolves from the container - which every row shares - not
 * from content. The 0 minimum lets a long parameter name wrap rather than force the row
 * past the card and into the clipped overflow.
 *
 * Narrow: Parameter and Result take the full width, then Unit | Reference | Status share one
 * line, so a row stays one readable block instead of five detached stacked cells. That line
 * is fixed-tracked for the same reason.
 */
export const PARAMETER_ROW_TRACKS =
  "grid-cols-[3.25rem_minmax(0,1fr)_6rem] " +
  "sm:grid-cols-[minmax(0,1fr)_9rem_3.25rem_6rem_6rem] " +
  "lg:grid-cols-[minmax(0,1fr)_11rem_4rem_9rem_6.5rem] " +
  "xl:grid-cols-[minmax(0,1fr)_14rem_4.5rem_12rem_7rem]";

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
        "grid items-start gap-x-2 gap-y-1 px-3 py-1.5 text-xs transition-colors duration-150 sm:items-center",
        PARAMETER_ROW_TRACKS,
        // The row being edited is the one thing an encoder must never lose track of. The brand
        // tint plus a narrow inset teal rail marks it without moving anything: the rail is always
        // present and only changes colour, so no row shifts by a pixel when focus arrives. The
        // control keeps its own focus ring - this marks the row, it does not replace that.
        "border-l-2 border-l-transparent focus-within:border-l-brand-primary focus-within:bg-brand-tint",
        isSelected ? "hover:bg-brand-structural" : "bg-brand-structural opacity-60"
      )}
    >
      <div className="col-span-3 flex min-w-0 items-start gap-2 sm:col-span-1">
        {/* No tabIndex at all: a native checkbox is already focusable, and its natural DOM
            order is exactly the order the operator reads the row in. tabIndex={-1} had made
            individual selection mouse-only - a keyboard operator could reach the bulk
            Select/Deselect control but could not deselect one optional parameter. A
            disabled checkbox (an explicitly non-selectable parameter) is excluded by the
            platform, so exclusion never has to be spelled out here.

            The ring is stated in full because focus-visible:ring-brand-focus-ring alone set
            a colour with no width and therefore painted nothing - invisible focus on a
            control that is now keyboard reachable would be worse than the old exclusion. */}
        <input
          type="checkbox"
          data-parameter-selector
          checked={isSelected}
          disabled={!parameter.isSelectable}
          onChange={(event) => onToggleSelect(event.target.checked)}
          className="mt-0.5 h-3.5 w-3.5 shrink-0 cursor-pointer rounded border-brand-border-strong accent-brand-primary pointer-events-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring focus-visible:ring-offset-1 focus-visible:ring-offset-transparent disabled:cursor-not-allowed sm:mt-0"
          aria-label={`Select parameter ${parameter.parameterName}`}
        />
        <div className={cn("min-w-0", !isSelected && "opacity-50")}>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="block text-[13px] font-medium leading-tight text-brand-text">{parameter.parameterName}</span>
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
            className="mt-1 text-xs font-semibold normal-case tracking-normal text-brand-danger"
          >
            {validationMessage}
          </p>
        )}
      </div>

      <span data-fixed-suffix={parameter.suffixSpec ? "true" : undefined} className="min-w-0 break-words font-mono text-xs text-brand-text-muted">
        {renderedUnit || ""}
      </span>

      {/* Reference column. Rendered even when empty so the remaining cells keep their track:
          grid items are placed in source order, so omitting this element would shift Status
          into the reference track. The track is a fixed width, so an empty reference leaves
          the column empty and Status stays exactly where it is on every other row - and a long
          sex-unset reference wraps inside that width instead of widening the column and
          pushing Result and Status sideways. The per-element max-w that used to bound the
          wrap is gone: the track is the bound, and two bounds could disagree. */}
      <span className="min-w-0">
        {reference && (
          <span
            data-reference-display
            className="inline-block w-full whitespace-normal break-words font-mono text-xs leading-snug text-brand-text-muted"
          >
            Ref: {reference}
          </span>
        )}
      </span>

      <div data-status-column className="min-w-0">
        {/* The outcome flag is the shared StatusBadge, which carries exactly the mapping this
            column used to retype by hand - Invalid solid, Abnormal/High rose, Low amber, Normal
            emerald, Entered blue, pending slate. `label` keeps the visible word: "Pending" for an
            unevaluated result, the outcome name for everything else. w-full because the track is
            already fixed, so filling it makes every badge the same width and the status column
            reads as one stripe. The text is always the primary signal. */}
        <StatusBadge
          status={outcome}
          label={status}
          className="w-full justify-center whitespace-normal break-words px-1.5 text-center"
        />
      </div>
    </div>
  );
}
