"use client";

import React, { useState } from "react";
import type { PersonnelDirectoryEntry } from "@/features/personnel/personnel-directory-entry";
import { PersonnelFormValues } from "@/lib/validations/personnelValidation";
import type { PersonnelActionResult } from "@/features/server-boundary/personnel-actions";
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

  return (
    // Viewport containment is set here rather than in Modal: the shared dialog is correct for
    // short confirmations, and this is the one form long enough to exceed a laptop viewport.
    // tailwind-merge resolves max-w-2xl over the shared max-w-lg, and the panel scrolls itself
    // so the sticky action row inside the form stays reachable.
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      dismissible={!isConfirmationOpen && !isSaving && !isSignatureBusy}
      title={title}
      description={description}
      className="max-w-2xl max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-h-[calc(100dvh-3rem)]"
    >
      <PersonnelForm
        initialData={initialData}
        onSubmit={onSubmit}
        onCancel={onClose}
        onSignatureChanged={onSignatureChanged}
        onNestedDialogChange={setIsConfirmationOpen}
        onSubmittingChange={setIsSaving}
        onSignatureBusyChange={setIsSignatureBusy}
      />
    </Modal>
  );
}
