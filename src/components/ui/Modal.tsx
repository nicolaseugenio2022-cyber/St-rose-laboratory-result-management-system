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

      // Initial focus sits on the dialog container itself. `contains` reports true for the
      // container, so the boundary checks below never matched it: forward Tab fell naturally
      // to the first control, but Shift+Tab walked straight out of the dialog. Wrap it to
      // the last control instead.
      if (active === dialogRef.current) {
        if (e.shiftKey) {
          e.preventDefault();
          last.focus();
        }
        return;
      }

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
    // Restore the exact previous inline value rather than a hardcoded "unset": a drawer
    // or an outer dialog may already hold its own lock, and clobbering it would unlock
    // the page underneath a surface that is still open.
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      {/* Backdrop: navy at 55%, so the page recedes into the brand ground rather than grey. */}
      <div
        className="fixed inset-0 bg-[rgb(13_43_64_/_0.55)] transition-opacity"
        onClick={dismissible ? onClose : undefined}
        aria-hidden="true"
      />

      {/* Dialog Window */}
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={cn(
          // The dialog is a column capped to the viewport: the header band stays put and only
          // the body scrolls, so a long form never pushes its own footer off screen.
          "relative z-10 flex max-h-[calc(100dvh-1.5rem)] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-brand-border bg-brand-surface shadow-overlay focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring sm:max-h-[calc(100dvh-3rem)]",
          className
        )}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
      >
        {/* Structural header band: the dialog is a working surface with the same header
            vocabulary as a page panel, so a modal reads as part of the system. */}
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-brand-border bg-brand-structural px-4 py-3">
          <div className="min-w-0">
            <h3 id={titleId} className="text-[13px] font-semibold leading-tight text-brand-navy">
              {title}
            </h3>
            {description && (
              <p id={descriptionId} className="mt-0.5 text-[11px] leading-snug text-brand-text-muted">
                {description}
              </p>
            )}
          </div>
          {/* Correction 3: a non-dismissible dialog offers no dismissal route at all.
              Escape and the backdrop already respected `dismissible`; the close control did
              not, so it stayed enabled and simply did nothing - which reads as a broken
              control rather than a locked one. It is now absent while dismissal is off. */}
          {dismissible && (
            <button
              type="button"
              onClick={onClose}
              className="-my-1.5 -mr-2 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-brand-text-muted transition-colors hover:bg-brand-structural-hover hover:text-brand-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring sm:h-8 sm:w-8"
              aria-label={closeLabel}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>
      </div>
    </div>
  );
}
