"use client";

import React, { useCallback, useState } from "react";
import { UserRole } from "@/domain/types";
import { NavRail } from "./NavRail";
import { WorkspaceNavigationGuardProvider } from "./workspace-navigation-guard";

export interface WorkspaceShellProps {
  children: React.ReactNode;
  currentUserRole?: UserRole;
}

export function WorkspaceShell({ children, currentUserRole }: WorkspaceShellProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const openDrawer = useCallback(() => setIsDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setIsDrawerOpen(false), []);

  return (
    <WorkspaceNavigationGuardProvider>
      <div className="flex h-dvh w-full overflow-hidden bg-slate-100/60">
        <a
          href="#workspace-main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[60] focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-xs focus:font-semibold focus:text-slate-900 focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-brand-focus-ring"
        >
          Skip to encoding surface
        </a>

        <NavRail
          currentUserRole={currentUserRole}
          isDrawerOpen={isDrawerOpen}
          onOpenDrawer={openDrawer}
          onCloseDrawer={closeDrawer}
        />

        <div id="workspace-main" tabIndex={-1} className="flex min-w-0 flex-1 flex-col">
          {children}
        </div>
      </div>
    </WorkspaceNavigationGuardProvider>
  );
}
