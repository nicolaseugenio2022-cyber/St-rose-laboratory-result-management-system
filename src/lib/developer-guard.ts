import "server-only";

import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/auth-guards";
import { auditService } from "@/services/audit-service-instance";

export async function requireDeveloper() {
  const profile = await getCurrentUserProfile();
  if (!profile || profile.role !== "Developer" || profile.status !== "Active") {
    await auditService.emit({
      category: "SecurityDenial",
      eventType: "DeveloperAccessDenied",
      actorRole: profile?.role ?? null,
      targetRole: null,
      performedByUserId: profile?.id ?? null,
      performedByUsername: profile?.username ?? null,
      details: {
        reasonCode: !profile
          ? "unauthenticated"
          : profile.role !== "Developer"
            ? "role_not_authorized"
            : "account_inactive",
      },
    });
    redirect("/dashboard?error=unauthorized");
  }
  return profile;
}
