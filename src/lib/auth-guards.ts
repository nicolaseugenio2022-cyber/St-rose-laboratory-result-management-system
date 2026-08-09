import { IUserProfile } from "@/domain/models/interfaces";
import { getSession } from "@/lib/session";
import { securityService } from "@/services/security-service";
import { userService } from "@/services/userService";

/**
 * Server Authorization Route Guards
 * Protects administrative routes (/users, /personnel) and API endpoints.
 */

export async function getCurrentUserProfile(): Promise<IUserProfile | null> {
  const session = await getSession();
  if (!session?.userId) {
    return null;
  }

  const user = await userService.getUserById(session.userId);
  if (!user) {
    return null;
  }

  const { password, ...profile } = user;
  return profile;
}

export function checkRouteAccess(pathname: string, userProfile: IUserProfile | null): { allowed: boolean; redirectUrl?: string } {
  if (!userProfile) {
    return { allowed: false, redirectUrl: "/login" };
  }

  if (userProfile.status !== "Active") {
    return { allowed: false, redirectUrl: "/login?reason=deactivated" };
  }

  const isUserManagementRoute = pathname.startsWith("/users");
  const isAuditRoute = pathname.startsWith("/audit");
  const isPersonnelRoute = pathname.startsWith("/personnel");

  if (isUserManagementRoute && !["Admin", "Developer"].includes(userProfile.role)) {
    return { allowed: false, redirectUrl: "/dashboard?error=unauthorized" };
  }

  if (isAuditRoute && !["Admin", "Developer"].includes(userProfile.role)) {
    return { allowed: false, redirectUrl: "/dashboard?error=unauthorized" };
  }

  if (isPersonnelRoute && !["Admin", "Developer"].includes(userProfile.role)) {
    return { allowed: false, redirectUrl: "/dashboard?error=unauthorized" };
  }

  return { allowed: true };
}

export function assertAdminAccess(userProfile: IUserProfile, operationName: string): void {
  securityService.requireAdmin(userProfile, operationName);
}
