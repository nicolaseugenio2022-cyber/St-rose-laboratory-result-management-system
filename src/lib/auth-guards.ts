import { IUserProfile } from "@/domain/models/interfaces";
import { securityService } from "@/services/security-service";

/**
 * Server Authorization Route Guards
 * Protects administrative routes (/users, /personnel) and API endpoints.
 */

export function checkRouteAccess(pathname: string, userProfile: IUserProfile | null): { allowed: boolean; redirectUrl?: string } {
  if (!userProfile) {
    return { allowed: false, redirectUrl: "/login" };
  }

  if (userProfile.status !== "Active") {
    return { allowed: false, redirectUrl: "/login?reason=deactivated" };
  }

  // Administrative routes restricted strictly to Admin role per SECURITY_MODEL.md Section 6.1
  const isAdminRoute = pathname.startsWith("/users") || pathname.startsWith("/personnel");

  if (isAdminRoute && userProfile.role !== "Admin") {
    return { allowed: false, redirectUrl: "/dashboard?error=unauthorized" };
  }

  return { allowed: true };
}

export function assertAdminAccess(userProfile: IUserProfile, operationName: string): void {
  securityService.requireAdmin(userProfile, operationName);
}
