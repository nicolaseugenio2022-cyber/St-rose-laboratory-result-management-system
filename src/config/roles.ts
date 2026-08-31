import { UserRole } from "@/domain/types";

/**
 * Presentation-only role label. Never use this for access control — authorization
 * lives in the server guards, and navigation visibility in filterNavigationForRole.
 */
const ROLE_LABELS: Record<UserRole, string> = {
  Admin: "Administrator",
  User: "Laboratory User",
  Developer: "Developer",
};

export function formatRoleLabel(role: UserRole | undefined): string {
  if (!role) return "";
  // `User` used to fall through unchanged, so the shell printed "User" while every module that
  // had been corrected printed "Laboratory User". One table, so the two cannot disagree again.
  return ROLE_LABELS[role] ?? role;
}
