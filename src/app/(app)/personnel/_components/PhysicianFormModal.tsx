"use client";

import React, { useEffect, useState } from "react";
import type { PhysicianDirectoryEntry } from "@/features/physicians/physician-directory-entry";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Modal } from "@/components/ui/Modal";
import {
  PhysicianForm,
  type PhysicianFormValues,
  type PhysicianSubmitResult,
} from "./PhysicianForm";
import type { PhysicianExaminationAssignments } from "./physician-examinations";

export interface PhysicianFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: PhysicianDirectoryEntry | null;
  /** The assignment set this physician holds now, handed straight to the form. */
  initialAssignments?: PhysicianExaminationAssignments;
  onSubmit: (data: PhysicianFormValues) => Promise<PhysicianSubmitResult>;
}

export function PhysicianFormModal({
  isOpen,
  onClose,
  initialData,
  initialAssignments,
  onSubmit,
}: PhysicianFormModalProps) {
  const isEditing = !!initialData;
  const title = isEditing ? "Edit Physician Record" : "Add Physician Record";
  const description = isEditing
    ? "Update the printed name, directory status and examination assignments of this physician."
    : "Register a requesting physician whose name prints on laboratory reports, and assign the examinations they may be selected for.";

  // Raised by the form for the duration of its save. Escape, a backdrop click and the close
  // button all key off `dismissible`, so withholding it locks the dialog until the write settles
  // rather than letting a stray press abandon a request already in flight.
  const [isSaving, setIsSaving] = useState(false);
  // Raised by the form while it holds edits that have not been saved.
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isDiscardOpen, setIsDiscardOpen] = useState(false);

  // The form unmounts with the dialog, so its own dirty state resets on its own. This clears the
  // copy held here, which would otherwise survive into the next record.
  useEffect(() => {
    if (!isOpen) {
      setHasUnsavedChanges(false);
      setIsDiscardOpen(false);
    }
  }, [isOpen]);

  /**
   * Every dismissal route arrives here: Escape, the backdrop, the close control and Cancel.
   * With unsaved edits this asks; with none it closes at once. A save in flight refuses outright -
   * that is a request already outstanding, not an input that can be handed back.
   */
  const requestClose = () => {
    if (isSaving) return;
    if (hasUnsavedChanges) {
      setIsDiscardOpen(true);
      return;
    }
    onClose();
  };

  const discardAndClose = () => {
    setIsDiscardOpen(false);
    setHasUnsavedChanges(false);
    onClose();
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={requestClose}
        dismissible={!isSaving && !isDiscardOpen}
        title={title}
        description={description}
        // Width only. The shared Modal panel is already `flex flex-col overflow-hidden` with its own
        // height cap, and scrolls its BODY (`min-h-0 flex-1 overflow-y-auto`). Re-declaring
        // `overflow-y-auto` and a `max-h-*` here made the panel a second scroll container nested
        // outside that one - two scrollbars, and a sticky footer that scrolled with the inner
        // region instead of holding the panel's edge.
        bodyLayout="managed"
        className="max-w-2xl"
      >
        <PhysicianForm
          initialData={initialData}
          initialAssignments={initialAssignments}
          onSubmit={onSubmit}
          onCancel={requestClose}
          onSubmittingChange={setIsSaving}
          onDirtyChange={setHasUnsavedChanges}
        />
      </Modal>

      <ConfirmDialog
        isOpen={isDiscardOpen}
        onCancel={() => setIsDiscardOpen(false)}
        onConfirm={discardAndClose}
        title="Discard unsaved changes?"
        description={
          isEditing
            ? "This physician record has edits that have not been saved."
            : "This physician record has entries that have not been saved."
        }
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        variant="destructive"
      >
        <p>
          Closing now discards the details entered in this form, and the fields return to what is
          stored. No physician record is created or updated by closing.
        </p>
      </ConfirmDialog>
    </>
  );
}
