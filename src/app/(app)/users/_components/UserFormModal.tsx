"use client";

import React, { useEffect, useState } from "react";
import type { UserDirectoryEntry } from "./UserTable";
import { CreateUserFormValues, UpdateUserFormValues } from "@/lib/validations/userValidation";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Modal } from "@/components/ui/Modal";
import { UserForm } from "./UserForm";

export interface UserFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: UserDirectoryEntry | null;
  onSubmit: (data: CreateUserFormValues | UpdateUserFormValues) => Promise<void>;
  isLoading?: boolean;
}

export function UserFormModal({
  isOpen,
  onClose,
  initialData,
  onSubmit,
  isLoading = false,
}: UserFormModalProps) {
  const isEditing = !!initialData;
  // Named for what the directory calls these records, and for the control that opens this dialog.
  // "User Account" read as the Laboratory User role rather than as any staff account.
  const title = isEditing ? "Edit staff account" : "Add staff account";
  const description = isEditing
    ? "Update the account username, role assignment, or status."
    : "Register a new staff login account.";

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isDiscardOpen, setIsDiscardOpen] = useState(false);

  // The form is unmounted with the dialog, so its own dirty state resets on its own. This clears
  // the copy held up here, which would otherwise survive into the next time the dialog opens and
  // make an untouched form ask before closing.
  useEffect(() => {
    if (!isOpen) {
      setHasUnsavedChanges(false);
      setIsDiscardOpen(false);
    }
  }, [isOpen]);

  /**
   * Every dismissal route arrives here: Escape, the backdrop, the close control and Cancel.
   *
   * With unsaved edits on the form it opens a confirmation instead of closing, so typed input is
   * never discarded by a stray key. With none, it closes immediately - a dialog that interrogates
   * a form nobody touched is just an extra keystroke.
   */
  const requestClose = () => {
    if (isLoading) return;
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
    // Escape, the backdrop and the close control are the shared Modal's, and they keep working -
    // except while the create or edit write is in flight, where dismissal would leave the
    // operator guessing whether the account was saved, and while the discard confirmation is up,
    // where dismissing the dialog underneath would answer the question by destroying the input it
    // is asking about. `dismissible` also removes the close control in those windows rather than
    // leaving a dead one.
    <>
      <Modal
        isOpen={isOpen}
        onClose={requestClose}
        title={title}
        description={description}
        dismissible={!isLoading && !isDiscardOpen}
      >
        <UserForm
          initialData={initialData}
          onSubmit={onSubmit}
          onCancel={requestClose}
          isLoading={isLoading}
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
            ? "This account has edits that have not been saved."
            : "This account form has entries that have not been saved."
        }
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        variant="destructive"
      >
        <p>
          Closing now discards what has been entered. Nothing has been written to the account
          directory, so no account is created or changed either way.
        </p>
      </ConfirmDialog>
    </>
  );
}
