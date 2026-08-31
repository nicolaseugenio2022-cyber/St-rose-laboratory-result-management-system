import React, { useEffect, useState } from "react";
import type { UserDirectoryEntry } from "./UserTable";
import { resetUserPasswordSchema } from "@/lib/validations/userValidation";
import { Alert } from "@/components/ui/Alert";
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
    // Escape, the backdrop and the close control are the shared Modal's, and they keep working -
    // except while the password write is in flight, where dismissal would leave the operator
    // unable to tell whether the credential changed. `dismissible` also removes the close control
    // in that window rather than leaving a dead one.
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Reset account password"
      description="Set a new password for this account."
      dismissible={!isLoading}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* The shared Alert, not a hand-rolled rose box: it already carries the icon, the border
            tokens and the assertive live-region role. */}
        {serverError && <Alert variant="destructive">{serverError}</Alert>}

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

        {/* Both footer actions clear 44px on a phone and fall back to the standard 40px control
            height from sm up. */}
        <div className="flex items-center justify-end gap-3 border-t border-brand-border-subtle pt-4">
          <Button
            type="button"
            variant="outline"
            className="min-h-11 sm:min-h-10"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button type="submit" className="min-h-11 sm:min-h-10" isLoading={isLoading}>
            Reset password
          </Button>
        </div>
      </form>
    </Modal>
  );
}
