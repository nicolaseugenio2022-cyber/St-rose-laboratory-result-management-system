"use client";

import React from "react";
import { Edit3, Eye, Trash2 } from "lucide-react";
import type { PatientReportSessionAggregate } from "@/domain/models/patient-report-session-aggregate";

/**
 * Shared History row/card action surface.
 *
 * This component is the single place where History decides WHICH actions a session may offer.
 * Both responsive renderings consume it, so there is one authorization path rather than two
 * duplicated gates that can drift apart.
 *
 * It reads the server-decided `entry.canReopen` itself rather than accepting a caller-derived
 * boolean, so a caller cannot substitute its own eligibility. The import graph is deliberately
 * free of server actions and `server-only` so the shipped component can be rendered directly by
 * checkpoint verification.
 */

export type HistorySessionEntry = {
  session: PatientReportSessionAggregate;
  canReopen: boolean;
};

export type HistorySessionActionsVariant = "table" | "card";

export interface HistorySessionActionsProps {
  entry: HistorySessionEntry;
  variant: HistorySessionActionsVariant;
  isDeleting: boolean;
  onPreview: (session: PatientReportSessionAggregate) => void;
  onReopen: (session: PatientReportSessionAggregate) => void;
  onDeleteDraft: (entry: HistorySessionEntry) => void;
}

export function HistorySessionActions({
  entry,
  variant,
  isDeleting,
  onPreview,
  onReopen,
  onDeleteDraft,
}: HistorySessionActionsProps) {
  const { session, canReopen } = entry;
  const isCompleted = session.status === "Completed";

  // Authorization, stated once for both renderings:
  //  - Preview is always offered.
  //  - Replace/Edit requires the server-decided canReopen.
  //  - Delete draft additionally requires the session to still be a Draft, so a Completed
  //    session never offers removal regardless of ownership.
  const mayReopen = canReopen;
  const mayDeleteDraft = !isCompleted && canReopen;

  const isCard = variant === "card";
  // Table controls share one height so they sit on a single baseline; the emphasis difference is
  // carried by surface (bordered / ghost / icon-only), not by differing geometry.
  const previewClass = isCard
    ? "inline-flex min-h-[2.25rem] items-center gap-1.5 rounded border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
    : "inline-flex h-8 items-center gap-1.5 rounded border border-slate-300 bg-slate-100 px-2 xl:px-2.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring";
  // Table variant carries three actions in one cell. They share one shape language - same height,
  // radius and padding rhythm - so they read as a single group, and emphasis is carried by fill:
  // Preview alone is filled, Replace/Edit is outlined, Delete draft is outlined and icon-only.
  // The fill must contrast with the row: a white fill on a white row is invisible, which left
  // Preview and Replace/Edit distinguishable only by one border shade.
  // Every control keeps a visible resting border, so interactivity never depends on colour alone.
  const reopenClass = isCard
    ? "inline-flex min-h-[2.25rem] items-center gap-1.5 rounded border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-brand-primary transition-colors hover:bg-blue-100"
    : "inline-flex h-8 items-center gap-1.5 rounded border border-slate-200 px-2 xl:px-2.5 text-xs font-semibold text-brand-primary transition-colors hover:border-blue-200 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring";
  // Icon-only in the table: 32x32 clears the WCAG 2.5.8 target-size minimum, the trash glyph
  // carries the destructive meaning by shape rather than by colour, and the accessible name is
  // supplied explicitly below.
  const deleteClass = isCard
    ? "inline-flex min-h-[2.25rem] items-center gap-1.5 rounded px-2 py-2 text-xs font-semibold text-slate-500 transition-colors hover:text-brand-danger disabled:opacity-60"
    : "inline-flex h-8 w-8 items-center justify-center rounded border border-slate-200 text-slate-500 transition-colors hover:border-brand-danger-border hover:bg-brand-danger-bg hover:text-brand-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring disabled:opacity-60";
  const iconSize = isCard ? "h-4 w-4" : "h-3.5 w-3.5";
  // Between lg and xl the shell leaves the table roughly 720px, so the labelled controls do
  // not fit. They collapse to icons there; the text stays in the DOM for assistive tech.
  const labelClass = isCard ? "" : "hidden xl:inline";

  const primaryActions = (
    <>
      <button
        type="button"
        onClick={() => onPreview(session)}
        className={previewClass}
        aria-label="Preview"
        title="Preview"
      >
        <Eye className={`${iconSize} text-slate-500`} aria-hidden="true" />
        <span className={labelClass}>Preview</span>
      </button>
      {mayReopen && (
        <button
          type="button"
          onClick={() => onReopen(session)}
          className={reopenClass}
          aria-label={isCompleted ? "Replace" : "Edit"}
          title={isCompleted ? "Replace" : "Edit"}
        >
          <Edit3 className={iconSize} aria-hidden="true" />
          <span className={labelClass}>{isCompleted ? "Replace" : "Edit"}</span>
        </button>
      )}
    </>
  );

  const deleteAction = mayDeleteDraft ? (
    <button
      type="button"
      onClick={() => onDeleteDraft(entry)}
      disabled={isDeleting}
      className={deleteClass}
      // The table variant renders no visible label, so the accessible name is supplied here.
      // `title` gives sighted pointer users the same wording, keeping the control discoverable.
      aria-label={isCard ? undefined : "Delete draft"}
      title={isCard ? undefined : "Delete draft"}
    >
      {/* Slightly larger glyph in the table: it is the control's only visible content. */}
      <Trash2 className="h-4 w-4" aria-hidden="true" />
      {isCard ? "Delete draft" : null}
    </button>
  ) : null;

  if (!isCard) {
    // One nowrap row, left-aligned. Right-aligning made Preview land at a different x on every
    // row depending on how many actions that row had, which broke the vertical scan line.
    return (
      <div className="flex items-center justify-start gap-1.5 whitespace-nowrap">
        {primaryActions}
        {deleteAction}
      </div>
    );
  }

  // Card layout keeps the destructive action out of the primary action row; the strong
  // destructive framing lives in the confirmation dialog, not here.
  return (
    <>
      <div className="flex flex-wrap gap-2 pt-1">{primaryActions}</div>
      {deleteAction && <div className="border-t border-slate-100 pt-2">{deleteAction}</div>}
    </>
  );
}
