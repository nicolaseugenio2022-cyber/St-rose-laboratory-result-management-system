import { UserRole } from "@/domain/types";

export interface NavItemConfig {
  title: string;
  href: string;
  iconName: "LayoutDashboard" | "FileEdit" | "History" | "Users" | "UserCheck" | "ShieldCheck";
  description?: string;
  requiredRole?: UserRole | UserRole[];
}

export const navigationConfig: NavItemConfig[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    iconName: "LayoutDashboard",
    description: "System overview, operational metrics, and quick action shortcuts",
  },
  {
    title: "Session Workspace",
    href: "/workspace",
    iconName: "FileEdit",
    description: "Guided patient visit creation and result encoding workspace",
    requiredRole: ["Admin", "User"],
  },
  {
    title: "Completed History",
    href: "/history",
    iconName: "History",
    description: "30-day active record directory, report replacement, and export",
    requiredRole: ["Admin", "User"],
  },
  {
    title: "Audit Logs",
    href: "/audit",
    iconName: "ShieldCheck",
    description: "Inspect security audit logs and system event history",
    requiredRole: ["Admin", "Developer"],
  },
  {
    title: "User Management",
    href: "/users",
    iconName: "Users",
    description: "Manage application login accounts, roles, and status",
    requiredRole: ["Admin", "Developer"],
  },
  {
    title: "Developer Accounts",
    href: "/developer/accounts",
    iconName: "Users",
    description: "Manage Developer accounts and account security",
    requiredRole: ["Developer"],
  },
  {
    title: "Personnel Directory",
    href: "/personnel",
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
