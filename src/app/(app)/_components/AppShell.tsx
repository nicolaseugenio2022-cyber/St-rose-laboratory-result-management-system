"use client";

import React, { useCallback, useRef, useState } from "react";
import { UserRole } from "@/domain/types";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { PageContainer } from "./PageContainer";

export interface AppShellProps {
  children: React.ReactNode;
  currentUserRole?: UserRole;
  username?: string;
}

export function AppShell({ children, currentUserRole, username }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // The shell owns the trigger reference because the trigger lives in the Header
  // while the drawer that must hand focus back to it lives in the Sidebar.
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  return (
    <div className="flex min-h-screen bg-brand-canvas">
      {/* Correction 4: skip link, following the WorkspaceShell precedent. Visually hidden
          until focused, so it adds no permanent clutter, and it lands on PageContainer's
          <main id="main-content">, which is the only main landmark in this shell. */}
      <a href="#main-content" inert={sidebarOpen || undefined} className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[60] focus:rounded-md focus:border focus:border-brand-border-strong focus:bg-brand-surface focus:px-3 focus:py-2 focus:text-xs focus:font-semibold focus:text-brand-navy focus:shadow-overlay focus:outline-none focus:ring-2 focus:ring-brand-focus-ring">
        Skip to main content
      </a>

      {/* Navigation Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={closeSidebar}
        currentUserRole={currentUserRole}
        returnFocusRef={menuButtonRef}
      />

      {/* Main Content Viewport. Correction 5: while the mobile drawer is open this column
          is inert, so the content behind the scrim is not reachable by pointer, Tab or
          assistive-technology browse navigation. On desktop the drawer is never open, so
          this is always interactive there. */}
      <div inert={sidebarOpen || undefined} className="flex min-w-0 flex-1 flex-col">
        <Header
          onMenuToggle={() => setSidebarOpen((prev) => !prev)}
          username={username}
          role={currentUserRole}
          isMenuOpen={sidebarOpen}
          menuButtonRef={menuButtonRef}
        />
        <PageContainer>{children}</PageContainer>
      </div>
    </div>
  );
}
