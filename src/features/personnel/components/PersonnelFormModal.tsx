import React from "react";
import type { IPersonnel } from "@/domain/models/interfaces";
import { PersonnelFormValues } from "@/lib/validations/personnelValidation";
import { Modal } from "@/components/ui/Modal";
import { PersonnelForm } from "./PersonnelForm";

export interface PersonnelFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: IPersonnel | null;
  onSubmit: (data: PersonnelFormValues) => Promise<void>;
  isLoading?: boolean;
}

export function PersonnelFormModal({
  isOpen,
  onClose,
  initialData,
  onSubmit,
  isLoading = false,
}: PersonnelFormModalProps) {
  const isEditing = !!initialData;
  const title = isEditing ? "Edit Personnel Record" : "Add Personnel Record";
  const description = isEditing
    ? "Update the professional details or directory status of this record."
    : "Register a PRC-licensed Pathologist or Medical Technologist.";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} description={description}>
      <PersonnelForm
        initialData={initialData}
        onSubmit={onSubmit}
        onCancel={onClose}
        isLoading={isLoading}
      />
    </Modal>
  );
}
