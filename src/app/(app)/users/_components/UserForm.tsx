"use client";

import React, { useEffect } from "react";
import { Resolver, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { UserDirectoryEntry } from "./UserTable";
import {
  createUserSchema,
  updateUserSchema,
  CreateUserFormValues,
  UpdateUserFormValues,
} from "@/lib/validations/userValidation";
import { Alert } from "@/components/ui/Alert";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import {
  CUSTOM_SECURITY_QUESTION,
  SECURITY_QUESTION_OPTIONS,
} from "@/config/security-questions";

export interface UserFormProps {
  initialData?: UserDirectoryEntry | null;
  onSubmit: (data: CreateUserFormValues | UpdateUserFormValues) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  /**
   * Raised whenever the form gains or loses unsaved edits.
   *
   * The dialog above owns dismissal - Escape, the backdrop and the close control all route
   * through it - and it cannot see this form's fields. Without this signal a half-filled
   * account form was discarded silently by a stray Escape, with nothing asked and nothing said.
   */
  onDirtyChange?: (isDirty: boolean) => void;
}

export function UserForm({
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
  onDirtyChange,
}: UserFormProps) {
  const isEditing = !!initialData;
  const [serverError, setServerError] = React.useState<string | null>(null);

  const schema = isEditing ? updateUserSchema : createUserSchema;

  const {
    register,
    handleSubmit,
    reset,
    setError,
    watch,
    formState: { errors, isDirty },
  } = useForm<CreateUserFormValues | UpdateUserFormValues>({
    resolver: zodResolver(schema) as unknown as Resolver<
      CreateUserFormValues | UpdateUserFormValues
    >,
    defaultValues: isEditing
      ? {
          username: initialData.username,
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

  // Reported rather than read: react-hook-form owns the comparison against the defaults, so a
  // field typed into and then corrected back to its original value correctly stops counting as
  // an unsaved edit, and closing it asks nothing.
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const roleOptions = [
    { label: "Laboratory User", value: "User" },
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
      {/* The shared Alert, not a hand-rolled rose box: it carries the icon, the border tokens and
          the assertive live-region role that a bare div does not. */}
      {serverError && <Alert variant="destructive">{serverError}</Alert>}

      {/* Two columns from sm up. Field order is unchanged; the username spans the row, the
          recovery pair sits in one structural tint block, and the remaining fields pair off. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Input
            label="Username"
            autoComplete="off"
            placeholder="e.g. jdoe"
            error={errors.username?.message}
            {...register("username")}
          />
        </div>

        {!isEditing && (
          <div className="space-y-3 rounded-lg border border-brand-border bg-brand-structural p-3 sm:col-span-2">
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
          </div>
        )}

        {!isEditing && (
          <Input
            label="Password"
            type="password"
            autoComplete="new-password"
            placeholder="At least 6 characters"
            error={(errors as { password?: { message?: string } }).password?.message}
            {...register("password")}
          />
        )}

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
      </div>

      {/* Column-reversed on a phone so the submit control sits under the thumb. Both actions
          clear 44px there and fall back to the standard control height from sm up. */}
      <div className="mt-4 flex flex-col-reverse gap-2 border-t border-brand-border pt-3 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          className="min-h-11 sm:min-h-10"
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button type="submit" className="min-h-11 sm:min-h-10" isLoading={isLoading}>
          {isEditing ? "Save changes" : "Create account"}
        </Button>
      </div>
    </form>
  );
}
