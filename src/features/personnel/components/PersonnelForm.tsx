"use client";

import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ImageOff } from "lucide-react";
import type { IPersonnel } from "@/domain/models/interfaces";
import {
  PERSONNEL_ROLE_OPTIONS,
  PERSONNEL_STATUS_OPTIONS,
  personnelFormSchema,
  PersonnelFormValues,
} from "@/lib/validations/personnelValidation";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

export interface PersonnelFormProps {
  initialData?: IPersonnel | null;
  onSubmit: (data: PersonnelFormValues) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

function toFormValues(personnel?: IPersonnel | null): PersonnelFormValues {
  return {
    role: personnel?.role ?? "Pathologist",
    firstName: personnel?.firstName ?? "",
    middleInitial: personnel?.middleInitial ?? "",
    lastName: personnel?.lastName ?? "",
    credentials: personnel?.credentials ?? "",
    prcLicenseNumber: personnel?.prcLicenseNumber ?? "",
    status: personnel && !personnel.isActive ? "Inactive" : "Active",
  };
}

export function PersonnelForm({
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
}: PersonnelFormProps) {
  const isEditing = !!initialData;
  const [serverError, setServerError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<PersonnelFormValues>({
    resolver: zodResolver(personnelFormSchema),
    defaultValues: toFormValues(initialData),
  });

  useEffect(() => {
    setServerError(null);
    reset(toFormValues(initialData));
  }, [initialData, reset]);

  // Only Pathologists may ever carry a signature image; Medical Technologists
  // are textual only, so the signature area is never rendered for them.
  const isPathologist = watch("role") === "Pathologist";

  const handleFormSubmit = async (values: PersonnelFormValues) => {
    setServerError(null);
    try {
      await onSubmit(values);
    } catch (err) {
      setServerError((err as Error)?.message || "Failed to save personnel record.");
    }
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      {serverError && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700">
          {serverError}
        </div>
      )}

      <Select
        label="Personnel Role"
        options={[...PERSONNEL_ROLE_OPTIONS]}
        error={errors.role?.message}
        {...register("role")}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="sm:col-span-1">
          <Input
            label="First Name"
            placeholder="e.g. Maria"
            error={errors.firstName?.message}
            {...register("firstName")}
          />
        </div>
        <div className="sm:col-span-1">
          <Input
            label="Middle Initial"
            placeholder="Optional"
            error={errors.middleInitial?.message}
            {...register("middleInitial")}
          />
        </div>
        <div className="sm:col-span-1">
          <Input
            label="Last Name"
            placeholder="e.g. Santos"
            error={errors.lastName?.message}
            {...register("lastName")}
          />
        </div>
      </div>

      <Input
        label="Credentials"
        placeholder={isPathologist ? "e.g. MD, FPSP" : "e.g. RMT"}
        error={errors.credentials?.message}
        {...register("credentials")}
      />

      <Input
        label="PRC License Number"
        placeholder="e.g. 0012345"
        error={errors.prcLicenseNumber?.message}
        {...register("prcLicenseNumber")}
      />

      <Select
        label="Directory Status"
        options={[...PERSONNEL_STATUS_OPTIONS]}
        helperText="Inactive personnel are excluded from new report signatory selection."
        error={errors.status?.message}
        {...register("status")}
      />

      {isPathologist && (
        <div className="rounded-lg border border-dashed border-brand-border bg-slate-50 p-4 opacity-70">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 text-brand-text-subtle">
              <ImageOff className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-brand-text">Signature Image</p>
              <p className="mt-1 text-[11px] leading-relaxed text-brand-text-muted">
                Signature upload is not available yet. It arrives in a later slice, together with
                protected storage handling.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button type="submit" isLoading={isLoading}>
          {isEditing ? "Save Changes" : "Create Personnel"}
        </Button>
      </div>
    </form>
  );
}
