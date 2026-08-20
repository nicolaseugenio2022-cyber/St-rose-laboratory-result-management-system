"use client";

import React, { useState } from "react";
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

  return (
    <div className="min-h-screen bg-brand-background flex">
      {/* Navigation Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        currentUserRole={currentUserRole}
      />

      {/* Main Content Viewport */}
      <div className="flex flex-1 flex-col min-w-0">
        <Header
          onMenuToggle={() => setSidebarOpen((prev) => !prev)}
          username={username}
          role={currentUserRole}
        />
        <PageContainer>{children}</PageContainer>
      </div>
    </div>
  );
}
