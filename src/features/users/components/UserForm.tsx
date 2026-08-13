"use client";

import React, { useEffect } from "react";
import { Resolver, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { UserProfile } from "@/types/user";
import {
  createUserSchema,
  updateUserSchema,
  CreateUserFormValues,
  UpdateUserFormValues,
} from "@/lib/validations/userValidation";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import {
  CUSTOM_SECURITY_QUESTION,
  SECURITY_QUESTION_OPTIONS,
} from "@/config/security-questions";

export interface UserFormProps {
  initialData?: UserProfile | null;
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
    watch,
    formState: { errors },
  } = useForm<CreateUserFormValues | UpdateUserFormValues>({
    resolver: zodResolver(schema) as unknown as Resolver<
      CreateUserFormValues | UpdateUserFormValues
    >,
    defaultValues: isEditing
      ? {
          username: initialData.username,
          password: "",
          role: initialData.role as UpdateUserFormValues["role"],
          status: initialData.status,
        }
      : {
          username: "",
          password: "",
          role: "User",
          securityQuestion: SECURITY_QUESTION_OPTIONS[0],
          customSecurityQuestion: "",
        },
  });

  useEffect(() => {
    setServerError(null);
    if (initialData) {
      reset({
        username: initialData.username,
        password: "",
        role: initialData.role as UpdateUserFormValues["role"],
        status: initialData.status,
      });
    } else {
      reset({
        username: "",
        password: "",
        role: "User",
        securityQuestion: SECURITY_QUESTION_OPTIONS[0],
        customSecurityQuestion: "",
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
  const selectedSecurityQuestion = watch("securityQuestion" as keyof CreateUserFormValues);

  const handleFormSubmit = async (values: CreateUserFormValues | UpdateUserFormValues) => {
    setServerError(null);
    try {
      await onSubmit(values);
    } catch (err: any) {
      const message = err?.message || "Failed to save user account.";
      if (message.toLowerCase().includes("username") && message.toLowerCase().includes("already")) {
        setError("username", { type: "manual", message });
      } else {
        setServerError(message);
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

      {!isEditing && (
        <>
          <Select
            label="Security Question"
            options={SECURITY_QUESTION_OPTIONS.map((question) => ({
              label: question,
              value: question,
            }))}
            error={(errors as { securityQuestion?: { message?: string } }).securityQuestion?.message}
            {...register("securityQuestion" as keyof CreateUserFormValues)}
          />
          {selectedSecurityQuestion === CUSTOM_SECURITY_QUESTION && (
            <Input
              label="Custom Security Question"
              placeholder="Enter the account holder's question"
              error={(errors as { customSecurityQuestion?: { message?: string } }).customSecurityQuestion?.message}
              {...register("customSecurityQuestion" as keyof CreateUserFormValues)}
            />
          )}
        </>
      )}

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
