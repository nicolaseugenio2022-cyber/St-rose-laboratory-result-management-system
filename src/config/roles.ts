import { UserRole } from "@/domain/types";

/**
 * Presentation-only role label. Never use this for access control — authorization
 * lives in the server guards, and navigation visibility in filterNavigationForRole.
 */
export function formatRoleLabel(role: UserRole | undefined): string {
  if (!role) return "";
  return role === "Admin" ? "Administrator" : role;
}
