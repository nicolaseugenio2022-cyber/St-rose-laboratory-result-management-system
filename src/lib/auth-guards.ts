import { cache } from "react";
import { getSession } from "@/lib/session";
import {
  firstLoginRedirectPath,
  isFirstLoginPathAllowed,
} from "@/lib/first-login-gate";
import { securityService } from "@/services/security-service";
import { userService } from "@/services/user-service-instance";
import { UserProfile } from "@/types/user";

export const getCurrentUserProfile = cache(async (): Promise<UserProfile | null> => {
  const session = await getSession();
  if (!session) return null;
  return userService.getUserById(session.userId);
});

export function checkRouteAccess(
  pathname: string,
  userProfile: UserProfile | null
): { allowed: boolean; redirectUrl?: string } {
  if (!userProfile) return { allowed: false, redirectUrl: "/login" };
  if (userProfile.status !== "Active") {
    return { allowed: false, redirectUrl: "/login?reason=deactivated" };
  }

  if (
    (userProfile.mustChangePassword || userProfile.mustSetRecovery) &&
    !isFirstLoginPathAllowed(pathname)
  ) {
    return { allowed: false, redirectUrl: firstLoginRedirectPath(userProfile) };
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

export function assertAdminAccess(userProfile: UserProfile, operationName: string): void {
  securityService.requireAdmin(userProfile, operationName);
}
