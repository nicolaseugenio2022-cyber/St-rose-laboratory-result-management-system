import { redirect } from "next/navigation";
import React from "react";
import { AuditLogView } from "@/features/audit/components/AuditLogView";
import { checkRouteAccess, getCurrentUserProfile } from "@/lib/auth-guards";

export default async function AuditPage() {
  const currentUserProfile = await getCurrentUserProfile();
  const access = checkRouteAccess("/audit", currentUserProfile);

  if (!access.allowed) {
    redirect(access.redirectUrl || "/login");
  }

  return <AuditLogView />;
}
