import React from "react";
import type { IPersonnel } from "@/domain/models/interfaces";
import { PersonnelFormValues } from "@/lib/validations/personnelValidation";
import type { PersonnelActionResult } from "@/features/server-boundary/personnel-actions";
import { Modal } from "@/components/ui/Modal";
import { PersonnelForm } from "./PersonnelForm";

export interface PersonnelFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: IPersonnel | null;
  onSubmit: (data: PersonnelFormValues) => Promise<PersonnelActionResult>;
  onSignatureChanged: (newUrl: string | null) => void;
  isLoading?: boolean;
}

export function PersonnelFormModal({
  isOpen,
  onClose,
  initialData,
  onSubmit,
  onSignatureChanged,
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
        onSignatureChanged={onSignatureChanged}
        isLoading={isLoading}
      />
    </Modal>
  );
}
