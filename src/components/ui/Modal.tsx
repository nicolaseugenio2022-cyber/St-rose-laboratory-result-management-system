"use client";

import React, { useRef } from "react";
import { X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/shadcn/dialog";
import { cn } from "@/lib/utils";

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
   * How the dialog body is laid out.
   *
   * "scroll" (default) puts the padded, scrolling region here, which is right for ordinary
   * content. "managed" hands the whole body box to the child as a flex row of the panel: the
   * child then owns its own scrolling region AND any action bar, so the bar can sit OUTSIDE that
   * region and consume its own layout space instead of floating over the content. A sticky footer
   * inside a scrolling region is not a fix for that - content still passes behind it.
   */
  bodyLayout?: "scroll" | "managed";
  /**
   * "alertdialog" for confirmations that interrupt the user and require a
   * decision; the default "dialog" suits ordinary forms and detail views.
   */
  role?: "dialog" | "alertdialog";
  closeLabel?: string;
}

/**
 * The shared dialog, on the Rhea dialog primitive.
 *
 * The public contract is unchanged, and most of what the hand-rolled version implemented by
 * hand is now the primitive's: focus is trapped and looped inside the dialog, the page behind
 * is scroll-locked, and Escape and an outside press dismiss. Four of those needed steering
 * to keep this system's rules rather than the registry defaults:
 *
 * - Radix would focus the first control on open. `onOpenAutoFocus` overrides that to put
 *   focus on the dialog container instead, so opening a confirmation never lands on its
 *   destructive action.
 * - Focus restoration stays hand-written. Radix restores to whatever its focus scope saw
 *   before mount, which lands correctly only when a `DialogTrigger` opened the dialog - and
 *   every consumer here drives `isOpen` imperatively instead, so closing returned focus to
 *   <body> and a keyboard user was dropped at the top of the document. The opener is captured
 *   in `onOpenAutoFocus`, which fires before focus moves, and restored in `onCloseAutoFocus`,
 *   which runs on every close route: Escape, the close control, an outside press, and a
 *   parent simply setting `isOpen` false. The default is prevented only when there is a
 *   connected element to return to, so exactly one focus move happens and an opener that
 *   left the DOM still falls back to the primitive's own behaviour.
 * - `dismissible={false}` prevents both the Escape and the outside-press dismissals, and
 *   removes the close control - a locked dialog offers no dismissal route rather than a
 *   dead one.
 * - Radix sets role="dialog" before its prop spread, so the "alertdialog" role passes
 *   through unchanged.
 *
 * The dialog is a column capped to the viewport: the header band stays put and only the
 * body scrolls, so a long form never pushes its own footer off screen. The width follows
 * the previous wrapper-padding geometry - full width less the page inset, capped at lg -
 * so a consumer's own `max-w-*` still narrows it without overflowing a phone.
 */
export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  className,
  initialFocusRef,
  dismissible = true,
  bodyLayout = "scroll",
  role = "dialog",
  closeLabel = "Close dialog",
}: ModalProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  // The element that had focus when the dialog opened. Read in `onOpenAutoFocus` because that
  // is dispatched before the focus scope moves focus anywhere, so it still names the opener.
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && dismissible) onClose();
      }}
    >
      <DialogContent
        ref={contentRef}
        role={role}
        aria-modal="true"
        showCloseButton={false}
        // Navy at 55%, so the page recedes into the brand ground rather than grey.
        overlayClassName="bg-[rgb(13_43_64_/_0.55)] backdrop-blur-none supports-backdrop-filter:backdrop-blur-none"
        onOpenAutoFocus={(event) => {
          const opener = document.activeElement;
          previouslyFocusedRef.current =
            opener instanceof HTMLElement && opener !== document.body ? opener : null;
          event.preventDefault();
          (initialFocusRef?.current ?? contentRef.current)?.focus();
        }}
        onCloseAutoFocus={(event) => {
          const opener = previouslyFocusedRef.current;
          previouslyFocusedRef.current = null;
          // Nothing captured, or the opener has since left the DOM: leave the primitive's own
          // restoration in place rather than prevent it and move focus nowhere.
          if (!opener?.isConnected) return;
          event.preventDefault();
          opener.focus();
        }}
        onEscapeKeyDown={(event) => {
          if (!dismissible) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (!dismissible) event.preventDefault();
        }}
        className={cn(
          // shadow-lg is the overlay elevation step (globals.css maps md/lg/xl to
          // --shadow-overlay), so it replaces the primitive's shadow-xl rather than
          // stacking with it.
          "flex max-h-[calc(100dvh-1.5rem)] w-[calc(100%-1.5rem)] max-w-lg flex-col gap-0 overflow-hidden rounded-lg border border-brand-border bg-brand-surface p-0 text-brand-text shadow-lg ring-0 sm:max-h-[calc(100dvh-3rem)] sm:w-[calc(100%-3rem)] sm:max-w-lg",
          className
        )}
      >
        {/* Structural header band: the dialog is a working surface with the same header
            vocabulary as a page panel, so a modal reads as part of the system. */}
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-brand-border bg-brand-structural px-4 py-3">
          <div className="min-w-0">
            <DialogTitle className="text-[13px] font-semibold leading-tight text-brand-navy">
              {title}
            </DialogTitle>
            {description && (
              <DialogDescription className="mt-0.5 text-[11px] leading-snug text-brand-text-muted">
                {description}
              </DialogDescription>
            )}
          </div>
          {dismissible && (
            <button
              data-slot="dialog-close"
              type="button"
              onClick={onClose}
              className="-my-1.5 -mr-2 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-brand-text-muted outline-none transition-colors hover:bg-brand-structural-hover hover:text-brand-navy sm:h-8 sm:w-8"
              aria-label={closeLabel}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>

        <div
          className={cn(
            "min-h-0 flex-1",
            bodyLayout === "managed"
              ? // The child is the flex column: it draws its own scroll region and its own footer.
                "flex flex-col overflow-hidden"
              : "overflow-y-auto px-4 py-4"
          )}
        >
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}
