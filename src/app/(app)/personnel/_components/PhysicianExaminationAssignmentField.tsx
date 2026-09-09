"use client";

import React, { useCallback, useId, useMemo, useState } from "react";
import { Search, Star } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  EXAMINATION_FAMILIES,
  MAINTAINED_EXAMINATION_COUNT,
  defaultsWithinAssignments,
  normalizeExaminationCodes,
  summarizeByFamily,
  type ExaminationFamily,
  type MaintainedExamination,
} from "./physician-examinations";

export interface PhysicianExaminationAssignmentFieldProps {
  /** The examinations this physician is assigned to. Catalogue order is imposed internally. */
  assignedCodes: readonly string[];
  /** The subset of the above this physician is the default requesting physician for. */
  defaultCodes: readonly string[];
  /**
   * Raised with the complete next state, both halves together.
   *
   * One callback rather than two, because the two halves are not independent: withdrawing an
   * assignment must take its default with it, and a caller handed two separate notifications
   * could apply one and not the other. The narrowing is done here, so a caller cannot receive a
   * default that has no assignment under it.
   */
  onAssignmentsChange: (assignedCodes: string[], defaultCodes: string[]) => void;
  /** True while the owning form's save is in flight. Every control stands down. */
  disabled?: boolean;
  /** Validation or server message about the assignment set as a whole. */
  error?: string;
}

/** The visible examinations of a family under the current filter, or null when none match. */
function filterFamily(family: ExaminationFamily, query: string): MaintainedExamination[] | null {
  if (!query) return [...family.examinations];
  const needle = query.trim().toLowerCase();
  if (!needle) return [...family.examinations];
  const matches = family.examinations.filter(
    (examination) =>
      examination.code.toLowerCase().includes(needle) ||
      examination.title.toLowerCase().includes(needle) ||
      family.label.toLowerCase().includes(needle) ||
      family.shortLabel.toLowerCase().includes(needle)
  );
  return matches.length > 0 ? matches : null;
}

/**
 * The Examination Assignments section of the physician form.
 *
 * WHAT IT IS FOR. An Administrator decides which examinations a requesting physician may be
 * chosen for, and which single physician each examination pre-selects. Seventeen examinations in
 * five families is too many for a flat list and too few to paginate, so they are grouped under
 * their family headings with a filter across the whole catalogue and a bulk control per group.
 *
 * THE ONE INVARIANT THIS COMPONENT HOLDS. A default is a property OF an assignment, never a fact
 * beside it. That is enforced twice here and neither is decoration:
 *   - the Default control of an unassigned examination is `disabled`, so it cannot be set; and
 *   - every state transition passes through `defaultsWithinAssignments`, so a default already
 *     set does not survive its assignment being withdrawn - by the row's own checkbox, by the
 *     family's Clear control, or by any future path that goes through the same helper.
 * The database holds the same shape from the other side: `is_default` lives on the assignment
 * row, so a default with no assignment has no row to sit in. NEITHER of these is the
 * authorization boundary - the server action is - and neither is a substitute for the server
 * rejecting a default it was not asked to hold.
 *
 * WHY NO CONFIRMATION ON THE DEFAULT. Setting a default displaces whichever physician held it,
 * because an examination has at most one. That is stated in the section's own text rather than
 * asked about in a dialog: it is reversible, it destroys nothing, and a prompt on every toggle
 * would train the operator to dismiss prompts.
 */
