import { UserRole } from "@/domain/types";
import { SYSTEM_CONSTANTS } from "@/lib/constants";

/**
 * The section a destination is listed under in the sidebar.
 *
 * Presentation metadata only, and deliberately declared HERE rather than in a component: this
 * module is the single source of navigation truth, and a grouping table living in the sidebar
 * would be a second place where destinations are enumerated - the exact drift
 * `filterNavigationForRole` exists to prevent. Grouping never affects visibility; a role sees a
 * section only when `filterNavigationForRole` leaves it something to show.
 */
export type NavGroup = "laboratory" | "administration";

export const NAV_GROUP_ORDER: readonly NavGroup[] = ["laboratory", "administration"];

export const NAV_GROUP_LABELS: Record<NavGroup, string> = {
  laboratory: "Laboratory",
  administration: "Administration",
};

export interface NavItemConfig {
  title: string;
  href: string;
  iconName: "LayoutDashboard" | "FileEdit" | "History" | "Users" | "UserCheck" | "ShieldCheck";
  description?: string;
  requiredRole?: UserRole | UserRole[];
  /** Sidebar section. Presentation only - it never widens or narrows what a role may reach. */
  group?: NavGroup;
}

export const navigationConfig: NavItemConfig[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    group: "laboratory",
    iconName: "LayoutDashboard",
    description: "System overview, operational metrics, and quick action shortcuts",
  },
  {
    title: "Session Workspace",
    href: "/workspace",
    group: "laboratory",
    iconName: "FileEdit",
    description: "Guided patient visit creation and result encoding workspace",
    requiredRole: ["Admin", "User"],
  },
  {
    title: "Completed History",
    href: "/history",
    group: "laboratory",
    iconName: "History",
    description: `${SYSTEM_CONSTANTS.RETENTION.COMPLETED_REPORT_DAYS}-day active record directory, report replacement, and export`,
    requiredRole: ["Admin", "User"],
  },
  {
    title: "Audit Logs",
    href: "/audit",
    group: "administration",
    iconName: "ShieldCheck",
    description: "Inspect security audit logs and system event history",
    requiredRole: ["Admin", "Developer"],
  },
  {
    title: "User Management",
    href: "/users",
    group: "administration",
    iconName: "Users",
    description: "Manage application login accounts, roles, and status",
    requiredRole: ["Admin", "Developer"],
  },
  {
    title: "Developer Accounts",
    href: "/developer/accounts",
    group: "administration",
    iconName: "Users",
    description: "Manage Developer accounts and account security",
    requiredRole: ["Developer"],
  },
  {
    title: "Personnel Directory",
    href: "/personnel",
    group: "administration",
    iconName: "UserCheck",
    description: "Maintain PRC-licensed Pathologists, MedTechs, and signatures",
    requiredRole: ["Admin", "Developer"],
  },
];

export function filterNavigationForRole(
  currentUserRole: UserRole | undefined,
  items: NavItemConfig[] = navigationConfig
): NavItemConfig[] {
  return items.filter((item) => {
    if (!item.requiredRole) return true;
    const allowedRoles = Array.isArray(item.requiredRole) ? item.requiredRole : [item.requiredRole];
    if (!currentUserRole) return false;
    const normalizedCurrent = String(currentUserRole).toLowerCase();
    return allowedRoles.map((role) => String(role).toLowerCase()).includes(normalizedCurrent);
  });
}
