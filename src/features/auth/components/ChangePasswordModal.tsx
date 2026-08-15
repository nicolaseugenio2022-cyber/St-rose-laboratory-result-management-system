import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { changeOwnPasswordAction } from "@/features/auth/accountActions";

export interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ChangePasswordModal({ isOpen, onClose }: ChangePasswordModalProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const requestSequence = useRef(0);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    requestSequence.current += 1;
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setConfirmPasswordError(null);
    setServerError(null);
    setSuccessMessage(null);
    setIsSubmitting(false);

    return () => {
      requestSequence.current += 1;
      if (closeTimer.current) {
        clearTimeout(closeTimer.current);
        closeTimer.current = null;
      }
    };
  }, [isOpen]);

  const handleClose = () => {
    if (isSubmitting) return;

    requestSequence.current += 1;
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setConfirmPasswordError(null);
    setServerError(null);
    setSuccessMessage(null);
    setIsSubmitting(false);
    onClose();
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }

    setConfirmPasswordError(null);
    setServerError(null);
    setSuccessMessage(null);

    if (newPassword !== confirmPassword) {
      setConfirmPasswordError("Passwords do not match.");
      return;
    }

    const formData = new FormData();
    formData.append("currentPassword", currentPassword);
    formData.append("newPassword", newPassword);
    formData.append("confirmPassword", confirmPassword);

    const requestId = ++requestSequence.current;
    setIsSubmitting(true);

    try {
      const result = await changeOwnPasswordAction(formData);
      if (requestId !== requestSequence.current) return;

      if (result.success === true) {
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setSuccessMessage("Password changed successfully.");
        closeTimer.current = setTimeout(handleClose, 1200);
      } else {
        setServerError(result.error);
      }
    } catch {
      if (requestId === requestSequence.current) {
        setServerError("Unable to change the password.");
      }
    } finally {
      if (requestId === requestSequence.current) {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Change Password"
      description="Update the password for your account."
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

        {successMessage && (
          <div
            role="status"
            className="rounded-lg border border-brand-success-border bg-brand-success-bg p-3 text-xs font-medium text-brand-success"
          >
            {successMessage}
          </div>
        )}

        <Input
          label="Current Password"
          type="password"
          autoComplete="current-password"
          required
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          disabled={isSubmitting}
        />

        <Input
          label="New Password"
          type="password"
          autoComplete="new-password"
          minLength={6}
          maxLength={100}
          required
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          disabled={isSubmitting}
        />

        <Input
          label="Confirm New Password"
          type="password"
          autoComplete="new-password"
          minLength={6}
          maxLength={100}
          required
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          error={confirmPasswordError ?? undefined}
          disabled={isSubmitting}
        />

        {confirmPasswordError && (
          <div role="alert" className="sr-only">
            {confirmPasswordError}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
          <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            Change Password
          </Button>
        </div>
      </form>
    </Modal>
  );
}
