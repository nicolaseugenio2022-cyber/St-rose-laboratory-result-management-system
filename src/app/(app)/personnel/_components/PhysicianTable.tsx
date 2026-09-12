import React from "react";
import { AlertCircle, Edit2, Power, Star, Stethoscope, Trash2 } from "lucide-react";
import type { PhysicianDirectoryEntry } from "@/features/physicians/physician-directory-entry";
import type { RowError, RowWrite } from "./PersonnelTable";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  NO_EXAMINATION_ASSIGNMENTS,
  listExaminationTitles,
  sortExaminationCodes,
  summarizeByFamily,
  tallyByFamily,
  type PhysicianExaminationAssignments,
} from "./physician-examinations";

export interface PhysicianTableProps {
  physicians: readonly PhysicianDirectoryEntry[];
  canManage: boolean;
  /**
   * Assignment state keyed by physician id. A physician absent from this map is UNASSIGNED, and
   * is shown as such - the absence of a key is never rendered as a blank cell, because a blank
   * cell reads as "not loaded" rather than "nothing assigned".
   */
  assignmentsByPhysicianId?: Readonly<Record<string, PhysicianExaminationAssignments>>;
  onEdit: (physician: PhysicianDirectoryEntry) => void;
  onToggleStatus: (physician: PhysicianDirectoryEntry) => void;
  /** Opens the permanent-deletion confirmation. Offered for inactive records only. */
  onDelete: (physician: PhysicianDirectoryEntry) => void;
  busyPhysicianId?: string | null;
  /** Which write the busy record is waiting on, so only that control shows pending feedback. */
  busyAction?: RowWrite | null;
  /** A refusal or failure that belongs to one record, shown on that record. */
  rowError?: RowError | null;
  /** True when a search or filter is narrowing the list, so "nothing here" can be phrased honestly. */
  isFiltered?: boolean;
  onClearFilters?: () => void;
}

/**
 * An assignment set, small enough for a table cell at any width.
 *
 * THE PROBLEM THIS SOLVES. A physician may be assigned to as many as seventeen examinations.
 * Seventeen codes inline is a cell that pushes the table into a horizontal scroll on a laptop,
 * and the first thing an operator loses in a horizontally scrolling table is the row they were
 * reading. So the cell shows a TALLY - at most five family chips, in practice one or two - and
 * every one of them wraps.
 *
 * THREE READINGS, NOT ONE. The chips abbreviate ("Chemistry" for Clinical Chemistry), so the
 * abbreviation is never the only form available:
 *   - the chips are the glanceable form, and are hidden from assistive technology;
 *   - an `sr-only` sentence spells the same tally out with the FULL family names, so a screen
 *     reader gets the summary rather than a row of abbreviations; and
 *   - a native `<details>` disclosure lists every examination by its printed title. It is
 *     keyboard reachable, it needs no JavaScript and no hover, and it is the full detail - a
 *     tooltip would be none of those things.
 *
 * A small set is listed by code instead of tallied. "CBC, ESR" says more than "Hematology 2",
 * and at that size it costs no width.
 */
