import { cache } from "react";
import { getSessionUser } from "@/lib/session";
import {
  firstLoginRedirectPath,
  isFirstLoginPathAllowed,
} from "@/lib/first-login-gate";
import { securityService } from "@/services/security-service";
import { UserProfile } from "@/types/user";

// Returns the user row this request already validated, rather than re-reading it (M6 P4).
// Same validation, same per-request freshness - one read instead of two.
export const getCurrentUserProfile = cache(async (): Promise<UserProfile | null> => {
  return getSessionUser();
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
