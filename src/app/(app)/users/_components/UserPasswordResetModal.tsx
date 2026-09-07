"use client";

import React, { useEffect, useState } from "react";
import type { UserDirectoryEntry } from "./UserTable";
import { resetUserPasswordSchema } from "@/lib/validations/userValidation";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
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
  const [isDiscardOpen, setIsDiscardOpen] = useState(false);

  useEffect(() => {
    setPassword("");
    setConfirmPassword("");
    setPasswordError(null);
    setConfirmPasswordError(null);
    setServerError(null);
    setIsDiscardOpen(false);
  }, [isOpen, targetUser]);

  // Whether anything has been typed, not what was typed. The two credential fields are never
  // read for any other purpose here, never echoed into a message, and never logged.
  const hasUnsavedInput = password !== "" || confirmPassword !== "";

  /**
   * Every dismissal route arrives here: Escape, the backdrop, the close control and Cancel.
   *
   * A part-entered credential discarded by a stray Escape is silent data loss like any other, and
   * the operator has to retype a value they cannot see. With the fields empty this closes at once.
   */
  const requestClose = () => {
    if (isLoading) return;
    if (hasUnsavedInput) {
      setIsDiscardOpen(true);
      return;
    }
    onClose();
  };

  const discardAndClose = () => {
    setIsDiscardOpen(false);
    setPassword("");
    setConfirmPassword("");
    onClose();
  };

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
    <>
      <Modal
        isOpen={isOpen}
        onClose={requestClose}
        title="Reset account password"
        description="Set a new password for this account."
        dismissible={!isLoading && !isDiscardOpen}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* The shared Alert, not a hand-rolled rose box: it already carries the icon, the border
              tokens and the assertive live-region role. */}
          {serverError && <Alert variant="destructive">{serverError}</Alert>}

          {/* The target account, stated in a structural tint block rather than a second white box. */}
          <div className="rounded-lg border border-brand-border bg-brand-structural px-3.5 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-text-muted">Account</p>
            <p className="mt-0.5 break-all font-mono text-[13px] font-semibold text-brand-text">
              @{targetUser.username}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
          </div>

          {/* Column-reversed on a phone so the submit control sits under the thumb. Both actions
              clear 44px there and fall back to the standard control height from sm up. */}
          <div className="mt-4 flex flex-col-reverse gap-2 border-t border-brand-border pt-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="min-h-11 sm:min-h-10"
              onClick={requestClose}
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

      <ConfirmDialog
        isOpen={isDiscardOpen}
        onCancel={() => setIsDiscardOpen(false)}
        onConfirm={discardAndClose}
        title="Discard the entered password?"
        description="A new password has been entered but not applied."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        variant="destructive"
      >
        <p>
          Closing now clears both fields. The account password is left exactly as it is, so
          nothing has changed for the account holder either way.
        </p>
      </ConfirmDialog>
    </>
  );
}
