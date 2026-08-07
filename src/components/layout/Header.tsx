"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { navigationConfig } from "@/config/navigation";

export interface HeaderProps {
  onMenuToggle: () => void;
}

export function Header({ onMenuToggle }: HeaderProps) {
  const pathname = usePathname();

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
            <h1 className="text-base font-bold text-brand-text leading-tight">{pageTitle}</h1>
            <p className="text-xs text-brand-text-muted hidden sm:block">{pageDescription}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-success-bg px-2.5 py-1 text-xs font-medium text-brand-success border border-brand-success-border">
            <span className="h-2 w-2 rounded-full bg-brand-success"></span>
            System Ready
          </span>
        </div>
      </div>
    </header>
  );
}
