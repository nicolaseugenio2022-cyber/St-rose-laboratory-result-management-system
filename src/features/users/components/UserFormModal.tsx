import React from "react";
import { UserProfile, UserRole } from "@/types/user";
import { CreateUserFormValues, UpdateUserFormValues } from "@/lib/validations/userValidation";
import { Modal } from "@/components/ui/Modal";
import { UserForm } from "./UserForm";

export interface UserFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: UserProfile | null;
  onSubmit: (data: CreateUserFormValues | UpdateUserFormValues) => Promise<void>;
  isLoading?: boolean;
  currentUserRole?: UserRole;
}

export function UserFormModal({
  isOpen,
  onClose,
  initialData,
  onSubmit,
  isLoading = false,
  currentUserRole,
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
        currentUserRole={currentUserRole}
      />
    </Modal>
  );
}
