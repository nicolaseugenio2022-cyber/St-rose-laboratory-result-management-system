"use client";

import React from "react";
import { filterNavigationForRole, navigationConfig, NavItemConfig } from "@/config/navigation";
import { NavItem } from "./NavItem";
import { UserRole } from "@/domain/types";

export interface NavigationMenuProps {
  items?: NavItemConfig[];
  currentUserRole?: UserRole;
  onNavigate?: () => void;
}

/**
 * Role-filtered destination list.
 *
 * Visibility is decided solely by `filterNavigationForRole` over
 * `navigationConfig`. Nothing here adds, reorders or relabels a destination,
 * and hiding a link is presentation only - the route and server guards remain
 * the authorization boundary.
 */
export function NavigationMenu({ items = navigationConfig, currentUserRole, onNavigate }: NavigationMenuProps) {
  const permittedItems = filterNavigationForRole(currentUserRole, items);

  return (
    <nav className="py-2" aria-label="Main Navigation">
      <p className="px-3 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-widest text-brand-text-subtle">
        Core Menu
      </p>
      <div className="flex flex-col">
        {permittedItems.map((item) => (
          <NavItem key={item.href} item={item} onNavigate={onNavigate} />
        ))}
      </div>
    </nav>
  );
}
