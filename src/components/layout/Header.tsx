"use client";

import React, { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, LogOut, KeyRound } from "lucide-react";
import { navigationConfig } from "@/config/navigation";
import { formatRoleLabel } from "@/config/roles";
import { UserRole } from "@/domain/types";
import { Button } from "@/components/ui/Button";
import { ChangePasswordModal } from "@/features/auth/components/ChangePasswordModal";
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

export function Header({ onMenuToggle, username, role, isMenuOpen = false, menuButtonRef }: HeaderProps) {
  const pathname = usePathname();
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  // Match route title dynamically from navigationConfig
  const currentNav = navigationConfig.find(
    (item) => item.href === pathname || (item.href !== "/" && pathname.startsWith(item.href))
  );

  const pageTitle = currentNav ? currentNav.title : "St. Rose Laboratory";
  const pageDescription = currentNav?.description || "Result Management System";

  // Structural, not working surface: the header is chrome. It shares the sidebar's surface
  // and a border that reads against the canvas, so the shell is one connected frame. The
  // page title is the one navy element here - the page's own name, set in the identity
  // colour - and every module inherits it, so no module repeats its title in the body.
  return (
    <header className="sticky top-0 z-30 flex h-14 w-full shrink-0 items-center gap-3 border-b border-brand-border-strong bg-brand-structural px-3 sm:px-5 lg:px-6">
      {/* min-w-0 on the identity side is what stops the account controls from
          crushing the page title as the viewport narrows. */}
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

        <div className="min-w-0">
          <h1 className="truncate text-[15px] font-bold leading-tight tracking-tight text-brand-navy">
            {pageTitle}
          </h1>
          <p className="hidden truncate text-[11px] leading-tight text-brand-text-muted sm:block">
            {pageDescription}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {username && (
          <div
            className="mr-1 hidden min-w-0 max-w-52 items-center gap-2 border-r border-brand-border-strong pr-3 sm:flex"
            aria-label={`Signed in as ${username}`}
          >
            <span className="min-w-0">
              <span className="block max-w-full truncate text-xs font-semibold leading-tight text-brand-navy" title={username}>
                {username}
              </span>
              <span className="block whitespace-nowrap text-[11px] leading-tight text-brand-text-muted">
                {formatRoleLabel(role)}
              </span>
            </span>
          </div>
        )}

        {/* Below sm these collapse to icon-only. The aria-label carries the full
            name in both states, so the accessible name never depends on the
            visible text being present. */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setIsChangePasswordOpen(true)}
          aria-label="Change Password"
          className="h-11 w-11 px-0 sm:h-8 sm:w-auto sm:px-2.5"
        >
          <KeyRound aria-hidden="true" className="h-4 w-4" />
          <span className="hidden sm:inline">Change Password</span>
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            // Never leave unsaved patient data recoverable for the next person at a
            // shared laboratory workstation.
            clearWorkspaceRecovery();
            import("@/features/auth/authActions").then((m) => m.logoutAction());
          }}
          aria-label="Logout"
          className="h-11 w-11 px-0 sm:h-8 sm:w-auto sm:px-2.5"
        >
          <LogOut aria-hidden="true" className="h-4 w-4" />
          <span className="hidden sm:inline">Logout</span>
        </Button>
      </div>

      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
      />
    </header>
  );
}
