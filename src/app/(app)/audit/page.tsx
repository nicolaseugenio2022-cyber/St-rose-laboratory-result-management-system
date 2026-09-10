import "server-only";

import { redirect } from "next/navigation";
import React from "react";
import { AuditLogView } from "./_components/AuditLogView";
import { checkRouteAccess, getCurrentUserProfile } from "@/lib/auth-guards";
import {
  toAuditReaderRole,
  type AuditReadCriteria,
} from "@/services/audit-read-service";
import {
  auditReadService,
  prefetchDeveloperIdentities,
} from "@/services/audit-read-service-instance";

const DEFAULT_AUDIT_PAGE_SIZE = 25;

export default async function AuditPage() {
  // CLINIC-PERF-02: started before the caller resolves, so the Developer-identity read overlaps the
  // authenticated-user read instead of following it. Authorization below is unchanged, and only
  // readPage's Admin branch consumes the result.
  prefetchDeveloperIdentities();
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
