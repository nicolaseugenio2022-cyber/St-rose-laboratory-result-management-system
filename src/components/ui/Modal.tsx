import React, { useCallback, useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/utils/cn";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  /**
   * Element to receive focus when the dialog opens. Defaults to the dialog
   * container, which announces the title and description without placing focus
   * on any control — in particular, never on a destructive one by accident.
   */
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  /** Set false for flows that must not be dismissed by Escape or backdrop click. */
  dismissible?: boolean;
  /**
   * "alertdialog" for confirmations that interrupt the user and require a
   * decision; the default "dialog" suits ordinary forms and detail views.
   */
  role?: "dialog" | "alertdialog";
  closeLabel?: string;
}

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  className,
  initialFocusRef,
  dismissible = true,
  role = "dialog",
  closeLabel = "Close dialog",
}: ModalProps) {
  // Unique per mounted instance, so two concurrent dialogs cannot collide on id.
  const reactId = useId();
  const titleId = `modal-title-${reactId}`;
  const descriptionId = `modal-description-${reactId}`;

  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  // Consumers pass inline arrows, so onClose changes identity every render.
  // Holding it in a ref keeps the effects below from re-running on each render.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const dismissibleRef = useRef(dismissible);
  useEffect(() => {
    dismissibleRef.current = dismissible;
  }, [dismissible]);

  const getFocusable = useCallback(
    () =>
      Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      ),
    []
  );

  // Escape to dismiss, and Tab/Shift+Tab contained within the dialog.
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (dismissibleRef.current) onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;

      const focusable = getFocusable();
      if (focusable.length === 0) {
        // Nothing to move to — keep focus on the dialog itself.
        e.preventDefault();
        dialogRef.current?.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (!dialogRef.current?.contains(active)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
        return;
      }
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, getFocusable]);

  // Focus capture, placement and restoration. Deliberately keyed on `isOpen`
  // alone: the cleanup also runs when the component unmounts while still open,
  // which is how at least one consumer closes, so focus is restored either way.
  useEffect(() => {
    if (!isOpen) return;

    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;

    const frame = requestAnimationFrame(() => {
      const target = initialFocusRef?.current ?? dialogRef.current;
      target?.focus();
    });

    return () => {
      cancelAnimationFrame(frame);
      const previous = previouslyFocusedRef.current;
      previouslyFocusedRef.current = null;
      if (previous && document.contains(previous)) previous.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 transition-opacity"
        onClick={dismissible ? onClose : undefined}
        aria-hidden="true"
      />

      {/* Dialog Window */}
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={cn(
          "relative z-10 w-full max-w-lg rounded-xl border border-brand-border bg-brand-surface p-6 shadow-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring",
          className
        )}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
      >
        <div className="flex items-start justify-between border-b border-brand-border-subtle pb-4">
          <div>
            <h3 id={titleId} className="text-base font-bold text-brand-text">
              {title}
            </h3>
            {description && (
              <p id={descriptionId} className="text-xs text-brand-text-muted mt-0.5">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring"
            aria-label={closeLabel}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="pt-4">{children}</div>
      </div>
    </div>
  );
}
