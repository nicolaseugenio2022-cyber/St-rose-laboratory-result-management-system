"use client";

import React from "react";
import { Edit3, Eye, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { PatientReportSessionListEntry } from "@/features/server-boundary/session-transport";

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
 *
 * SHADCN-07C2: the row's session is the narrow list entry, not the full aggregate. Nothing here
 * ever needed more - status decides which controls exist, and the accession and patient name only
 * name the row for assistive technology. `onPreview` now hands that identity upward and History
 * loads the complete session itself; this component still never fetches anything.
 */

export type HistorySessionEntry = {
  session: PatientReportSessionListEntry;
  canReopen: boolean;
};

export type HistorySessionActionsVariant = "table" | "card";

export interface HistorySessionActionsProps {
  entry: HistorySessionEntry;
  variant: HistorySessionActionsVariant;
  isDeleting: boolean;
  onPreview: (session: PatientReportSessionListEntry) => void;
  onReopen: (session: PatientReportSessionListEntry) => void;
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
  const rowSubject = session.accessionNumber ?? session.demographics?.fullName ?? "";
  const named = (label: string) => (rowSubject ? `${label} ${rowSubject}` : label);
  // Card controls are the shared medium (36px) button; table controls are the shared small (32px)
  // one so three of them sit on a single 34px row baseline. The emphasis difference is carried
  // by surface (filled / outlined / icon-only), not by differing geometry.
  const buttonSize = isCard ? "md" : "sm";
  // The card layout renders only below `md`, where the pointer is a finger, so its controls take a
  // 44px minimum target rather than the 36px a size="md" Button gives a mouse. This is the bump the
  // Personnel record layout already applies for the same reason; History was the one management
  // module still handing a finger the mouse-sized control. Height only - the footer keeps its
  // existing left/right arrangement, and the table variant is untouched.
  const cardTarget = "min-h-11";
  // Table variant carries three actions in one cell. They share one shape language - same height,
  // radius and padding rhythm - so they read as a single group, and emphasis is carried by fill:
  // Preview alone is filled (structural, so it reads on a white or striped row), Replace/Edit is
  // outlined in the action colour, Delete draft is outlined and icon-only.
  // Every control keeps a visible resting border, so interactivity never depends on colour alone.
  const previewClass = isCard
    ? cardTarget
    : "h-8 px-2 xl:px-2.5 border-brand-border bg-brand-structural text-brand-navy hover:border-brand-border-strong hover:bg-brand-structural-hover";
  const reopenClass = isCard
    ? `${cardTarget} border-brand-info-border bg-brand-tint text-brand-primary hover:border-brand-primary hover:bg-brand-tint`
    : "h-8 px-2 xl:px-2.5 text-brand-primary hover:border-brand-info-border hover:bg-brand-tint";
  // Icon-only in the table: 32x32 clears the WCAG 2.5.8 target-size minimum, the trash glyph
  // carries the destructive meaning by shape rather than by colour, and the accessible name is
  // supplied explicitly below.
  const deleteClass = isCard
    ? `${cardTarget} px-2.5 text-brand-text-muted hover:bg-brand-danger-bg hover:text-brand-danger`
    : "h-8 w-8 border border-brand-border p-0 text-brand-text-muted hover:border-brand-danger-border hover:bg-brand-danger-bg hover:text-brand-danger";
  const iconSize = isCard ? "h-4 w-4" : "h-3.5 w-3.5";
  // Between lg and xl the shell leaves the table roughly 720px, so the labelled controls do
  // not fit. They collapse to icons there; the text stays in the DOM for assistive tech.
  const labelClass = isCard ? "" : "hidden xl:inline";

  const primaryActions = (
    <>
      <Button
        type="button"
        variant="outline"
        size={buttonSize}
        onClick={() => onPreview(session)}
        className={previewClass}
        aria-label={named("Preview")}
        title="Preview"
      >
        <Eye className={`${iconSize} text-brand-text-muted`} aria-hidden="true" />
        <span className={labelClass}>Preview</span>
      </Button>
      {mayReopen && (
        <Button
          type="button"
          variant="outline"
          size={buttonSize}
          onClick={() => onReopen(session)}
          className={reopenClass}
          aria-label={named(isCompleted ? "Replace" : "Edit")}
          title={isCompleted ? "Replace" : "Edit"}
        >
          <Edit3 className={iconSize} aria-hidden="true" />
          <span className={labelClass}>{isCompleted ? "Replace" : "Edit"}</span>
        </Button>
      )}
    </>
  );

  const deleteAction = mayDeleteDraft ? (
    <Button
      type="button"
      variant="ghost"
      size={buttonSize}
      onClick={() => onDeleteDraft(entry)}
      disabled={isDeleting}
      className={deleteClass}
      // The table variant renders no visible label, so the accessible name is supplied here.
      // `title` gives sighted pointer users the same wording, keeping the control discoverable.
      aria-label={named("Delete draft")}
      title={isCard ? undefined : "Delete draft"}
    >
      {/* Slightly larger glyph in the table: it is the control's only visible content. */}
      <Trash2 className="h-4 w-4" aria-hidden="true" />
      {isCard ? "Delete draft" : null}
    </Button>
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

  // Card layout: one structural footer band. The primary actions sit left and the destructive
  // action alone at the far right, so it stays apart from the primary row while the DOM order
  // (Preview, Edit, Delete draft) is unchanged; the strong destructive framing lives in the
  // confirmation dialog, not here.
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-brand-border bg-brand-structural px-3.5 py-2">
      {primaryActions}
      {deleteAction && <div className="ml-auto">{deleteAction}</div>}
    </div>
  );
}
