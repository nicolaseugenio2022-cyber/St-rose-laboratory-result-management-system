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

export function NavItem({ item, onNavigate }: NavItemProps) {
  const pathname = usePathname();
  const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
  const Icon = iconMap[item.iconName] || LayoutDashboard;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-medium transition-colors duration-150 group",
        isActive
          ? "bg-brand-sidebar-active text-brand-sidebar-active-text font-semibold"
          : "text-brand-sidebar-text hover:bg-brand-surface-hover hover:text-brand-text"
      )}
      aria-current={isActive ? "page" : undefined}
    >
      <Icon
        className={cn(
          "h-4 w-4 shrink-0 transition-colors duration-150",
          isActive ? "text-brand-sidebar-active-text" : "text-brand-text-subtle group-hover:text-brand-text"
        )}
      />
      <span>{item.title}</span>
    </Link>
  );
}
