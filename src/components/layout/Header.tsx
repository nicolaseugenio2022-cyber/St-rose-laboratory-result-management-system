"use client";

import React, { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, LogOut, KeyRound } from "lucide-react";
import { navigationConfig } from "@/config/navigation";
import { ChangePasswordModal } from "@/features/auth/components/ChangePasswordModal";
import { clearWorkspaceRecovery } from "@/features/workspace/workspace-recovery";

export interface HeaderProps {
  onMenuToggle: () => void;
}

export function Header({ onMenuToggle }: HeaderProps) {
  const pathname = usePathname();
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  // Match route title dynamically from navigationConfig
  const currentNav = navigationConfig.find(
    (item) => item.href === pathname || (item.href !== "/" && pathname.startsWith(item.href))
  );

  const pageTitle = currentNav ? currentNav.title : "St. Rose Laboratory";
  const pageDescription = currentNav?.description || "Result Management System";

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center border-b border-brand-border bg-brand-surface px-4 sm:px-6 lg:px-8">
      <div className="flex flex-1 items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuToggle}
            className="rounded-lg p-2 text-brand-text-muted hover:bg-brand-surface-hover hover:text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-focus-ring lg:hidden"
            aria-label="Toggle Navigation Drawer"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div>
            <h1 className="text-lg font-bold text-brand-text leading-tight tracking-tight">{pageTitle}</h1>
            <p className="text-xs text-brand-text-muted hidden sm:block mt-0.5">{pageDescription}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-brand-success-bg px-2.5 py-1 text-xs font-medium text-brand-success border border-brand-success-border">
            <span className="h-2 w-2 rounded-full bg-brand-success"></span>
            System Ready
          </span>
          <button
            onClick={() => setIsChangePasswordOpen(true)}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-focus-ring hover:bg-brand-surface-hover hover:text-brand-text h-9 px-3 text-brand-text-muted"
            aria-label="Change Password"
          >
            <KeyRound className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline-block">Change Password</span>
          </button>
          <button
            onClick={() => {
              // Never leave unsaved patient data recoverable for the next person at a
              // shared laboratory workstation.
              clearWorkspaceRecovery();
              import("@/features/auth/authActions").then((m) => m.logoutAction());
            }}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-focus-ring hover:bg-brand-surface-hover hover:text-brand-text h-9 px-3 text-brand-text-muted"
            aria-label="Logout"
          >
            <LogOut className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline-block">Logout</span>
          </button>
        </div>
      </div>
      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
      />
    </header>
  );
}
