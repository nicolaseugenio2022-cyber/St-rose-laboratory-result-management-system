import React, { useEffect, useMemo, useState } from "react";
import { RequestedByPolicySpec } from "@/domain/types/report-definition";
import { listWorkspacePhysiciansAction } from "../_actions/workspace-physician-actions";
import { fieldLabelClassName, fieldSurfaceClassName } from "@/components/ui/Input";
import { resolveAssignedSuggestions, type WorkspacePhysicianAssignment } from "../_lib/encoding/physician-suggestions";
import { cn } from "@/lib/utils";
import { Stethoscope } from "lucide-react";

/**
 * Requested By, per examination.
 *
 * A free-text combobox, never a closed select: the roster below is a set of suggestions, and the
 * operator may type any physician over them - including one the laboratory has not added to its
 * directory - or leave the field blank. The value is held on this report's `encodingData`, so two
 * examinations in one session can be requested by different doctors.
 *
 * The suggestions are this examination's physician assignments, held in the database and passed in
 * by the Workspace: the assignment set decides who is offered here, and a separate flag on it
 * decides who a NEW report starts at. Nothing is learned from prior operator entries any more, so
 * the list is the same on a brand-new laboratory as on one that has encoded for a year.
 *
 * Until that assignment arrives the control falls back to the managed directory, fetched once
 * through the Workspace's own server-action boundary and narrowed by whatever this report's
 * definition declared (see physician-suggestions). The fallback exists so the first paint, and a
 * failed assignment read, still offer the operator something to pick from.
 *
 * `<datalist>` is deliberately kept rather than replaced with a custom listbox: the browser's own
 * combobox already filters the roster down as the operator types, on every platform, with the
 * native keyboard model - and it degrades to a plain text field rather than to nothing. A
 * directory outage falls back to an empty roster, never to a blocked field.
 */
export function RequestedBySection({ policy, assignment, directory: providedDirectory, value, onChange }: {
  policy: RequestedByPolicySpec;
  /**
   * This examination's database assignment, or null/undefined while it has not been read. Absent
   * selects the declarative fallback; an assignment with an empty list is an answer, and offers
   * nobody.
   */
  assignment?: WorkspacePhysicianAssignment | null;
  /**
   * The fallback roster, when the Workspace has already read it (CLINIC-PERF-01).
   *
   * The Workspace now receives the physician directory during its SERVER render, so by the time
   * this control mounts the same list is already in memory. Passing it down is the same list, not
   * a copy of a different read: it is `listActivePhysiciansAction` mapped to `fullName`, which is
   * precisely what `listWorkspacePhysiciansAction` below returns. Undefined means the Workspace
   * has no roster to give - a server bootstrap failure, or any other caller - and the fetch below
   * runs unchanged, through the same guarded boundary it always used.
   */
  directory?: readonly string[];
  value: string;
  onChange: (value: string) => void;
}) {
  const [directory, setDirectory] = useState<string[]>([]);
  useEffect(() => {
    if (providedDirectory) return; // the Workspace already read the directory server-side
    let active = true;
    listWorkspacePhysiciansAction()
      .then((names) => {
        if (active) setDirectory(names);
      })
      .catch(() => {
        if (active) setDirectory([]);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const roster = providedDirectory ?? directory;
  const allowedPhysicians = policy.allowedPhysicians;
  const suggestions = useMemo(
    () => resolveAssignedSuggestions(assignment, roster, { allowedPhysicians }),
    [assignment, roster, allowedPhysicians],
  );
  const listId = `requested-by-${policy.fieldLabel || "physician"}`.replace(/\W+/g, "-").toLowerCase();

  return (
    // No frame of its own. The enclosing setup band already separates this from the
    // results, and a bordered card here made the report card a card inside a card.
    <section className="max-w-lg" data-requested-by-section>
      <label className={cn(fieldLabelClassName, "mb-1.5")} htmlFor={listId}>
        {policy.fieldLabel || "Requested By"}{policy.isRequired && <span className="text-brand-danger"> *</span>}
      </label>
      <div className="relative">
        {/* The shared field surface rather than a retyped copy of it, so this control keeps the
            same geometry, states and focus indicator as every other field in the system. */}
        <input
          data-slot="input"
          id={listId}
          list={`${listId}-options`}
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          readOnly={!policy.isEditable}
          required={policy.isRequired}
          data-requested-by-input
          data-encoding-input
          autoComplete="off"
          placeholder="Search or type a physician..."
          // w-full, because the stethoscope is positioned against this field's WRAPPER. Without
          // it the input took its intrinsic text-input width - about 225px inside a 327px band on
          // a phone - and the icon sat alone in the ~100px of empty space to its right, detached
          // from the control it belongs to. The max-w-lg on the section still caps it on a desk.
          className={cn(fieldSurfaceClassName, "block w-full border placeholder:text-slate-500", "pr-9")}
        />
        <Stethoscope aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-brand-text-subtle" />
        <datalist id={`${listId}-options`}>
          {suggestions.map((item) => <option key={item} value={item} />)}
        </datalist>
      </div>
    </section>
  );
}
