"use client";

import React from "react";
import { navigationConfig, NavItemConfig } from "@/config/navigation";
import { NavItem } from "./NavItem";
import { UserRole } from "@/domain/types";

export interface NavigationMenuProps {
  items?: NavItemConfig[];
  currentUserRole?: UserRole;
  onNavigate?: () => void;
}

export function NavigationMenu({ items = navigationConfig, currentUserRole, onNavigate }: NavigationMenuProps) {
  const permittedItems = items.filter((item) => {
    if (!item.requiredRole) return true;
    const allowedRoles = Array.isArray(item.requiredRole) ? item.requiredRole : [item.requiredRole];
    if (!currentUserRole) return false;
    const normalizedCurrent = String(currentUserRole).toLowerCase();
    return allowedRoles.map((r) => String(r).toLowerCase()).includes(normalizedCurrent);
  });

  return (
    <nav className="space-y-1.5 px-3 py-4" aria-label="Main Navigation">
      <div className="px-3 pb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
        Core Menu
      </div>
      {permittedItems.map((item) => (
        <NavItem key={item.href} item={item} onNavigate={onNavigate} />
      ))}
    </nav>
  );
}
