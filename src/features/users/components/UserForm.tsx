"use client";

import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { User } from "@/types/user";
import {
  createUserSchema,
  updateUserSchema,
  CreateUserFormValues,
  UpdateUserFormValues,
} from "@/lib/validations/userValidation";
import { DuplicateUsernameError } from "@/services/userService";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

export interface UserFormProps {
  initialData?: User | null;
  onSubmit: (data: CreateUserFormValues | UpdateUserFormValues) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function UserForm({ initialData, onSubmit, onCancel, isLoading = false }: UserFormProps) {
  const isEditing = !!initialData;
  const [serverError, setServerError] = React.useState<string | null>(null);

  const schema = isEditing ? updateUserSchema : createUserSchema;

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<CreateUserFormValues | UpdateUserFormValues>({
    resolver: zodResolver(schema),
    defaultValues: isEditing
      ? {
          username: initialData.username,
          password: "",
          role: initialData.role,
          status: initialData.status,
        }
      : {
          username: "",
          password: "",
          role: "User",
        },
  });

  useEffect(() => {
    setServerError(null);
    if (initialData) {
      reset({
        username: initialData.username,
        password: "",
        role: initialData.role,
        status: initialData.status,
      });
    } else {
      reset({
        username: "",
        password: "",
        role: "User",
      });
    }
  }, [initialData, reset]);

  const roleOptions = [
    { label: "Standard User", value: "User" },
    { label: "Administrator", value: "Admin" },
  ];

  const statusOptions = [
    { label: "Active", value: "Active" },
    { label: "Inactive", value: "Inactive" },
  ];

  const handleFormSubmit = async (values: CreateUserFormValues | UpdateUserFormValues) => {
    setServerError(null);
    try {
      await onSubmit(values);
    } catch (err: any) {
      if (err instanceof DuplicateUsernameError) {
        setError("username", { type: "manual", message: err.message });
      } else {
        setServerError(err?.message || "Failed to save user account.");
      }
    }
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      {serverError && (
        <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700">
          {serverError}
        </div>
      )}

      <Input
        label="Username"
        placeholder="e.g. jdoe"
        error={errors.username?.message}
        {...register("username")}
      />

      <Input
        label={isEditing ? "New Password (optional)" : "Password"}
        type="password"
        placeholder={isEditing ? "Leave blank to keep unchanged" : "At least 6 characters"}
        error={errors.password?.message}
        {...register("password")}
      />

      <Select
        label="System Role"
        options={roleOptions}
        error={errors.role?.message}
        {...register("role")}
      />

      {isEditing && (
        <Select
          label="Account Status"
          options={statusOptions}
          error={(errors as any).status?.message}
          {...register("status" as any)}
        />
      )}

      <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button type="submit" isLoading={isLoading}>
          {isEditing ? "Save Changes" : "Create Account"}
        </Button>
      </div>
    </form>
  );
}
