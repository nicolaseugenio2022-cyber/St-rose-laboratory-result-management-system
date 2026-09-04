import React from "react";
import type { UserDirectoryEntry } from "./UserTable";
import { CreateUserFormValues, UpdateUserFormValues } from "@/lib/validations/userValidation";
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

  return (
    // Escape, the backdrop and the close control are the shared Modal's, and they keep working -
    // except while the create or edit write is in flight, where dismissal would leave the
    // operator guessing whether the account was saved. `dismissible` also removes the close
    // control in that window rather than leaving a dead one.
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description={description}
      dismissible={!isLoading}
    >
      <UserForm
        initialData={initialData}
        onSubmit={onSubmit}
        onCancel={onClose}
        isLoading={isLoading}
      />
    </Modal>
  );
}
