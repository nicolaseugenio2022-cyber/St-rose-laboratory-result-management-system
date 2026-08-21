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
  const previewClass = isCard
    ? "inline-flex min-h-[2.25rem] items-center gap-1.5 rounded border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
    : "inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors";
  const reopenClass = isCard
    ? "inline-flex min-h-[2.25rem] items-center gap-1.5 rounded border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-brand-primary transition-colors hover:bg-blue-100"
    : "inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded border border-blue-200 bg-blue-50 text-brand-primary hover:bg-blue-100 transition-colors";
  const deleteClass = isCard
    ? "inline-flex min-h-[2.25rem] items-center gap-1.5 rounded px-2 py-2 text-xs font-semibold text-slate-500 transition-colors hover:text-brand-danger disabled:opacity-60"
    : "inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors";
  const iconSize = isCard ? "h-4 w-4" : "h-3.5 w-3.5";

  const primaryActions = (
    <>
      <button type="button" onClick={() => onPreview(session)} className={previewClass}>
        <Eye className={`${iconSize} text-slate-500`} aria-hidden="true" />
        Preview
      </button>
      {mayReopen && (
        <button type="button" onClick={() => onReopen(session)} className={reopenClass}>
          <Edit3 className={iconSize} aria-hidden="true" />
          {isCompleted ? "Replace" : "Edit"}
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
    >
      <Trash2 className={`${iconSize}${isCard ? "" : " text-slate-500"}`} aria-hidden="true" />
      Delete draft
    </button>
  ) : null;

  if (!isCard) {
    return (
      <>
        {primaryActions}
        {deleteAction}
      </>
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
