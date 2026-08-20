import React, { useRef } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

export type ConfirmDialogVariant = "neutral" | "destructive";

export interface ConfirmDialogProps {
  isOpen: boolean;
  /** Dismiss without acting. Also fired by Escape, the backdrop and the close control. */
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
  /** One concise sentence stating the consequence, not a restatement of the title. */
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Label shown on the confirm control while the action is in flight. */
  pendingLabel?: string;
  variant?: ConfirmDialogVariant;
  /** Action is in flight: both controls lock and the dialog cannot be dismissed. */
  isPending?: boolean;
  /** Confirmation is not yet permitted (for example an unmet precondition). */
  confirmDisabled?: boolean;
  /** Extra context rendered above the actions. Keep it short. */
  children?: React.ReactNode;
}

/**
 * Shared confirmation dialog for high-consequence actions.
 *
 * Built on the shared `Modal` rather than a second dialog abstraction, so it
 * inherits the same focus trap, focus restoration, unique title/description
 * ids and Escape handling.
 *
 * Focus deliberately lands on **Cancel**, never on Confirm. A confirmation
 * exists to interrupt, so the safe choice is the one under the user's hands;
 * focusing a destructive Confirm would let a stray Enter carry out the very
 * action the dialog was added to guard.
 *
 * While `isPending`, both controls lock and dismissal is disabled, so an
 * in-flight mutation cannot be cancelled into an unknown state.
 *
 * This primitive is intentionally unwired: it performs no business action and
 * knows nothing about sessions, reports or accounts.
 */
export function ConfirmDialog({
  isOpen,
  onCancel,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  pendingLabel,
  variant = "neutral",
  isPending = false,
  confirmDisabled = false,
  children,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const isDestructive = variant === "destructive";

  return (
    <Modal
      isOpen={isOpen}
      onClose={isPending ? () => {} : onCancel}
      title={title}
      description={description}
      role="alertdialog"
      initialFocusRef={cancelRef}
      dismissible={!isPending}
      closeLabel="Close without confirming"
      className="max-w-md"
    >
      {children && <div className="pb-4 text-sm text-brand-text">{children}</div>}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          ref={cancelRef}
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isPending}
        >
          {cancelLabel}
        </Button>
        <Button
          type="button"
          variant={isDestructive ? "danger" : "primary"}
          onClick={onConfirm}
          disabled={isPending || confirmDisabled}
          aria-busy={isPending || undefined}
        >
          {isPending ? pendingLabel ?? `${confirmLabel}…` : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
