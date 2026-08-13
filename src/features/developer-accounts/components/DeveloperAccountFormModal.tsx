"use client";

import React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import {
  CUSTOM_SECURITY_QUESTION,
  SECURITY_QUESTION_OPTIONS,
} from "@/config/security-questions";
import {
  createDeveloperAccountSchema,
  resetDeveloperPasswordSchema,
  updateDeveloperSecurityQuestionSchema,
  updateDeveloperUsernameSchema,
} from "@/lib/validations/developerAccountValidation";
import type { User } from "@/types/user";

export type DeveloperAccountModalMode =
  | "create"
  | "username"
  | "security-question"
  | "password";

type CreateValues = z.infer<typeof createDeveloperAccountSchema>;
type UsernameValues = z.infer<typeof updateDeveloperUsernameSchema>;
type SecurityQuestionValues = z.infer<
  typeof updateDeveloperSecurityQuestionSchema
>;
type PasswordValues = z.infer<typeof resetDeveloperPasswordSchema>;

interface DeveloperAccountFormModalProps {
  mode: DeveloperAccountModalMode | null;
  account: User | null;
  isLoading: boolean;
  onClose: () => void;
  onCreate: (values: CreateValues) => Promise<void>;
  onUpdateUsername: (values: UsernameValues) => Promise<void>;
  onUpdateSecurityQuestion: (values: SecurityQuestionValues) => Promise<void>;
  onResetPassword: (values: PasswordValues) => Promise<void>;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function FormActions({
  submitLabel,
  isLoading,
  onCancel,
}: {
  submitLabel: string;
  isLoading: boolean;
  onCancel: () => void;
}) {
  return (
    <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
      <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
        Cancel
      </Button>
      <Button type="submit" isLoading={isLoading}>
        {submitLabel}
      </Button>
    </div>
  );
}

function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700"
    >
      {message}
    </div>
  );
}

function CreateDeveloperAccountForm({
  isLoading,
  onCancel,
  onSubmit,
}: {
  isLoading: boolean;
  onCancel: () => void;
  onSubmit: (values: CreateValues) => Promise<void>;
}) {
  const [serverError, setServerError] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors },
  } = useForm<CreateValues>({
    resolver: zodResolver(createDeveloperAccountSchema),
    defaultValues: {
      username: "",
      password: "",
      securityQuestion: SECURITY_QUESTION_OPTIONS[0],
      customSecurityQuestion: "",
    },
  });
  const selectedQuestion = watch("securityQuestion");

  const submit = async (values: CreateValues) => {
    setServerError(null);
    try {
      await onSubmit(values);
    } catch (error) {
      const message = errorMessage(error, "Failed to create Developer account.");
      if (message.toLowerCase().includes("username")) {
        setError("username", { type: "server", message });
      } else {
        setServerError(message);
      }
    }
  };

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
      <FormError message={serverError} />
      <Input
        label="Username"
        placeholder="e.g. developer"
        error={errors.username?.message}
        {...register("username")}
      />
      <Input
        label="Initial Password"
        type="password"
        placeholder="At least 6 characters"
        error={errors.password?.message}
        {...register("password")}
      />
      <Select
        label="Security Question"
        options={SECURITY_QUESTION_OPTIONS.map((question) => ({
          label: question,
          value: question,
        }))}
        error={errors.securityQuestion?.message}
        {...register("securityQuestion")}
      />
      {selectedQuestion === CUSTOM_SECURITY_QUESTION && (
        <Input
          label="Custom Security Question"
          placeholder="Enter the account holder's question"
          error={errors.customSecurityQuestion?.message}
          {...register("customSecurityQuestion")}
        />
      )}
      <FormActions submitLabel="Create Account" isLoading={isLoading} onCancel={onCancel} />
    </form>
  );
}

function UpdateUsernameForm({
  account,
  isLoading,
  onCancel,
  onSubmit,
}: {
  account: User;
  isLoading: boolean;
  onCancel: () => void;
  onSubmit: (values: UsernameValues) => Promise<void>;
}) {
  const [serverError, setServerError] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<UsernameValues>({
    resolver: zodResolver(updateDeveloperUsernameSchema),
    defaultValues: { id: account.id, username: account.username },
  });

  const submit = async (values: UsernameValues) => {
    setServerError(null);
    try {
      await onSubmit(values);
    } catch (error) {
      const message = errorMessage(error, "Failed to update the username.");
      if (message.toLowerCase().includes("username")) {
        setError("username", { type: "server", message });
      } else {
        setServerError(message);
      }
    }
  };

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
      <FormError message={serverError} />
      <input type="hidden" {...register("id")} />
      <Input label="Username" error={errors.username?.message} {...register("username")} />
      <FormActions submitLabel="Save Changes" isLoading={isLoading} onCancel={onCancel} />
    </form>
  );
}

