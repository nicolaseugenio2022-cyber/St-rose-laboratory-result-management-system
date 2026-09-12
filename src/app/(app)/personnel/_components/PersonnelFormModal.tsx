"use client";

import React, { useEffect, useState } from "react";
import type { PersonnelDirectoryEntry } from "@/features/personnel/personnel-directory-entry";
import { PersonnelFormValues } from "@/lib/validations/personnelValidation";
import type { PersonnelActionResult } from "@/features/server-boundary/personnel-actions";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Modal } from "@/components/ui/Modal";
import { PersonnelForm } from "./PersonnelForm";

export interface PersonnelFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: PersonnelDirectoryEntry | null;
  onSubmit: (data: PersonnelFormValues) => Promise<PersonnelActionResult>;
  onSignatureChanged: (hasSignature: boolean) => void;
}

export function PersonnelFormModal({
  isOpen,
  onClose,
  initialData,
  onSubmit,
  onSignatureChanged,
}: PersonnelFormModalProps) {
  const isEditing = !!initialData;
  const title = isEditing ? "Edit Personnel Record" : "Add Personnel Record";
  const description = isEditing
    ? "Update the professional details or directory status of this record."
    : "Register a PRC-licensed Pathologist or Medical Technologist.";

  // The form raises this while one of its confirmations is open. Both dialogs listen for
  // Escape on the document, so without it a single press would answer the confirmation and
  // throw away the edit behind it. While a confirmation is up this dialog stops offering a
  // dismissal route of its own; the confirmation covers it and answers for both.
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
  // Raised by the form for the duration of its save. Escape, a backdrop click and the close
  // button all key off `dismissible`, so withholding it locks the dialog until the write
  // settles rather than letting a stray press abandon a request already in flight.
  const [isSaving, setIsSaving] = useState(false);
  // Raised by the form for the duration of a signature upload or removal, which is a write the
  // signature control owns rather than part of the form's save. It withholds dismissal on the
  // same grounds: closing mid-write abandons a request against stored personnel data whose
  // result nothing would then reconcile. It is withdrawn as soon as the operation settles.
  const [isSignatureBusy, setIsSignatureBusy] = useState(false);
  // Raised by the form while it holds edits that have not been saved.
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isDiscardOpen, setIsDiscardOpen] = useState(false);

  // The form unmounts with the dialog, so its own dirty state resets on its own. This clears the
  // copy held here, which would otherwise survive into the next record and make an untouched
  // form ask before closing.
  useEffect(() => {
    if (!isOpen) {
      setHasUnsavedChanges(false);
      setIsDiscardOpen(false);
    }
  }, [isOpen]);

  /**
   * Every dismissal route arrives here: Escape, the backdrop, the close control and Cancel.
   *
   * A personnel record is the longest form in this module - seven fields across three groups -
   * so discarding it silently costs the most to retype. With unsaved edits this asks; with none
   * it closes at once. A save or a signature write in flight refuses outright, as before: that
   * is a request already outstanding, not an input that can be handed back.
   */
  const requestClose = () => {
    if (isSaving || isSignatureBusy) return;
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
        dismissible={
          !isConfirmationOpen && !isSaving && !isSignatureBusy && !isDiscardOpen
        }
        title={title}
        description={description}
        // Width only; tailwind-merge resolves max-w-2xl over the shared max-w-lg. The shared panel
        // is already capped to the viewport with its own height and overflow. Re-declaring
        // `overflow-y-auto` and a `max-h-*` here made the panel a second scroll container around
        // the body's own - two scrollbars. `managed` hands the body to the form, which draws the
        // one scrolling region and keeps its action bar outside it, as PhysicianFormModal does.
        bodyLayout="managed"
        className="max-w-2xl"
      >
        <PersonnelForm
          initialData={initialData}
          onSubmit={onSubmit}
          onCancel={requestClose}
          onSignatureChanged={onSignatureChanged}
          onNestedDialogChange={setIsConfirmationOpen}
          onSubmittingChange={setIsSaving}
          onSignatureBusyChange={setIsSignatureBusy}
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
            ? "This personnel record has edits that have not been saved."
            : "This personnel record has entries that have not been saved."
        }
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        variant="destructive"
      >
        {/* The second sentence names BOTH signature directions deliberately. Saying only that an
            uploaded image is unaffected reads as "nothing was destroyed", which is false in a
            reachable order: remove the signature, then type into a field, then close. The removal
            is its own server write and has already happened by then, so the copy has to account
            for it rather than reassure past it. What closing discards is the form, never a
            signature operation that already committed. */}
        <p>
          Closing now discards the details entered in this form, and the fields return to what is
          stored. No personnel record is created or updated by closing. A signature image uploaded
          or removed while this dialog was open was saved at that moment and is not undone here.
        </p>
      </ConfirmDialog>
    </>
  );
}
