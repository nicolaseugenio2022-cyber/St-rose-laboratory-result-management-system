import React from "react";
import Link from "next/link";
import {
  ChevronRight,
  FileEdit,
  History,
  LayoutDashboard,
  ShieldCheck,
  UserCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { NavItemConfig } from "@/config/navigation";
import { cn } from "@/lib/utils";

/**
 * Icon lookup for a navigation destination rendered on a dashboard.
 *
 * The shell owns its own copy for the sidebar and the Workspace rail. This is deliberately not
 * hoisted into `@/config/navigation`: that module is imported directly by
 * `scripts/check-navigation.ts`, and giving a plain config module a `lucide-react` dependency
 * would make a navigation verifier resolve an icon package to answer a question about roles.
 * Consolidating the three maps is CLINIC-UI-UX-09 cleanup, not this phase's.
 */
export const DESTINATION_ICONS: Record<NavItemConfig["iconName"], LucideIcon> = {
  LayoutDashboard,
  FileEdit,
  History,
  Users,
  UserCheck,
  ShieldCheck,
};

export interface DestinationRowProps {
  item: NavItemConfig;
}

/**
 * One management destination, as a scannable line rather than a card.
 *
 * These destinations are permanent entries in the role's own sidebar, so restating them as
 * large action cards made the first screenful of the dashboard a second copy of the menu -
 * which is why they were removed entirely at one point. A single line each is the middle
 * position the screen actually needs: present and quick to scan, but plainly subordinate to
 * the primary action and to the operational lists.
 *
 * The whole row is one real `Link`, so it is keyboard reachable and announces one name; the
 * chevron is decorative. 44px tall so it satisfies the mobile target contract without the row
 * growing into a card.
 */
export function DestinationRow({ item }: DestinationRowProps) {
  const Icon = DESTINATION_ICONS[item.iconName] ?? LayoutDashboard;

  return (
    <Link
      href={item.href}
      className={cn(
        "group flex min-h-11 items-center gap-3 px-3.5 py-2 transition-colors",
        "hover:bg-brand-surface-hover",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-focus-ring"
      )}
    >
      <span
        aria-hidden="true"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-tint text-brand-primary"
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-brand-navy">
        {item.title}
      </span>
      <ChevronRight
        aria-hidden="true"
        className="h-4 w-4 shrink-0 text-brand-text-subtle transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transform-none"
      />
    </Link>
  );
}