function UpdateSecurityQuestionForm({
  account,
  isLoading,
  onCancel,
  onSubmit,
}: {
  account: User;
  isLoading: boolean;
  onCancel: () => void;
  onSubmit: (values: SecurityQuestionValues) => Promise<void>;
}) {
  const [serverError, setServerError] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SecurityQuestionValues>({
    resolver: zodResolver(updateDeveloperSecurityQuestionSchema),
    defaultValues: {
      id: account.id,
      securityQuestion: SECURITY_QUESTION_OPTIONS[0],
      customSecurityQuestion: "",
    },
  });
  const selectedQuestion = watch("securityQuestion");

  const submit = async (values: SecurityQuestionValues) => {
    setServerError(null);
    try {
      await onSubmit(values);
    } catch (error) {
      setServerError(errorMessage(error, "Failed to update the security question."));
    }
  };

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
      <FormError message={serverError} />
      <input type="hidden" {...register("id")} />
      <Select
        label="Security Question"
        options={SECURITY_QUESTION_OPTIONS.map((question) => ({
          label: question,
          value: question,
        }))}
        error={errors.securityQuestion?.message}
        {...register("securityQuestion")}
      />
      {selectedQuestion === CUSTOM_SECURITY_QUESTION && (
        <Input
          label="Custom Security Question"
          placeholder="Enter the account holder's question"
          error={errors.customSecurityQuestion?.message}
          {...register("customSecurityQuestion")}
        />
      )}
      <FormActions submitLabel="Update Question" isLoading={isLoading} onCancel={onCancel} />
    </form>
  );
}

function ResetPasswordForm({
  account,
  isLoading,
  onCancel,
  onSubmit,
}: {
  account: User;
  isLoading: boolean;
  onCancel: () => void;
  onSubmit: (values: PasswordValues) => Promise<void>;
}) {
  const [serverError, setServerError] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PasswordValues>({
    resolver: zodResolver(resetDeveloperPasswordSchema),
    defaultValues: { id: account.id, password: "" },
  });

  const submit = async (values: PasswordValues) => {
    setServerError(null);
    try {
      await onSubmit(values);
    } catch (error) {
      setServerError(errorMessage(error, "Failed to reset the password."));
    }
  };

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
      <FormError message={serverError} />
      <input type="hidden" {...register("id")} />
      <Input
        label="New Password"
        type="password"
        placeholder="At least 6 characters"
        error={errors.password?.message}
        {...register("password")}
      />
      <FormActions submitLabel="Reset Password" isLoading={isLoading} onCancel={onCancel} />
    </form>
  );
}

export function DeveloperAccountFormModal({
  mode,
  account,
  isLoading,
  onClose,
  onCreate,
  onUpdateUsername,
  onUpdateSecurityQuestion,
  onResetPassword,
}: DeveloperAccountFormModalProps) {
  const modalCopy = {
    create: {
      title: "Create Developer Account",
      description: "Register a new Developer account.",
    },
    username: {
      title: "Edit Developer Username",
      description: "Update the username for this Developer account.",
    },
    "security-question": {
      title: "Update Security Question",
      description: "Set a new security question for this Developer account.",
    },
    password: {
      title: "Reset Developer Password",
      description: "Set a new password for this Developer account.",
    },
  } as const;

  if (!mode) return null;
  const copy = modalCopy[mode];

  return (
    <Modal isOpen onClose={onClose} title={copy.title} description={copy.description}>
      {mode === "create" ? (
        <CreateDeveloperAccountForm
          isLoading={isLoading}
          onCancel={onClose}
          onSubmit={onCreate}
        />
      ) : account && mode === "username" ? (
        <UpdateUsernameForm
          account={account}
          isLoading={isLoading}
          onCancel={onClose}
          onSubmit={onUpdateUsername}
        />
      ) : account && mode === "security-question" ? (
        <UpdateSecurityQuestionForm
          account={account}
          isLoading={isLoading}
          onCancel={onClose}
          onSubmit={onUpdateSecurityQuestion}
        />
      ) : account && mode === "password" ? (
        <ResetPasswordForm
          account={account}
          isLoading={isLoading}
          onCancel={onClose}
          onSubmit={onResetPassword}
        />
      ) : null}
    </Modal>
  );
}
