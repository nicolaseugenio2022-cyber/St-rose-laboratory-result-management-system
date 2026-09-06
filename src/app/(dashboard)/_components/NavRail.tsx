"use client";

import React, { useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  FileEdit,
  History,
  LayoutDashboard,
  LucideIcon,
  Menu,
  ShieldCheck,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { filterNavigationForRole, NavItemConfig } from "@/config/navigation";
import { UserRole } from "@/domain/types";
import { cn } from "@/lib/utils";
import { useWorkspaceNavigationRequester } from "./workspace-navigation-guard";

const iconMap: Record<NavItemConfig["iconName"], LucideIcon> = {
  LayoutDashboard,
  FileEdit,
  History,
  Users,
  UserCheck,
  ShieldCheck,
};

export interface NavRailProps {
  currentUserRole?: UserRole;
  isDrawerOpen: boolean;
  onOpenDrawer: () => void;
  onCloseDrawer: () => void;
}

const focusableSelector =
  'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function NavRail({
  currentUserRole,
  isDrawerOpen,
  onOpenDrawer,
  onCloseDrawer,
}: NavRailProps) {
  const pathname = usePathname();
  const requestNavigation = useWorkspaceNavigationRequester();
  const drawerRef = useRef<HTMLElement>(null);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  // Stable handle to the latest onCloseDrawer, so the isolation effect below is not torn
  // down and rebuilt whenever the parent re-renders.
  const onCloseRef = useRef(onCloseDrawer);
  useEffect(() => {
    onCloseRef.current = onCloseDrawer;
  }, [onCloseDrawer]);
  const items = filterNavigationForRole(currentUserRole);

  useEffect(() => {
    if (!isDrawerOpen) return;

    const openButton = openButtonRef.current;
    const drawer = drawerRef.current;

    // Crossing into the desktop breakpoint retires the modal state; see Sidebar for the
    // same reasoning. Read first, subscribe second.
    const desktopQuery = window.matchMedia("(min-width: 1024px)");
    // Finding 2: read the current value before arming anything. Subscribing alone left an
    // open drawer holding the body lock, the inert background and the trap when the effect
    // began already at desktop, because no `change` event would ever fire to retire them.
    if (desktopQuery.matches) {
      onCloseRef.current();
      return;
    }

    drawer?.querySelectorAll<HTMLElement>(focusableSelector)[0]?.focus();

    // Background isolation while the drawer is open. The previous overflow value is
    // captured rather than assumed so a dialog that opened first keeps its own lock.
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

      if (event.key !== "Tab" || !drawer) return;

      const currentFocusableElements = Array.from(
        drawer.querySelectorAll<HTMLElement>(focusableSelector)
      );
      const firstElement = currentFocusableElements[0];
      const lastElement = currentFocusableElements[currentFocusableElements.length - 1];

      if (!firstElement || !lastElement) {
        event.preventDefault();
        return;
      }

      // Finding 1: pull focus back into the drawer if it is somehow outside it, rather
      // than letting Tab continue from wherever it landed in the obscured Workspace.
      if (!drawer.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? lastElement : firstElement).focus();
        return;
      }

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      desktopQuery.removeEventListener("change", handleBreakpointChange);
      document.body.style.overflow = previousBodyOverflow;
      openButton?.focus();
    };
  }, [isDrawerOpen]);

  /**
   * One destination, rendered either as a compact rail icon or as a labelled
   * drawer row.
   *
   * The guard contract is identical in both: `requestNavigation` runs first and,
   * when it intercepts, the click is prevented and the drawer stays open, so a
   * blocked navigation cannot silently dismiss the operator's way back. The
   * drawer closes only on a navigation that is actually allowed to proceed.
   */
  const renderLink = (item: NavItemConfig, variant: "rail" | "drawer") => {
    const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
    const Icon = iconMap[item.iconName] || LayoutDashboard;

    return (
      <Link
        key={item.href}
        href={item.href}
        aria-label={item.title}
        aria-current={isActive ? "page" : undefined}
        title={item.title}
        onClick={(event) => {
          if (requestNavigation(item.href)) {
            event.preventDefault();
            return;
          }

          onCloseDrawer();
        }}
        className={cn(
          "flex items-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/70",
          variant === "rail"
            ? "h-10 w-10 justify-center rounded-md border-l-[3px]"
            : "min-h-11 w-full gap-2.5 border-l-[3px] py-2.5 pl-3.5 pr-3 text-[13px]",
          isActive
            ? "border-l-white bg-white/10 font-semibold text-white"
            : "border-l-transparent font-medium text-brand-navy-muted hover:bg-white/5 hover:text-white"
        )}
      >
        <Icon
          aria-hidden="true"
          className={cn("h-4 w-4 shrink-0", isActive ? "text-white" : "text-brand-navy-muted")}
        />
        {variant === "drawer" && <span className="truncate">{item.title}</span>}
      </Link>
    );
  };

  return (
    <>
      <button
        ref={openButtonRef}
        type="button"
        onClick={onOpenDrawer}
        aria-label="Open Workspace Navigation"
        aria-expanded={isDrawerOpen}
        aria-controls="workspace-nav-drawer"
        inert={isDrawerOpen || undefined}
        className="no-print fixed bottom-4 left-4 z-30 flex h-11 w-11 items-center justify-center rounded-md bg-brand-navy text-white shadow-overlay transition-colors hover:bg-brand-navy-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring focus-visible:ring-offset-2 print:hidden lg:hidden"
      >
        <Menu aria-hidden="true" className="h-5 w-5" />
      </button>

      <nav
        aria-label="Workspace Navigation"
        className="no-print hidden h-full w-14 shrink-0 flex-col items-center bg-brand-navy print:hidden lg:flex"
      >
        {/* Brand block: the same navy block the full sidebar carries, compressed to the rail
            width, so the Workspace is recognisably the same application. Brand mark only, and
            deliberately not a link: a logo shortcut here would be a navigation path that
            bypasses the unsaved-work guard entirely. */}
        <div className="flex h-14 w-full shrink-0 items-center justify-center border-b border-white/10">
          <Image
            src="/st-rose-logo-official.png"
            alt=""
            aria-hidden="true"
            width={32}
            height={32}
            className="h-8 w-8 shrink-0 rounded-full object-cover"
          />
        </div>
        <div className="flex flex-col items-center gap-1 py-2">
          {items.map((item) => renderLink(item, "rail"))}
        </div>
      </nav>

      {isDrawerOpen && (
        <>
          <div
            className="no-print fixed inset-0 z-40 bg-[rgb(13_43_64_/_0.55)] print:hidden lg:hidden"
            onClick={onCloseDrawer}
            aria-hidden="true"
          />
          <aside
            ref={drawerRef}
            id="workspace-nav-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Workspace Navigation"
            className="no-print fixed bottom-0 left-0 top-0 z-50 flex w-[min(16rem,82vw)] max-w-full flex-col bg-brand-navy shadow-overlay print:hidden lg:hidden"
          >
            <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-white/10 pl-3 pr-2">
              <Image
                src="/st-rose-logo-official.png"
                alt=""
                aria-hidden="true"
                width={32}
                height={32}
                className="h-8 w-8 shrink-0 rounded-full object-cover"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-bold leading-tight tracking-tight text-white">
                  St. Rose
                </span>
                <span className="block truncate text-[11px] font-medium leading-tight text-brand-navy-muted">
                  Diagnostic Laboratory
                </span>
              </span>
              <button
                type="button"
                onClick={onCloseDrawer}
                aria-label="Close Workspace Navigation"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-brand-navy-muted transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
              >
                <X aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>
            <nav
              aria-label="Workspace Navigation"
              className="flex min-h-0 flex-1 flex-col overflow-y-auto py-1"
            >
              {items.map((item) => renderLink(item, "drawer"))}
            </nav>
          </aside>
        </>
      )}
    </>
  );
}
