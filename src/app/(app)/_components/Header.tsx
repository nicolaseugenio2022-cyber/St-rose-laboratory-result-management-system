"use client";

import React, { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, LogOut, KeyRound, ChevronDown } from "lucide-react";
import { navigationConfig } from "@/config/navigation";
import { formatRoleLabel } from "@/config/roles";
import { UserRole } from "@/domain/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/shadcn/dropdown-menu";
import { ChangePasswordModal } from "./ChangePasswordModal";
import { clearWorkspaceRecovery } from "@/features/workspace/workspace-recovery";

export interface HeaderProps {
  onMenuToggle: () => void;
  username?: string;
  role?: UserRole;
  /** Drawer state, so the trigger can report it. Optional and internal to the shell. */
  isMenuOpen?: boolean;
  /** Lets the shell restore focus to this trigger when the drawer closes. */
  menuButtonRef?: React.Ref<HTMLButtonElement>;
}

/**
 * Two letters for the account tile.
 *
 * Usernames here are shaped like `nicolas.admin`, so the separator is the meaningful boundary
 * and the first letter of the first two segments reads as a monogram. A single-segment name
 * falls back to its first two characters, and anything unusable falls back to a dash rather
 * than rendering an empty tile. Decoration only - the tile is aria-hidden and the account's
 * real name is always announced from the trigger's accessible name.
 */
function accountInitials(username: string): string {
  const segments = username.split(/[^A-Za-z0-9]+/).filter(Boolean);
  if (segments.length >= 2) return (segments[0][0] + segments[1][0]).toUpperCase();
  if (segments.length === 1) return segments[0].slice(0, 2).toUpperCase();
  return "-";
}

export function Header({ onMenuToggle, username, role, isMenuOpen = false, menuButtonRef }: HeaderProps) {
  const pathname = usePathname();
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  // Match route title dynamically from navigationConfig
  const currentNav = navigationConfig.find(
    (item) => item.href === pathname || (item.href !== "/" && pathname.startsWith(item.href))
  );

  const pageTitle = currentNav ? currentNav.title : "St. Rose Laboratory";
  const roleLabel = formatRoleLabel(role);

  // The header is the light half of the shell, against the navy chassis beside it. It carries
  // exactly two things: where you are, and who you are. The route description that used to sit
  // under the title was the navigation config's own blurb - the same sentence every module then
  // restated in its own body - so the page said its name three times before showing any data.
  //
  // Change Password and Logout have moved into the account menu. They were two permanently
  // visible text buttons for actions taken once a shift, and at narrow widths they competed
  // with the page title for the same row.
  return (
    <header className="sticky top-0 z-30 flex h-14 w-full shrink-0 items-center gap-3 border-b border-brand-border-strong bg-brand-structural px-3 sm:px-5 lg:px-6">
      {/* min-w-0 on the title side is what stops the account control from crushing the page
          title as the viewport narrows. */}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <button
          type="button"
          ref={menuButtonRef}
          onClick={onMenuToggle}
          className="-ml-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-brand-text-muted transition-colors hover:bg-brand-structural-hover hover:text-brand-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring lg:hidden"
          aria-label="Toggle Navigation Drawer"
          aria-expanded={isMenuOpen}
          aria-controls="app-navigation-sidebar"
        >
          <Menu aria-hidden="true" className="h-5 w-5" />
        </button>

        {/* The page's one h1. Modules render their content directly and never restate it. */}
        <h1 className="min-w-0 truncate text-base font-bold leading-tight tracking-tight text-brand-navy sm:text-[17px]">
          {pageTitle}
        </h1>
      </div>

      {username && (
        <DropdownMenu>
          <DropdownMenuTrigger
            // The full identity is in the accessible name, so it survives the label collapsing
            // to the monogram below sm. 44px tall at every width.
            aria-label={`Account menu for ${username}, ${roleLabel}`}
            // min-w-11 as well as h-11: below sm the label is hidden and the monogram is the
            // whole control, which left the target 41px wide - tall enough but too narrow.
            className="group inline-flex h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-md border border-transparent px-1 transition-colors hover:border-brand-border hover:bg-brand-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring data-[state=open]:border-brand-border data-[state=open]:bg-brand-surface sm:min-w-0 sm:justify-start sm:pl-1 sm:pr-2"
          >
            <span
              aria-hidden="true"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand-navy text-[11px] font-bold tracking-wide text-white"
            >
              {accountInitials(username)}
            </span>
            <span className="hidden min-w-0 text-left sm:block">
              <span className="block max-w-40 truncate text-xs font-semibold leading-tight text-brand-navy">
                {username}
              </span>
              <span className="block whitespace-nowrap text-[11px] leading-tight text-brand-text-muted">
                {roleLabel}
              </span>
            </span>
            <ChevronDown
              aria-hidden="true"
              className="hidden h-4 w-4 shrink-0 text-brand-text-muted transition-transform group-data-[state=open]:rotate-180 motion-reduce:transition-none sm:block"
            />
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="end"
            sideOffset={6}
            className="w-56 rounded-md border border-brand-border bg-brand-surface p-1 shadow-overlay ring-0"
          >
            {/* Identity, only where the trigger cannot show it. Below sm the trigger collapses
                to the monogram, so without this the signed-in account would be readable nowhere;
                from sm up the trigger already spells it out, and repeating it here would print
                the same name and role twice on one screen. */}
            <div className="px-2 py-1.5 sm:hidden">
              <p className="truncate text-[13px] font-semibold leading-tight text-brand-navy">
                {username}
              </p>
              <p className="truncate text-[11px] leading-tight text-brand-text-muted">{roleLabel}</p>
            </div>

            <DropdownMenuSeparator className="my-1 bg-brand-border sm:hidden" />

            <DropdownMenuItem
              onSelect={() => setIsChangePasswordOpen(true)}
              className="min-h-9 gap-2.5 rounded-sm px-2 text-[13px] font-medium text-brand-text focus:bg-brand-structural focus:text-brand-navy"
            >
              <KeyRound aria-hidden="true" className="h-4 w-4 text-brand-text-muted" />
              Change Password
            </DropdownMenuItem>

            <DropdownMenuItem
              onSelect={() => {
                // Never leave unsaved patient data recoverable for the next person at a
                // shared laboratory workstation.
                clearWorkspaceRecovery();
                import("@/features/auth/authActions").then((m) => m.logoutAction());
              }}
              className="min-h-9 gap-2.5 rounded-sm px-2 text-[13px] font-medium text-brand-danger focus:bg-brand-danger-bg focus:text-brand-danger"
            >
              <LogOut aria-hidden="true" className="h-4 w-4" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
      />
    </header>
  );
}
