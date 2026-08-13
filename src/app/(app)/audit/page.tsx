import "server-only";

import { redirect } from "next/navigation";
import React from "react";
import { AuditLogView } from "@/features/audit/components/AuditLogView";
import { checkRouteAccess, getCurrentUserProfile } from "@/lib/auth-guards";
import {
  toAuditReaderRole,
  type AuditReadCriteria,
} from "@/services/audit-read-service";
import { auditReadService } from "@/services/audit-read-service-instance";

const DEFAULT_AUDIT_PAGE_SIZE = 25;

export default async function AuditPage() {
  const currentUserProfile = await getCurrentUserProfile();
  const access = checkRouteAccess("/audit", currentUserProfile);

  if (!access.allowed) {
    redirect(access.redirectUrl || "/login");
  }

  const readerRole = toAuditReaderRole(currentUserProfile?.role);
  if (!readerRole) {
    redirect("/dashboard?error=unauthorized");
  }

  const initialCriteria: AuditReadCriteria = {
    category: "ALL",
    limit: DEFAULT_AUDIT_PAGE_SIZE,
    offset: 0,
  };
  const initialPage = await auditReadService.readPage(
    initialCriteria,
    readerRole
  );

  return <AuditLogView initialPage={initialPage} initialCriteria={initialCriteria} />;
}
