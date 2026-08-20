"use client";

import React, { useEffect, useRef } from "react";
import Link from "next/link";
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
import { cn } from "@/utils/cn";

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
  const drawerRef = useRef<HTMLElement>(null);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const items = filterNavigationForRole(currentUserRole);

  useEffect(() => {
    if (!isDrawerOpen) return;

    const openButton = openButtonRef.current;
    const drawer = drawerRef.current;
    const focusableElements = drawer?.querySelectorAll<HTMLElement>(focusableSelector);
    focusableElements?.[0]?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseDrawer();
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
      openButton?.focus();
    };
  }, [isDrawerOpen, onCloseDrawer]);

  const navigationLinks = items.map((item) => {
    const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
    const Icon = iconMap[item.iconName] || LayoutDashboard;

    return (
      <Link
        key={item.href}
        href={item.href}
        aria-label={item.title}
        aria-current={isActive ? "page" : undefined}
        title={item.title}
        onClick={onCloseDrawer}
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-lg transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring",
          isActive
            ? "bg-brand-sidebar-active text-brand-sidebar-active-text"
            : "text-brand-sidebar-text hover:bg-brand-surface-hover hover:text-brand-text"
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
      </Link>
    );
  });

  return (
    <>
      <button
        ref={openButtonRef}
        type="button"
        onClick={onOpenDrawer}
        aria-label="Open Workspace Navigation"
        aria-expanded={isDrawerOpen}
        className="no-print fixed bottom-4 left-4 z-30 flex h-10 w-10 items-center justify-center rounded-lg border border-brand-border bg-brand-sidebar text-brand-sidebar-text hover:bg-brand-surface-hover hover:text-brand-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring print:hidden lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      <nav
        aria-label="Workspace Navigation"
        className="no-print hidden h-full w-16 shrink-0 flex-col items-center gap-2 border-r border-brand-border bg-brand-sidebar py-3 print:hidden lg:flex"
      >
        {navigationLinks}
      </nav>

      {isDrawerOpen && (
        <>
          <div
            className="no-print fixed inset-0 z-40 bg-slate-900/30 print:hidden lg:hidden"
            onClick={onCloseDrawer}
            aria-hidden="true"
          />
          <aside
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Workspace Navigation"
            className="no-print fixed bottom-0 left-0 top-0 z-50 flex w-16 flex-col items-center border-r border-brand-border bg-brand-sidebar py-3 shadow-md print:hidden lg:hidden"
          >
            <button
              type="button"
              onClick={onCloseDrawer}
              aria-label="Close Workspace Navigation"
              className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg text-brand-sidebar-text hover:bg-brand-surface-hover hover:text-brand-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring"
            >
              <X className="h-5 w-5" />
            </button>
            <nav aria-label="Workspace Navigation" className="flex flex-col items-center gap-2">
              {navigationLinks}
            </nav>
          </aside>
        </>
      )}
    </>
  );
}
