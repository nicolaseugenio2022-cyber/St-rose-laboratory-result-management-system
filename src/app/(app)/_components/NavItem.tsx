"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FileEdit, History, Users, UserCheck, ShieldCheck, LucideIcon } from "lucide-react";
import { NavItemConfig } from "@/config/navigation";
import { cn } from "@/lib/utils";

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
 * Stays a semantic Next.js `Link` rather than being pushed through the shared Button: this is
 * navigation, and routing, prefetch and middle-click all depend on a real anchor.
 *
 * It sits on the navy chassis, so the whole state scale is expressed against navy rather than
 * against the old structural tint. The active state is carried by FOUR independent signals, so
 * it survives greyscale, a colour-vision difference, and a bad monitor:
 *
 *   1. a rail on the leading edge,
 *   2. a lifted fill,
 *   3. white semibold rather than muted medium type,
 *   4. `aria-current="page"` for assistive technology.
 *
 * The rail is always present and only changes colour, so nothing shifts by a pixel when the
 * active route moves.
 *
 * The rail is WHITE, not the brand teal it was on the old light sidebar. Measured against this
 * navy, `brand-primary` came out at 2.18:1 - below the 3:1 WCAG minimum for a non-text UI
 * indicator, and visibly so. White is 14.62:1. Teal stays the action colour in the light half
 * of the shell and in focus rings, where it reads; spending it here would have been brand
 * consistency bought with an indicator nobody can see.
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
        // 44px in the mobile drawer, where this row is the primary touch target; 40px on the
        // desktop sidebar, where the pointer is a mouse.
        "group relative flex min-h-11 items-center gap-3 border-l-[3px] py-2 pl-3.5 pr-3 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/70 lg:min-h-10",
        isActive
          ? "border-l-white bg-white/10 font-semibold text-white"
          : "border-l-transparent font-medium text-brand-navy-muted hover:bg-white/5 hover:text-white"
      )}
      aria-current={isActive ? "page" : undefined}
    >
      <Icon
        aria-hidden="true"
        className={cn(
          "h-4 w-4 shrink-0 transition-colors",
          isActive ? "text-white" : "text-brand-navy-muted group-hover:text-white"
        )}
      />
      <span className="truncate">{item.title}</span>
    </Link>
  );
}
