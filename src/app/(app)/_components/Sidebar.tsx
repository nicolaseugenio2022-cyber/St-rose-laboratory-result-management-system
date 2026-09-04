"use client";

import React, { useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { X } from "lucide-react";
import { NavigationMenu } from "./NavigationMenu";
import { cn } from "@/lib/utils";
import { SYSTEM_CONSTANTS } from "@/lib/constants";
import { UserRole } from "@/domain/types";

export interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserRole?: UserRole;
  /** Control focus returns to when the mobile drawer closes. Optional and internal to the shell. */
  returnFocusRef?: React.RefObject<HTMLElement | null>;
}

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Sidebar({ isOpen, onClose, currentUserRole, returnFocusRef }: SidebarProps) {
  const panelRef = useRef<HTMLElement>(null);
  // onClose is an inline arrow at the call site, so it changes identity every render.
  // Holding it in a ref keeps the isolation effect below from tearing down and rebuilding
  // the trap, the scroll lock and the breakpoint listener on each render.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Below lg this panel is a modal drawer, so it needs the behaviour of one: focus
  // moves in on open, Tab and Shift+Tab stay inside, Escape dismisses, and focus
  // returns to the trigger. The effect only engages while `isOpen`, and `isOpen`
  // is false on desktop where the sidebar is simply part of the page - so the
  // desktop sidebar is never trapped.
  useEffect(() => {
    if (!isOpen) return;

    const panel = panelRef.current;
    const returnTo = returnFocusRef?.current ?? null;

    // Crossing into the desktop breakpoint retires the modal state: the panel becomes
    // ordinary page furniture at lg, so leaving the trap armed would strand a desktop user
    // inside it. Handled in an effect, never as a render branch, so the server and client
    // trees stay identical on first paint.
    const desktopQuery = window.matchMedia("(min-width: 1024px)");
    // Finding 2: read the current value before arming anything. Subscribing alone left an
    // open drawer holding the body lock, the inert background and the trap when the effect
    // began already at desktop, because no `change` event would ever fire to retire them.
    if (desktopQuery.matches) {
      onCloseRef.current();
      return;
    }

    panel?.querySelectorAll<HTMLElement>(FOCUSABLE)[0]?.focus();

    // Background isolation while the drawer is open. The page behind must not scroll, and
    // the previous overflow value is captured rather than assumed so a dialog that opened
    // first has its own lock restored intact.
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleBreakpointChange = (event: MediaQueryListEvent) => {
      if (event.matches) onCloseRef.current();
    };
    desktopQuery.addEventListener("change", handleBreakpointChange);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !panel) return;

      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) {
        event.preventDefault();
        return;
      }

      // Finding 1: recover focus that is somehow outside the drawer - a programmatic
      // focus() elsewhere, or a control removed mid-interaction - instead of letting Tab
      // continue from wherever it landed in the obscured page.
      if (!panel.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      desktopQuery.removeEventListener("change", handleBreakpointChange);
      document.body.style.overflow = previousBodyOverflow;
      returnTo?.focus();
    };
  }, [isOpen, returnFocusRef]);

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-[rgb(13_43_64_/_0.55)] lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Panel. Structural body under a navy brand block: navigation is chrome,
          and the one navy block at the top-left is where the identity of the whole shell
          lives - every other surface can then stay quiet. */}
      <aside
        ref={panelRef}
        id="app-navigation-sidebar"
        aria-label="Main Navigation"
        {...(isOpen ? { role: "dialog", "aria-modal": true } : {})}
        className={cn(
          "fixed bottom-0 left-0 top-0 z-50 flex w-64 flex-col border-r border-brand-border-strong bg-brand-sidebar transition-transform duration-200 ease-in-out motion-reduce:transition-none lg:sticky lg:top-0 lg:bottom-auto lg:z-auto lg:h-[100dvh] lg:translate-x-0",
          // `invisible` while closed is what keeps the off-screen drawer out of the
          // Tab order: translate alone leaves every link focusable behind the page.
          // `lg:visible` hands the panel straight back to the desktop layout.
          isOpen ? "translate-x-0 shadow-overlay lg:shadow-none" : "invisible -translate-x-full lg:visible"
        )}
      >
        {/* Brand block */}
        <div className="flex h-14 shrink-0 items-center gap-2 bg-brand-navy pl-3 pr-2 text-brand-navy-foreground">
          <Link
            href="/dashboard"
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
            onClick={onClose}
          >
            {/* The official mark is a teal disc on a white square. Clipping the square to a
                circle leaves a thin white ring around the disc, which is how it sits on navy. */}
            <Image
              src="/st-rose-logo-official.png"
              alt="St. Rose Diagnostic Laboratory Logo"
              width={36}
              height={36}
              className="h-9 w-9 shrink-0 rounded-full object-cover"
              priority
            />
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-bold leading-tight tracking-tight text-white">
                St. Rose
              </span>
              <span className="block truncate text-[11px] font-medium leading-tight text-brand-navy-muted">
                Diagnostic Laboratory
              </span>
            </span>
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-brand-navy-muted transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 lg:hidden"
            aria-label="Close Navigation Sidebar"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>

        {/* Dynamic Navigation Menu */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <NavigationMenu onNavigate={onClose} currentUserRole={currentUserRole} />
        </div>

        {/* Sidebar Footer. Plain text on the surface, not a card: nothing here is actionable. */}
        <div className="shrink-0 border-t border-brand-border px-4 py-2.5">
          <p className="truncate text-[11px] font-semibold text-brand-text-muted">
            Result Management System
          </p>
          <p className="truncate font-mono text-[10px] text-brand-text-muted">
            v{SYSTEM_CONSTANTS.APP.VERSION}
          </p>
        </div>
      </aside>
    </>
  );
}
