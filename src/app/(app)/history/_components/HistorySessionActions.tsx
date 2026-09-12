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
  /**
   * Whether the viewer may permanently delete a COMPLETED session.
   *
   * Resolved on the server from the authenticated account and passed down. OPTIONAL and default
   * FALSE, so every existing caller - and any future one that forgets it - offers no removal at
   * all: the control fails closed. It is presentation only. The server action re-resolves the
   * caller and refuses a non-Administrator on its own, so hiding this button is a convenience,
   * never the authorization boundary.
   */
  canDeleteCompleted?: boolean;
  /** Asked to delete a COMPLETED session. Separate from the draft callback on purpose. */
  onDeleteCompleted?: (entry: HistorySessionEntry) => void;
}

export function HistorySessionActions({
  entry,
  variant,
  isDeleting,
  onPreview,
  onReopen,
  onDeleteDraft,
  canDeleteCompleted = false,
  onDeleteCompleted,
}: HistorySessionActionsProps) {
  const { session, canReopen } = entry;
  const isCompleted = session.status === "Completed";

  // Authorization, stated once for both renderings:
  //  - Preview is always offered.
  //  - Replace/Edit requires the server-decided canReopen.
  //  - Delete draft requires the session to still be a Draft AND the server-decided canReopen,
  //    which for a draft means the caller created it. Ownership, not role.
  //  - Deleting a COMPLETED session is the Administrator's action and nobody else's. It is NOT
  //    gated on canReopen: an Administrator may remove a completed record another operator
  //    encoded, which is the whole point of the permission. Role, not ownership.
  const mayReopen = canReopen;
  const mayDeleteDraft = !isCompleted && canReopen;
  const mayDeleteCompleted = isCompleted && canDeleteCompleted && Boolean(onDeleteCompleted);

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
    : "h-8 px-2 min-[1400px]:px-2.5 border-brand-border bg-brand-structural text-brand-navy hover:border-brand-border-strong hover:bg-brand-structural-hover";
  const reopenClass = isCard
    ? `${cardTarget} border-brand-info-border bg-brand-tint text-brand-primary hover:border-brand-primary hover:bg-brand-tint`
    : "h-8 px-2 min-[1400px]:px-2.5 text-brand-primary hover:border-brand-info-border hover:bg-brand-tint";
  // THE SHARED DESTRUCTIVE BUTTON, the same one the Personnel directory uses for its permanent
  // deletion. Removing a record is the same act in both modules, so it reads the same: `variant
  // "danger"` carries the colour from the design system and nothing is re-tinted here. Only geometry
  // is set locally - the same height and padding rhythm as Preview and Replace, so three controls
  // read as one group rather than as two buttons and an odd square pushed against the cell edge. A
  // fixed 32x32 icon-only box was the one control that could not carry a label, which is exactly how
  // it ended up crowding the boundary once a third action arrived.
  const deleteClass = isCard ? cardTarget : "h-8 px-2 min-[1400px]:px-2.5";
  const iconSize = isCard ? "h-4 w-4" : "h-3.5 w-3.5";
  // WHERE THE LABELS TURN ON, measured rather than guessed.
  //
  // Three LABELLED controls measure about 290px including their gaps. The actions column is 30% of
  // a `table-fixed` table, so the content box is 269px at the xl shell and 317px at 1440. Labels
  // at xl therefore asked for 290px inside 269px, and because the frame is `overflow-hidden` and a
  // fixed table never exceeds 100%, the surplus was CLIPPED at the right edge rather than scrolled
  // - the defect this corrects. 1400px is where the third label starts to fit, so that is the
  // breakpoint: an ordinary 1440 desktop gets all three labels, and the 1280-1399 band keeps the
  // icons it has room for. The text stays in the DOM at every width for assistive technology.
  const labelClass = isCard ? "" : "hidden min-[1400px]:inline";

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
      variant="danger"
      size={buttonSize}
      onClick={() => onDeleteDraft(entry)}
      disabled={isDeleting}
      className={deleteClass}
      // The table variant renders no visible label, so the accessible name is supplied here.
      // `title` gives sighted pointer users the same wording, keeping the control discoverable.
      aria-label={named("Delete draft")}
      title={isCard ? undefined : "Delete draft"}
    >
      <Trash2 className={iconSize} aria-hidden="true" />
      {/* "Delete" in the table, where the column is shared with two other labels; the full
          "Delete draft" in the card, which has the room. The accessible name carries the
          distinction at every width either way. */}
      {isCard ? "Delete draft" : <span className={labelClass}>Delete</span>}
    </Button>
  ) : null;

  // The same control, for the other lifecycle state and the other authorization rule. Deliberately
  // a separate element rather than one button with two meanings: the label, the confirmation it
  // opens and the permission behind it all differ, and a single control switching identity by
  // status is how the wrong record gets deleted.
  const deleteCompletedAction = mayDeleteCompleted ? (
    <Button
      type="button"
      variant="danger"
      size={buttonSize}
      onClick={() => onDeleteCompleted?.(entry)}
      disabled={isDeleting}
      className={deleteClass}
      aria-label={named("Delete completed session")}
      title={isCard ? undefined : "Delete completed session"}
      data-delete-completed
    >
      <Trash2 className={iconSize} aria-hidden="true" />
      {isCard ? "Delete session" : <span className={labelClass}>Delete</span>}
    </Button>
  ) : null;

  if (!isCard) {
    // One left-aligned group that WRAPS. Right-aligning made Preview land at a different x on every
    // row depending on how many actions that row had, which broke the vertical scan line. The wrap
    // is the safety net rather than the plan: the column is budgeted for three labelled controls, so
    // a row that somehow exceeds it takes a second line inside the cell instead of being clipped by
    // the frame. Nothing is pushed to the cell boundary, and a row with two actions aligns with a row
    // that has three because both start at the same left edge.
    return (
      <div className="flex flex-wrap items-center justify-start gap-1.5">
        {primaryActions}
        {deleteAction}
        {deleteCompletedAction}
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
      {/* ONE trailing slot. A row is either a Draft or a Completed session, so at most one of the
          two removals exists; giving each its own `ml-auto` wrapper would have allowed two
          right-aligned controls to exist in the same footer. */}
      {(deleteAction || deleteCompletedAction) && (
        <div className="ml-auto">{deleteAction ?? deleteCompletedAction}</div>
      )}
    </div>
  );
}
