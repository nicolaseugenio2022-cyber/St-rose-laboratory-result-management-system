import type { ClinicalReportDefinition } from "@/domain/types/report-definition";

/**
 * Which columns the Encoding worksheet draws for one examination, and the geometry that draws them.
 *
 * ONE DECLARATION, ONE RESOLUTION. The examination declares what it omits, on its definition
 * (`encodingWorksheet`), and this is the only place that reads it. No component branches on a
 * template code, and no second copy of "does this examination show a unit" exists to drift.
 *
 * ENCODING ONLY. This governs the worksheet the operator types into. It changes no stored unit, no
 * reference rule, no validation, no evaluation, and nothing in Live Preview, Print, PDF or a
 * completed snapshot - all of which keep reading the parameter's own declared `unit`, `suffixSpec`
 * and `referenceRule` exactly as before.
 *
 * WHY THE TRACKS LIVE HERE TOO. Each row is its own independent grid, so the header and every row
 * must be laid out from the same literal track list or independent grids cannot align (see the
 * fixed-track reasoning below). The tracks and the column set are therefore one decision, resolved
 * once, rather than a column flag in one module and a width string in another.
 */
export interface WorksheetColumnPolicy {
  showUnitColumn: boolean;
  showReferenceColumn: boolean;
  /** `grid-template-columns` utilities for the header AND every row, at every breakpoint. */
  rowTracks: string;
  /** The Parameter cell's span, which differs with the narrow-viewport track count. */
  parameterCellSpan: string;
  /** The Result cell's span, likewise. */
  resultCellSpan: string;
}

/**
 * **Every track is fixed, and that is the whole point.** Each row is an independent grid, so a
 * content-sized track (`auto`, `minmax(_,auto)`, `min-content`) is resolved separately per row
 * against that row's own content: a row whose unit read "x10³/µL" resolved a wider Unit track than
 * one reading "%", and every column after it - including the Result input - started at a different
 * x position. Nothing but identical, content-independent track sizes can align independent grids.
 *
 * Parameter alone is `minmax(0,1fr)`: it is the only flexible track, it absorbs all remaining
 * width, and a `1fr` resolves from the container - which every row shares - not from content. The 0
 * minimum lets a long parameter name wrap rather than force the row past the card.
 *
 * Narrow: two tracks only - a flexible one for the parameter and an auto one for the status flag,
 * which sits beside the name it belongs to. Result, Unit and Reference each take the full width on
 * their own line beneath. The previous narrow set put Unit | Reference | Status on one shared line
 * below the input, which read as three detached fragments and wrapped a compound unit such as
 * "x 10^12/L" across two of those cells.
 */
const FULL_COLUMN_TRACKS =
  "grid-cols-[minmax(0,1fr)_auto] " +
  "sm:grid-cols-[minmax(0,1fr)_9rem_3.25rem_6rem_6rem] " +
  "lg:grid-cols-[minmax(0,1fr)_11rem_4rem_9rem_6.5rem] " +
  "xl:grid-cols-[minmax(0,1fr)_14rem_4.5rem_12rem_7rem]";

/**
 * Parameter | Result | Status. The Unit and Reference tracks are GONE, not emptied: an omitted
 * column reserves no width at any breakpoint, so Result takes the space the two of them held
 * instead of the row carrying two blank gutters.
 *
 * Narrow: the same two tracks the full variant uses, so a reference-free examination and a
 * reference-bearing one present a parameter identically on a phone.
 */
const RESULT_ONLY_COLUMN_TRACKS =
  "grid-cols-[minmax(0,1fr)_auto] " +
  "sm:grid-cols-[minmax(0,1fr)_9rem_6rem] " +
  "lg:grid-cols-[minmax(0,1fr)_11rem_6.5rem] " +
  "xl:grid-cols-[minmax(0,1fr)_14rem_7rem]";

export const FULL_WORKSHEET_COLUMNS: WorksheetColumnPolicy = {
  showUnitColumn: true,
  showReferenceColumn: true,
  rowTracks: FULL_COLUMN_TRACKS,
  parameterCellSpan: "col-start-1 row-start-1 sm:col-span-1 sm:col-start-auto sm:row-start-auto",
  resultCellSpan: "col-span-2 col-start-1 row-start-2 sm:col-span-1 sm:col-start-auto sm:row-start-auto",
};

const RESULT_ONLY_WORKSHEET_COLUMNS: WorksheetColumnPolicy = {
  showUnitColumn: false,
  showReferenceColumn: false,
  rowTracks: RESULT_ONLY_COLUMN_TRACKS,
  parameterCellSpan: "col-start-1 row-start-1 sm:col-span-1 sm:col-start-auto sm:row-start-auto",
  resultCellSpan: "col-span-2 col-start-1 row-start-2 sm:col-span-1 sm:col-start-auto sm:row-start-auto",
};

/**
 * The worksheet column policy for an examination.
 *
 * FAIL CLOSED ON AN UNDECLARED GEOMETRY. Exactly two column sets have declared tracks, because
 * Tailwind generates a `grid-cols-[…]` utility only from a literal class string - a set composed at
 * runtime would produce no CSS at all and silently collapse the grid. Omitting exactly one of the
 * two columns is therefore rejected here rather than rendered against tracks nobody declared.
 */
export function resolveWorksheetColumnPolicy(definition: ClinicalReportDefinition): WorksheetColumnPolicy {
  const omitted = definition.encodingWorksheet?.omitColumns ?? [];
  const showUnitColumn = !omitted.includes("Unit");
  const showReferenceColumn = !omitted.includes("Reference");
  if (showUnitColumn && showReferenceColumn) return FULL_WORKSHEET_COLUMNS;
  if (!showUnitColumn && !showReferenceColumn) return RESULT_ONLY_WORKSHEET_COLUMNS;
  throw new Error(
    `Encoding worksheet for '${definition.templateCode}' omits one of Unit/Reference; only both or neither has declared column tracks.`
  );
}
