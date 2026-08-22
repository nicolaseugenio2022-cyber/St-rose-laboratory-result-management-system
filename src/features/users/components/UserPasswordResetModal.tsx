import React, { useEffect, useState } from "react";
import type { UserDirectoryEntry } from "./UserTable";
import { resetUserPasswordSchema } from "@/lib/validations/userValidation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";

export interface UserPasswordResetModalProps {
  isOpen: boolean;
  targetUser: UserDirectoryEntry | null;
  onClose: () => void;
  onSubmit: (password: string) => Promise<void>;
  isLoading?: boolean;
}

export function UserPasswordResetModal({
  isOpen,
  targetUser,
  onClose,
  onSubmit,
  isLoading = false,
}: UserPasswordResetModalProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    setPassword("");
    setConfirmPassword("");
    setPasswordError(null);
    setConfirmPasswordError(null);
    setServerError(null);
  }, [isOpen, targetUser]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!targetUser) return;

    setPasswordError(null);
    setConfirmPasswordError(null);
    setServerError(null);

    const parsed = resetUserPasswordSchema.safeParse({
      id: targetUser.id,
      password,
    });
    if (!parsed.success) {
      setPasswordError(
        parsed.error.flatten().fieldErrors.password?.[0] ?? "Enter a valid password."
      );
      return;
    }

    if (password !== confirmPassword) {
      setConfirmPasswordError("Passwords do not match.");
      return;
    }

    try {
      await onSubmit(parsed.data.password);
    } catch {
      setServerError("Failed to reset the account password.");
    }
  };

  if (!targetUser) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Reset User Password"
      description="Set a new password for this account."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {serverError && (
          <div
            role="alert"
            className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700"
          >
            {serverError}
          </div>
        )}

        <div className="rounded-lg border border-brand-border bg-brand-surface-hover px-3.5 py-3">
          <p className="text-xs font-semibold text-brand-text-muted">Account</p>
          <p className="mt-1 font-mono text-sm font-semibold text-brand-text">
            @{targetUser.username}
          </p>
        </div>

        <Input
          label="New Password"
          type="password"
          autoComplete="new-password"
          minLength={6}
          maxLength={100}
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={passwordError ?? undefined}
          disabled={isLoading}
        />

        <Input
          label="Confirm Password"
          type="password"
          autoComplete="new-password"
          minLength={6}
          maxLength={100}
          required
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          error={confirmPasswordError ?? undefined}
          disabled={isLoading}
        />

        <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isLoading}>
            Reset Password
          </Button>
        </div>
      </form>
    </Modal>
  );
}
