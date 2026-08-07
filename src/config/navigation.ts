export interface NavItemConfig {
  title: string;
  href: string;
  iconName: "LayoutDashboard" | "Users";
  description?: string;
}

export const navigationConfig: NavItemConfig[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    iconName: "LayoutDashboard",
    description: "System metrics and quick operations",
  },
  {
    title: "User Management",
    href: "/users",
    iconName: "Users",
    description: "Manage system accounts, roles, and status",
  },
];
