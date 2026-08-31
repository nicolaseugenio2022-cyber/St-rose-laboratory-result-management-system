"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FileEdit, History, Users, UserCheck, ShieldCheck, LucideIcon } from "lucide-react";
import { NavItemConfig } from "@/config/navigation";
import { cn } from "@/utils/cn";

const iconMap: Record<NavItemConfig["iconName"], LucideIcon> = {
  LayoutDashboard,
  FileEdit,
  History,
  Users,
  UserCheck,
  ShieldCheck,
};

export interface NavItemProps {
  item: NavItemConfig;
  onNavigate?: () => void;
}

/**
 * One destination in the full sidebar.
 *
 * Stays a semantic Next.js `Link` rather than being pushed through the shared
 * Button: this is navigation, and routing, prefetch and middle-click all depend
 * on a real anchor.
 *
 * The active state is carried by three things at once - a brand rail on the
 * leading edge, a tinted surface, and a heavier label - so it survives being
 * read without colour. `aria-current="page"` states it programmatically.
 */
export function NavItem({ item, onNavigate }: NavItemProps) {
  const pathname = usePathname();
  const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
  const Icon = iconMap[item.iconName] || LayoutDashboard;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        // The rail is always present and only changes colour, so nothing shifts
        // by a pixel when the active route moves.
        // min-h-11 rather than taller padding: this same row is the primary navigation
        // target inside the mobile drawer, where py-2 left it 32px tall, and NavigationMenu
        // passes no className so it cannot be sized per surface. 44px stays comfortably dense
        // for the desktop sidebar at the six destinations any role can see.
        "group flex min-h-11 items-center gap-2.5 border-l-2 py-2 pl-3 pr-2.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-focus-ring",
        isActive
          ? "border-l-brand-primary bg-brand-sidebar-active font-semibold text-brand-sidebar-active-text"
          : "border-l-transparent font-medium text-brand-sidebar-text hover:bg-brand-surface-hover hover:text-brand-text"
      )}
      aria-current={isActive ? "page" : undefined}
    >
      <Icon
        aria-hidden="true"
        className={cn(
          "h-4 w-4 shrink-0 transition-colors",
          isActive ? "text-brand-primary" : "text-brand-text-subtle group-hover:text-brand-text"
        )}
      />
      <span className="truncate">{item.title}</span>
    </Link>
  );
}
