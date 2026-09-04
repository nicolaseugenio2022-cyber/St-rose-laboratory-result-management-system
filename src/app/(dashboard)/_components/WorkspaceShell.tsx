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
      <div className="flex h-dvh w-full overflow-hidden bg-brand-canvas">
        {/* Finding 1: the skip link is a sibling of the drawer, so it must go inert too,
            or it stays the one reachable control behind the scrim. */}
        <a
          href="#workspace-main"
          inert={isDrawerOpen || undefined}
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[60] focus:rounded-md focus:border focus:border-brand-border-strong focus:bg-brand-surface focus:px-3 focus:py-2 focus:text-xs focus:font-semibold focus:text-brand-navy focus:shadow-overlay focus:outline-none focus:ring-2 focus:ring-brand-focus-ring"
        >
          Skip to encoding surface
        </a>

        <NavRail
          currentUserRole={currentUserRole}
          isDrawerOpen={isDrawerOpen}
          onOpenDrawer={openDrawer}
          onCloseDrawer={closeDrawer}
        />

        {/* Correction 5: inert while the Workspace drawer is open, so the encoding surface
            behind the scrim is not reachable by pointer, Tab or browse navigation. */}
        <div
          id="workspace-main"
          tabIndex={-1}
          inert={isDrawerOpen || undefined}
          className="flex min-w-0 flex-1 flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-focus-ring"
        >
          {children}
        </div>
      </div>
    </WorkspaceNavigationGuardProvider>
  );
}
