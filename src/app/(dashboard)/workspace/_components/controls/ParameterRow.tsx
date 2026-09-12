import React from "react";
import type { EvaluationOutcome, PatientSex } from "@/domain/types";
import type { ParameterSpec } from "@/domain/types/report-definition";
import { resolveReferenceDisplay } from "@/domain/reference-display";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { cn } from "@/lib/utils";
import { displayUnit } from "../../_lib/encoding/evaluate-encoding-result";
import { FULL_WORKSHEET_COLUMNS, type WorksheetColumnPolicy } from "../../_lib/encoding/worksheet-columns";

/**
 * The column set every row in one worksheet shares, resolved once by DynamicResultForm from the
 * examination's own declaration and handed down through the controls.
 *
 * A PROP, deliberately, not context and not a hook. `ParameterRow` is called as a plain function by
 * checkpoint B4, which inspects the element tree it returns; a hook in here would make that call
 * throw rather than assert. Defaulting to the full column set is also what keeps a row rendered
 * outside a worksheet - a verifier, a single control under test - at the geometry it always had.
 */
const DEFAULT_WORKSHEET_COLUMNS = FULL_WORKSHEET_COLUMNS;

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
  /** The worksheet column set. Omitted draws every column. */
  columns?: WorksheetColumnPolicy;
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
  columns = DEFAULT_WORKSHEET_COLUMNS,
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
        columns.rowTracks,
        // The row being edited is the one thing an encoder must never lose track of. The brand
        // tint plus a narrow inset teal rail marks it without moving anything: the rail is always
        // present and only changes colour, so no row shifts by a pixel when focus arrives. The
        // control keeps its own focus ring - this marks the row, it does not replace that.
        "border-l-2 border-l-transparent focus-within:border-l-brand-primary focus-within:bg-brand-tint",
        isSelected ? "hover:bg-brand-structural" : "bg-brand-structural opacity-60"
      )}
    >
      <div className={cn("flex min-w-0 items-start gap-2", columns.parameterCellSpan)}>
        {/* No tabIndex at all: a native checkbox is already focusable, and its natural DOM
            order is exactly the order the operator reads the row in. tabIndex={-1} had made
            individual selection mouse-only - a keyboard operator could reach the bulk
            Select/Deselect control but could not deselect one optional parameter. A
            disabled checkbox (an explicitly non-selectable parameter) is excluded by the
            platform, so exclusion never has to be spelled out here.

            The ring is stated in full because focus-visible:ring-brand-focus-ring alone set
            a colour with no width and therefore painted nothing - invisible focus on a
            control that is now keyboard reachable would be worse than the old exclusion.

            The 14px box is a comfortable mouse target and a poor touch one, so below sm a
            transparent pseudo-element widens the tappable area to 34x26 around it. It hangs
            off a wrapping label rather than the checkbox. Two reasons, and both are load
            bearing: an input is a replaced element, so Firefox generates no pseudo-element
            for one and the same rule written on the input widens the target in Blink while
            doing nothing there; and only a label forwards a press to the control it wraps,
            so on a plain span the area would enlarge but stay inert. The implicit
            association also leaves the accessible name alone - the input keeps its own
            aria-label, which outranks an empty wrapping label - and a press over a disabled
            checkbox still does nothing, because that is what a native label already does. The
            insets are asymmetric and measured, not decorative: the row leaves 12px of
            padding to its left, 8px of column gap to the label, 8px above the box, and only
            4px below it before the result input begins. Expanding past any of those would
            put this target on top of a sibling and steal taps meant for the label or - with
            just 4px of clearance - for the result input itself, so each edge stops exactly
            at the empty space it is allowed to claim. That 4px is also why a full 44x44
            target is unreachable here without changing row geometry; 34x26 clears the 24px
            WCAG 2.5.8 minimum while the result inputs themselves are already 44px on touch.
            Presentation only: no tabIndex, no handler, and the checkbox keeps its 14px box. */}
        <label className="relative mt-0.5 flex shrink-0 cursor-pointer before:absolute before:-left-3 before:-right-2 before:-top-2 before:-bottom-1 before:content-[''] has-[:disabled]:cursor-not-allowed sm:mt-0 sm:before:content-none">
          <input
            type="checkbox"
            data-parameter-selector
            checked={isSelected}
            disabled={!parameter.isSelectable}
            onChange={(event) => onToggleSelect(event.target.checked)}
            className="h-3.5 w-3.5 shrink-0 cursor-pointer rounded border-brand-border-strong accent-brand-primary pointer-events-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring focus-visible:ring-offset-1 focus-visible:ring-offset-transparent disabled:cursor-not-allowed"
            aria-label={`Select parameter ${parameter.parameterName}`}
          />
        </label>
        <div className={cn("min-w-0", !isSelected && "opacity-50")}>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="block text-[13px] font-medium leading-tight text-brand-text">{parameter.parameterName}</span>
            {labelAdornment}
          </div>
          {labelHelp}
        </div>
      </div>

      <div data-control-column className={cn("min-w-0", columns.resultCellSpan, !isSelected && "pointer-events-none opacity-40")}>
        {/* A fixed suffix is part of the result expression, not a column: "0-2" is entered and
            "0-2 /HPF" is reported. With no Unit column to carry it, it sits beside the field so the
            operator still sees what will be printed, and it stays outside the editable value exactly
            as before - nothing here changes what is stored. */}
        {columns.showUnitColumn ? children : (
          <div className="flex min-w-0 items-center gap-1.5">
            <div className="min-w-0 flex-1">{children}</div>
            {parameter.suffixSpec && (
              <span data-fixed-suffix="true" className="shrink-0 font-mono text-xs text-brand-text-muted">
                {renderedUnit}
              </span>
            )}
          </div>
        )}
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

      {columns.showUnitColumn && (
        <span
          data-fixed-suffix={parameter.suffixSpec ? "true" : undefined}
          className="col-span-2 col-start-1 row-start-3 min-w-0 break-words font-mono text-xs text-brand-text-muted sm:col-span-1 sm:col-start-auto sm:row-start-auto"
        >
          {renderedUnit ? (
            <>
              {/* The column header names this cell from sm up; on a phone there is no header,
                  so the label travels with the value. Written as one text node with its colon
                  so it can never read as the bare word the header uses. */}
              <span className="sm:hidden">{"Unit: "}</span>
              {renderedUnit}
            </>
          ) : (
            ""
          )}
        </span>
      )}

      {/* Reference column, where the examination draws one. Rendered even when empty so the
          remaining cells keep their track:
          grid items are placed in source order, so omitting this element would shift Status
          into the reference track. The track is a fixed width, so an empty reference leaves
          the column empty and Status stays exactly where it is on every other row - and a long
          sex-unset reference wraps inside that width instead of widening the column and
          pushing Result and Status sideways. The per-element max-w that used to bound the
          wrap is gone: the track is the bound, and two bounds could disagree. */}
      {columns.showReferenceColumn && (
        <span className="col-span-2 col-start-1 row-start-4 min-w-0 sm:col-span-1 sm:col-start-auto sm:row-start-auto">
          {reference && (
            <span
              data-reference-display
              className="inline-block w-full whitespace-normal break-words font-mono text-xs leading-snug text-brand-text-muted"
            >
              Ref: {reference}
            </span>
          )}
        </span>
      )}

      <div
        data-status-column
        className="col-start-2 row-start-1 min-w-0 justify-self-end sm:col-start-auto sm:row-start-auto sm:justify-self-stretch"
      >
        {/* The outcome flag is the shared StatusBadge, which carries exactly the mapping this
            column used to retype by hand - Invalid solid, Abnormal/High rose, Low amber, Normal
            emerald, Entered blue, pending slate. `label` keeps the visible word: "Pending" for an
            unevaluated result, the outcome name for everything else. w-full because the track is
            already fixed, so filling it makes every badge the same width and the status column
            reads as one stripe. The text is always the primary signal. */}
        <StatusBadge
          status={outcome}
          label={status}
          className="w-auto justify-center whitespace-normal break-words px-1.5 text-center sm:w-full"
        />
      </div>
    </div>
  );
}
