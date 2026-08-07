import React from "react";
import { navigationConfig, NavItemConfig } from "@/config/navigation";
import { NavItem } from "./NavItem";

export interface NavigationMenuProps {
  items?: NavItemConfig[];
  onNavigate?: () => void;
}

export function NavigationMenu({ items = navigationConfig, onNavigate }: NavigationMenuProps) {
  return (
    <nav className="space-y-1.5 px-3 py-4" aria-label="Main Navigation">
      <div className="px-3 pb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
        Core Menu
      </div>
      {items.map((item) => (
        <NavItem key={item.href} item={item} onNavigate={onNavigate} />
      ))}
    </nav>
  );
}
