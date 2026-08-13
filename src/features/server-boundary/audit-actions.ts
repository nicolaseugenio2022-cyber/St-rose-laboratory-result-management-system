"use server";

import "server-only";

import { parseAuditReadInput } from "@/features/server-boundary/audit-action-inputs";
import { getSession } from "@/lib/session";
import { auditService } from "@/services/audit-service-instance";
import { auditReadService } from "@/services/audit-read-service-instance";
import type {
  AuditPageTransport,
  AuditReaderRole,
} from "@/services/audit-read-service";
import { userService } from "@/services/user-service-instance";

async function requireAuditCaller(): Promise<{ role: AuditReaderRole }> {
  const session = await getSession();
  if (!session) {
    await auditService.emit({
      category: "SecurityDenial",
      eventType: "AuditAccessDenied",
      actorRole: null,
      targetRole: null,
      details: { reasonCode: "unauthenticated" },
    });
    throw new Error("Authentication is required.");
  }
  if (session.mustChangePassword || session.mustSetRecovery) {
    await auditService.emit({
      category: "SecurityDenial",
      eventType: "AuditAccessDenied",
      actorRole: null,
      targetRole: null,
      performedByUserId: session.userId,
      details: { reasonCode: "first_login_incomplete" },
    });
    throw new Error("First-login account setup must be completed before accessing audit data.");
  }

  const profile = await userService.getUserById(session.userId);
  if (!profile || profile.status !== "Active") {
    await auditService.emit({
      category: "SecurityDenial",
      eventType: "AuditAccessDenied",
      actorRole: profile?.role ?? null,
      targetRole: null,
      performedByUserId: session.userId,
      performedByUsername: profile?.username ?? null,
      details: { reasonCode: profile ? "account_inactive" : "unauthenticated" },
    });
    throw new Error("Authentication is required.");
  }
  if (profile.role !== "Admin" && profile.role !== "Developer") {
    await auditService.emit({
      category: "SecurityDenial",
      eventType: "AuditAccessDenied",
      actorRole: profile.role,
      targetRole: null,
      performedByUserId: profile.id,
      performedByUsername: profile.username,
      details: { reasonCode: "role_not_authorized" },
    });
    throw new Error("This role is not authorized to access audit data.");
  }

  return { role: profile.role };
}

export async function readAuditPageAction(input: unknown): Promise<AuditPageTransport> {
  const caller = await requireAuditCaller();
  const criteria = parseAuditReadInput(input);
  return auditReadService.readPage(criteria, caller.role);
}