function ExaminationSummary({
  codes,
  emptyLabel,
  /** Names what this set IS, for the screen-reader sentence: "Assigned examinations", etc. */
  label,
  subject,
  accent,
}: {
  codes: readonly string[];
  emptyLabel: string;
  label: string;
  /** The physician the set belongs to, so a disclosure is unambiguous out of row context. */
  subject: string;
  accent: "blue" | "warning";
}) {
  if (codes.length === 0) {
    return (
      <Badge variant="neutral" size="sm">
        {emptyLabel}
      </Badge>
    );
  }

  const orderedCodes = sortExaminationCodes(codes);
  const titles = listExaminationTitles(codes);
  const listInFull = orderedCodes.length <= 3;

  return (
    <div className="min-w-0 space-y-1">
      <span className="sr-only">
        {label} for {subject}: {summarizeByFamily(codes)}.
      </span>
      <div aria-hidden="true" className="flex flex-wrap items-center gap-1">
        {listInFull
          ? orderedCodes.map((code) => (
              <Badge key={code} variant={accent} size="sm">
                {code}
              </Badge>
            ))
          : tallyByFamily(codes).map((tally) => (
              <Badge key={tally.familyId} variant={accent} size="sm">
                {tally.shortLabel} ×{tally.count}
              </Badge>
            ))}
      </div>
      <details className="min-w-0">
        <summary className="cursor-pointer text-[11px] text-brand-text-muted underline-offset-2 outline-none hover:text-brand-navy hover:underline focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-brand-focus-ring">
          {label}: {titles.length} in full
        </summary>
        <ul className="mt-1 space-y-0.5 pl-1">
          {titles.map((title) => (
            <li key={title} className="break-words text-[11px] leading-snug text-brand-text-muted">
              {title}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

/**
 * The row actions, shared by the desktop row and the narrow-width record.
 *
 * One component rather than two copies, for the same reason the personnel table keeps one: a
 * second copy is where a visible label and its accessible name silently drift apart. The tiers
 * match that table exactly - Edit the neutral outline, the status toggle a quiet ghost tinted
 * warning for the withdrawing action and success for the restoring one, Delete the destructive
 * fill - so the same operation reads the same way in both sections of this page.
 *
 * Deactivation is the ordinary withdrawal. Delete exists only on an INACTIVE physician, and the
 * server refuses it while any examination assignment remains or any laboratory report names the
 * physician, so a historical report keeps the requesting-physician name it was issued with.
 */
function RowActions({
  physician,
  busyAction,
  isDisabled,
  onEdit,
  onToggleStatus,
  onDelete,
  errorMessage,
  layout,
}: {
  physician: PhysicianDirectoryEntry;
  /** The write this record is waiting on, if any. Only that control shows pending feedback. */
  busyAction: RowWrite | null;
  /** Some record is being written. Every row's actions stand down until it settles. */
  isDisabled: boolean;
  onEdit: (physician: PhysicianDirectoryEntry) => void;
  onToggleStatus: (physician: PhysicianDirectoryEntry) => void;
  onDelete: (physician: PhysicianDirectoryEntry) => void;
  /** Why the last write against this record did not happen. */
  errorMessage: string | null;
  layout: "row" | "record";
}) {
  const name = physician.fullName;
  const activateVerb = physician.isActive ? "Deactivate" : "Activate";
  const isRecord = layout === "record";
  const isToggling = busyAction === "toggle";
  const isDeleting = busyAction === "delete";
  // The record layout is rendered only below lg, where the pointer is a finger: its controls
  // keep a 44px target rather than the 32px a size="sm" Button gives a mouse.
  const touch = isRecord ? "min-h-11 flex-1" : "min-h-11 sm:min-h-8";
  return (
    <div className={isRecord ? "space-y-1.5" : "space-y-1"}>
      <div
        role="group"
        aria-label={`Actions for ${name}`}
        className={
          isRecord
            ? "flex items-center gap-2"
            : "flex items-center justify-end gap-1.5"
        }
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() => onEdit(physician)}
          disabled={isDisabled}
          className={touch}
          aria-label={`Edit ${name}`}
        >
          <Edit2 aria-hidden="true" className="h-3.5 w-3.5" />
          Edit
        </Button>
        {/* The shared soft status variants carry what these two colour pairs used to state
            inline, and they state it at rest rather than only under a pointer. */}
        <Button
          variant={physician.isActive ? "warning" : "success"}
          size="sm"
          onClick={() => onToggleStatus(physician)}
          disabled={isDisabled}
          isLoading={isToggling}
          aria-label={`${activateVerb} ${name}`}
          className={touch}
        >
          {!isToggling && <Power aria-hidden="true" className="h-3.5 w-3.5" />}
          {activateVerb}
        </Button>
        {!physician.isActive && (
          <Button
            variant="danger"
            size="sm"
            onClick={() => onDelete(physician)}
            disabled={isDisabled}
            isLoading={isDeleting}
            aria-label={`Delete ${name}`}
            className={touch}
          >
            {!isDeleting && <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />}
            Delete
          </Button>
        )}
      </div>
      {errorMessage && (
        <p
          role="alert"
          className={[
            "flex items-start gap-1.5 text-[11px] leading-snug text-brand-danger",
            isRecord ? "" : "ml-auto max-w-72 text-left",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <AlertCircle aria-hidden="true" className="mt-px h-3.5 w-3.5 shrink-0" />
          <span>{errorMessage}</span>
        </p>
      )}
    </div>
  );
}

export function PhysicianTable({
  physicians,
  canManage,
  assignmentsByPhysicianId,
  onEdit,
  onToggleStatus,
  onDelete,
  busyPhysicianId,
  busyAction = null,
  rowError = null,
  isFiltered = false,
  onClearFilters,
}: PhysicianTableProps) {
  if (physicians.length === 0) {
    // The two empty cases are different problems and deserve different sentences: an unfiltered
    // directory is genuinely empty and wants the create action, while a filtered one is intact
    // and wants the filters cleared.
    return isFiltered ? (
      <EmptyState
        icon={Stethoscope}
        headingLevel={3}
        title="No physicians match these filters"
        description="No physician record matches the current search or status selection."
        action={
          onClearFilters ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onClearFilters}
              className="min-h-11 sm:min-h-8"
            >
              Clear filters
            </Button>
          ) : undefined
        }
      />
    ) : (
      <EmptyState
        icon={Stethoscope}
        headingLevel={3}
        title="No physicians on file"
        description={
          canManage
            ? "Add the requesting physicians whose names print on laboratory reports."
            : "No requesting physician has been registered in this directory yet."
        }
      />
    );
  }

  // One row mutation at a time. While any record is being written every row's actions stand
  // down, because a second toggle fired against the stale list would be reconciled away by the
  // refresh the first one is still waiting on. Pending feedback stays on the busy record only.
  const isAnyRowBusy = busyPhysicianId != null;
  const busyActionFor = (id: string): RowWrite | null =>
    busyPhysicianId === id ? busyAction : null;
  const errorFor = (id: string): string | null => (rowError?.id === id ? rowError.message : null);

  const assignmentsFor = (physicianId: string): PhysicianExaminationAssignments =>
    assignmentsByPhysicianId?.[physicianId] ?? NO_EXAMINATION_ASSIGNMENTS;

  return (
    <>
      {/* Desktop and tablet: a real table. Narrow widths get the record list below instead. */}
      <div className="hidden lg:block">
        <Table striped>
          <TableHeader>
            <TableRow>
              <TableHead>Physician</TableHead>
              <TableHead>Assigned examinations</TableHead>
              <TableHead>Default for</TableHead>
              <TableHead>Status</TableHead>
              {canManage && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {physicians.map((physician) => {
              const isBusy = busyPhysicianId === physician.id;
              const assignments = assignmentsFor(physician.id);
              return (
                <TableRow
                  key={physician.id}
                  aria-busy={isBusy || undefined}
                  className={[
                    isBusy ? "opacity-60" : "",
                    physician.isActive ? "" : "text-brand-text-muted",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <TableCell>
                    {/* The name prints verbatim on a report, so it is shown verbatim here -
                        never re-ordered into a surname-first form the report does not use. */}
                    <div className="font-semibold text-brand-text">{physician.fullName}</div>
                  </TableCell>
                  <TableCell className="align-top">
                    <ExaminationSummary
                      codes={assignments.assignedCodes}
                      emptyLabel="Unassigned"
                      label="Assigned examinations"
                      subject={physician.fullName}
                      accent="blue"
                    />
                  </TableCell>
                  <TableCell className="align-top">
                    <ExaminationSummary
                      codes={assignments.defaultCodes}
                      emptyLabel="No default"
                      label="Default examinations"
                      subject={physician.fullName}
                      accent="warning"
                    />
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      status={physician.isActive ? "Active" : "Inactive"}
                      size="sm"
                    />
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-right align-top">
                      <RowActions
                        physician={physician}
                        busyAction={busyActionFor(physician.id)}
                        isDisabled={isAnyRowBusy}
                        onEdit={onEdit}
                        onToggleStatus={onToggleStatus}
                        onDelete={onDelete}
                        errorMessage={errorFor(physician.id)}
                        layout="row"
                      />
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Narrow widths: one record per physician, carrying every fact the row carries. The two
          assignment facts become a description list rather than columns, so nothing has to be
          scrolled sideways to be read. */}
      <ul className="space-y-2 lg:hidden">
        {physicians.map((physician) => {
          const isBusy = busyPhysicianId === physician.id;
          const assignments = assignmentsFor(physician.id);
          return (
            <li
              key={physician.id}
              aria-busy={isBusy || undefined}
              className={[
                "overflow-hidden rounded-lg border border-brand-border bg-brand-card shadow-low",
                isBusy ? "opacity-60" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <div className="px-3.5 py-2.5">
                {/* The name wraps rather than truncates. A clipped name is the single thing that
                    makes an Edit or Deactivate press ambiguous. */}
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 break-words text-[13px] font-semibold leading-snug text-brand-text">
                    {physician.fullName}
                  </p>
                  <StatusBadge
                    status={physician.isActive ? "Active" : "Inactive"}
                    size="sm"
                    className="shrink-0"
                  />
                </div>

                <dl className="mt-2.5 space-y-2">
                  <div className="min-w-0">
                    <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-brand-text-subtle">
                      Assigned examinations
                    </dt>
                    <dd className="mt-1 min-w-0">
                      <ExaminationSummary
                        codes={assignments.assignedCodes}
                        emptyLabel="Unassigned"
                        label="Assigned examinations"
                        subject={physician.fullName}
                        accent="blue"
                      />
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-brand-text-subtle">
                      <Star aria-hidden="true" className="h-3 w-3" />
                      Default for
                    </dt>
                    <dd className="mt-1 min-w-0">
                      <ExaminationSummary
                        codes={assignments.defaultCodes}
                        emptyLabel="No default"
                        label="Default examinations"
                        subject={physician.fullName}
                        accent="warning"
                      />
                    </dd>
                  </div>
                </dl>
              </div>

              {canManage && (
                <div className="border-t border-brand-border bg-brand-structural px-3.5 py-2">
                  <RowActions
                    physician={physician}
                    busyAction={busyActionFor(physician.id)}
                    isDisabled={isAnyRowBusy}
                    onEdit={onEdit}
                    onToggleStatus={onToggleStatus}
                    onDelete={onDelete}
                    errorMessage={errorFor(physician.id)}
                    layout="record"
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
