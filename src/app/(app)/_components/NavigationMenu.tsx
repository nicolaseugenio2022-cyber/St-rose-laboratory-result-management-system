"use client";

import React from "react";
import {
  filterNavigationForRole,
  navigationConfig,
  NAV_GROUP_LABELS,
  NAV_GROUP_ORDER,
  type NavGroup,
  type NavItemConfig,
} from "@/config/navigation";
import { NavItem } from "./NavItem";
import { UserRole } from "@/domain/types";

export interface NavigationMenuProps {
  items?: NavItemConfig[];
  currentUserRole?: UserRole;
  onNavigate?: () => void;
}

/**
 * Role-filtered destination list, in sections.
 *
 * Visibility is decided solely by `filterNavigationForRole` over `navigationConfig`. Nothing
 * here adds, reorders or relabels a destination, and hiding a link is presentation only - the
 * route and server guards remain the authorization boundary.
 *
 * Sections come from each item's own `group`, so this component enumerates no destinations of
 * its own: a grouping table written here would be a second place destinations are listed, and
 * the two would drift the first time one was edited. Grouping is applied AFTER the role filter,
 * so a section with nothing in it for this role prints no heading at all - a Laboratory User
 * never sees an empty "Administration" label. An item with no group falls into the first
 * section rather than vanishing, so a future destination cannot go missing by omission.
 */
export function NavigationMenu({ items = navigationConfig, currentUserRole, onNavigate }: NavigationMenuProps) {
  const permittedItems = filterNavigationForRole(currentUserRole, items);
  const fallbackGroup = NAV_GROUP_ORDER[0];

  const sections = NAV_GROUP_ORDER.map((group: NavGroup) => ({
    group,
    label: NAV_GROUP_LABELS[group],
    items: permittedItems.filter((item) => (item.group ?? fallbackGroup) === group),
  })).filter((section) => section.items.length > 0);

  return (
    <nav className="flex flex-col gap-5 py-4" aria-label="Main Navigation">
      {sections.map((section) => (
        // A real heading + list, so a screen-reader user can move by section and hear how many
        // destinations it holds, rather than meeting one undifferentiated run of links.
        <div key={section.group}>
          <h2 className="px-4 pb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-brand-navy-muted/80">
            {section.label}
          </h2>
          <ul className="flex flex-col gap-0.5">
            {section.items.map((item) => (
              <li key={item.href}>
                <NavItem item={item} onNavigate={onNavigate} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
