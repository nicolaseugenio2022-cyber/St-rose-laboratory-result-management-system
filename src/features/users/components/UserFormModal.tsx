import React from "react";
import { User } from "@/types/user";
import { CreateUserFormValues, UpdateUserFormValues } from "@/lib/validations/userValidation";
import { Modal } from "@/components/ui/Modal";
import { UserForm } from "./UserForm";

export interface UserFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: User | null;
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
  const title = isEditing ? "Edit User Account" : "Create New User Account";
  const description = isEditing
    ? "Update user details, role assignment, or account status."
    : "Fill in the required information to register a new user account.";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} description={description}>
      <UserForm
        initialData={initialData}
        onSubmit={onSubmit}
        onCancel={onClose}
        isLoading={isLoading}
      />
    </Modal>
  );
}
