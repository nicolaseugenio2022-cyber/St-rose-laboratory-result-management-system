"use server";

import "server-only";

import { parseAuditReadInput } from "@/features/server-boundary/audit-action-inputs";
import { getSession } from "@/lib/session";
import { auditReadService } from "@/services/audit-read-service-instance";
import type {
  AuditPageTransport,
  AuditReaderRole,
} from "@/services/audit-read-service";
import { userService } from "@/services/user-service-instance";

async function requireAuditCaller(): Promise<{ role: AuditReaderRole }> {
  const session = await getSession();
  if (!session) throw new Error("Authentication is required.");
  if (session.mustChangePassword || session.mustSetRecovery) {
    throw new Error("First-login account setup must be completed before accessing audit data.");
  }

  const profile = await userService.getUserById(session.userId);
  if (!profile || profile.status !== "Active") throw new Error("Authentication is required.");
  if (profile.role !== "Admin" && profile.role !== "Developer") {
    throw new Error("This role is not authorized to access audit data.");
  }

  return { role: profile.role };
}

export async function readAuditPageAction(input: unknown): Promise<AuditPageTransport> {
  const caller = await requireAuditCaller();
  const criteria = parseAuditReadInput(input);
  return auditReadService.readPage(criteria, caller.role);
}