export function PhysicianExaminationAssignmentField({
  assignedCodes,
  defaultCodes,
  onAssignmentsChange,
  disabled = false,
  error,
}: PhysicianExaminationAssignmentFieldProps) {
  const [query, setQuery] = useState("");
  const fieldId = useId();
  const searchId = `${fieldId}-examination-filter`;
  const noticeId = `${fieldId}-default-notice`;
  const errorId = `${fieldId}-assignment-error`;
  const summaryId = `${fieldId}-assignment-summary`;

  const assigned = useMemo(() => new Set(normalizeExaminationCodes(assignedCodes)), [assignedCodes]);
  const defaults = useMemo(
    () => new Set(defaultsWithinAssignments(defaultCodes, assignedCodes)),
    [defaultCodes, assignedCodes]
  );

  /** Every transition funnels through here, so the narrowing cannot be skipped by a caller. */
  const commit = useCallback(
    (nextAssigned: Iterable<string>, nextDefaults: Iterable<string>) => {
      const nextAssignedCodes = normalizeExaminationCodes(Array.from(nextAssigned));
      onAssignmentsChange(
        nextAssignedCodes,
        defaultsWithinAssignments(Array.from(nextDefaults), nextAssignedCodes)
      );
    },
    [onAssignmentsChange]
  );

  const toggleAssignment = (code: string) => {
    const nextAssigned = assigned.has(code)
      ? Array.from(assigned).filter((entry) => entry !== code)
      : [...assigned, code];
    // `commit` narrows the defaults, so unassigning an examination takes its default flag with
    // it rather than leaving a default nothing backs.
    commit(nextAssigned, defaults);
  };

  const toggleDefault = (code: string) => {
    // Belt and braces. The control is disabled for an unassigned examination, but a state
    // change is not allowed to depend on a `disabled` attribute holding.
    if (!assigned.has(code)) return;
    const nextDefaults = defaults.has(code)
      ? Array.from(defaults).filter((entry) => entry !== code)
      : [...defaults, code];
    commit(assigned, nextDefaults);
  };

  const assignFamily = (codes: readonly string[]) => {
    commit([...assigned, ...codes], defaults);
  };

  const clearFamily = (codes: readonly string[]) => {
    const excluded = new Set(codes);
    commit(
      Array.from(assigned).filter((entry) => !excluded.has(entry)),
      defaults
    );
  };

  const visibleFamilies = useMemo(
    () =>
      EXAMINATION_FAMILIES.map((family) => ({ family, visible: filterFamily(family, query) })).filter(
        (entry): entry is { family: ExaminationFamily; visible: MaintainedExamination[] } =>
          entry.visible !== null
      ),
    [query]
  );

  const assignedCount = assigned.size;
  const defaultCount = defaults.size;
  const familySummary = summarizeByFamily(Array.from(assigned));

  return (
    <section
      aria-labelledby={`${fieldId}-heading`}
      className="rounded-lg border border-brand-border bg-brand-card"
    >
      <div className="border-b border-brand-border bg-brand-structural px-3.5 py-2.5">
        <h3
          id={`${fieldId}-heading`}
          className="text-[12px] font-semibold leading-tight text-brand-navy"
        >
          Examination Assignments
        </h3>
        <p id={noticeId} className="mt-1 text-[11px] leading-relaxed text-brand-text-muted">
          Assign the examinations this physician may be selected for. Marking an assigned
          examination as <span className="font-semibold">Default</span> makes this physician the one
          pre-selected when that examination is encoded, and replaces whichever physician is the
          default for it now. An examination has at most one default, and only an assigned
          examination can carry one.
        </p>
      </div>

      <div className="space-y-3 px-3.5 py-3">
        <p id={summaryId} className="text-[11px] text-brand-text-muted">
          <span className="font-semibold tabular-nums text-brand-text">{assignedCount}</span> of{" "}
          <span className="font-semibold tabular-nums text-brand-text">
            {MAINTAINED_EXAMINATION_COUNT}
          </span>{" "}
          examinations assigned
          {defaultCount > 0 && (
            <>
              {" · default for "}
              <span className="font-semibold tabular-nums text-brand-text">{defaultCount}</span>
            </>
          )}
          {familySummary && <span className="sr-only">. {familySummary}.</span>}
        </p>

        {/* The label is written out rather than passed to Input because the search icon has to
            be positioned against the control alone. The classes are the primitive's. */}
        <div className="min-w-0">
          <label
            htmlFor={searchId}
            className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-brand-text-muted"
          >
            Filter examinations
          </label>
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-text-subtle"
            />
            <Input
              id={searchId}
              type="search"
              placeholder="Examination name or code"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              disabled={disabled}
              className="pl-9"
            />
          </div>
        </div>

        {error && (
          <p id={errorId} role="alert" className="text-[11px] font-medium text-brand-danger">
            {error}
          </p>
        )}

        {visibleFamilies.length === 0 ? (
          <p className="rounded-md border border-brand-border-subtle bg-brand-structural px-3 py-2.5 text-[11px] text-brand-text-muted">
            No maintained examination matches that filter. Clear the filter to see all{" "}
            {MAINTAINED_EXAMINATION_COUNT}.
          </p>
        ) : (
          <div className="space-y-2.5">
            {visibleFamilies.map(({ family, visible }) => {
              const visibleCodes = visible.map((examination) => examination.code);
              const assignedInFamily = visibleCodes.filter((code) => assigned.has(code)).length;
              const allAssigned = assignedInFamily === visibleCodes.length;
              const noneAssigned = assignedInFamily === 0;
              return (
                <fieldset
                  key={family.id}
                  className="rounded-md border border-brand-border-subtle"
                  disabled={disabled}
                >
                  <legend className="sr-only">{family.label} examinations</legend>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-border-subtle bg-brand-structural px-3 py-2">
                    <span
                      aria-hidden="true"
                      className="text-[10px] font-semibold uppercase tracking-[0.08em] text-brand-text-muted"
                    >
                      {family.label}
                      <span className="ml-2 font-normal normal-case tracking-normal tabular-nums">
                        {assignedInFamily}/{visibleCodes.length}
                      </span>
                    </span>
                    {/* Bulk controls act on what is visible under the current filter, never on
                        examinations the operator cannot see. Offered only where they change
                        something: an already-complete family needs no Select all. */}
                    <div className="flex shrink-0 items-center gap-1.5">
                      {!allAssigned && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => assignFamily(visibleCodes)}
                          className="min-h-11 sm:min-h-8"
                          aria-label={`Assign every shown ${family.label} examination`}
                        >
                          Select all
                        </Button>
                      )}
                      {!noneAssigned && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => clearFamily(visibleCodes)}
                          className="min-h-11 sm:min-h-8"
                          aria-label={`Unassign every shown ${family.label} examination`}
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                  </div>

                  <ul className="divide-y divide-brand-border-subtle">
                    {visible.map((examination) => {
                      const isAssigned = assigned.has(examination.code);
                      const isDefault = defaults.has(examination.code);
                      const assignInputId = `${fieldId}-assign-${examination.code}`;
                      const defaultInputId = `${fieldId}-default-${examination.code}`;
                      return (
                        <li
                          key={examination.code}
                          className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-3 py-2"
                        >
                          <div className="flex min-w-0 flex-1 items-start gap-2.5">
                            <input
                              id={assignInputId}
                              type="checkbox"
                              checked={isAssigned}
                              onChange={() => toggleAssignment(examination.code)}
                              className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-brand-border-strong accent-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed"
                            />
                            <label
                              htmlFor={assignInputId}
                              // `min-h-6` (24px) with the text centred: the 16px checkbox alone is
                              // below the WCAG 2.5.8 minimum target, and the label is what a finger
                              // actually lands on. Height only - the label already spans the row's
                              // width, so nothing moves on the desktop layout.
                              className="flex min-h-6 min-w-0 cursor-pointer items-center text-[12px] leading-snug text-brand-text"
                            >
                              <span className="font-medium">{examination.title}</span>
                              <span className="ml-1.5 font-mono text-[10px] uppercase text-brand-text-subtle">
                                {examination.code}
                              </span>
                            </label>
                          </div>

                          <div className="flex shrink-0 items-center gap-2">
                            {isDefault && (
                              <Star
                                aria-hidden="true"
                                className="h-3.5 w-3.5 fill-brand-warning text-brand-warning"
                              />
                            )}
                            <input
                              id={defaultInputId}
                              type="checkbox"
                              checked={isDefault}
                              // The invariant, stated as an attribute: an examination that is not
                              // assigned cannot be given a default, so the control is not offered
                              // in a usable state at all.
                              disabled={disabled || !isAssigned}
                              onChange={() => toggleDefault(examination.code)}
                              aria-describedby={noticeId}
                              aria-label={
                                isAssigned
                                  ? `Make this physician the default for ${examination.title}`
                                  : `Default for ${examination.title} is unavailable until the examination is assigned`
                              }
                              className="h-4 w-4 shrink-0 cursor-pointer rounded border-brand-border-strong accent-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
                            />
                            <label
                              htmlFor={defaultInputId}
                              className={[
                                // Same 24px floor as the assign label. `-my-1` keeps the taller
                                // target from changing the row's height, so no examination row
                                // grows and the scroll geometry proved at both viewports holds.
                                "-my-1 flex min-h-6 items-center py-1 text-[11px] font-medium",
                                isAssigned
                                  ? "cursor-pointer text-brand-text-muted"
                                  : "cursor-not-allowed text-brand-text-subtle",
                              ].join(" ")}
                            >
                              Default
                            </label>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </fieldset>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
