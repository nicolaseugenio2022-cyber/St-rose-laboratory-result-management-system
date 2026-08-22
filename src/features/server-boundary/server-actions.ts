"use server";

import "server-only";

import type { HydratedTemplateSpec } from "@/services/interfaces";
import type { IPersonnel } from "@/domain/models/interfaces";
import { getSession, getSessionUser } from "@/lib/session";
import { SupabasePersonnelRepository } from "@/repositories/supabase-personnel-repository";
import { SupabasePatientReportSessionRepository } from "@/repositories/supabase-session-repository";
import { auditService } from "@/services/audit-service-instance";
import { reportRegistryService } from "@/services/report-registry-service";
import {
  parseEmptyActionInput,
  parseRecentSessionsInput,
  parseRegistryTemplateInput,
  parseSessionLoadInput,
  parseSessionMutationInput,
} from "@/features/server-boundary/action-inputs";
import {
  fromSessionTransport,
  PatientReportSessionTransport,
  toSessionTransport,
} from "@/features/server-boundary/session-transport";

type OperationalCaller = {
  userId: string;
  role: "Admin" | "User";
  username: string;
};

export type SessionHistoryEntryTransport = {
  session: PatientReportSessionTransport;
  canReopen: boolean;
};

async function requireOperationalCaller(): Promise<OperationalCaller> {
  const session = await getSession();
  if (!session) {
    await auditService.emit({
      category: "SecurityDenial",
      eventType: "OperationalAccessDenied",
      actorRole: null,
      targetRole: null,
      details: { reasonCode: "unauthenticated" },
    });
    throw new Error("Authentication is required.");
  }
  if (session.mustChangePassword || session.mustSetRecovery) {
    await auditService.emit({
      category: "SecurityDenial",
      eventType: "OperationalAccessDenied",
      actorRole: null,
      targetRole: null,
      performedByUserId: session.userId,
      details: { reasonCode: "first_login_incomplete" },
    });
    throw new Error("First-login account setup must be completed before accessing laboratory data.");
  }

  const profile = await getSessionUser();
  if (!profile || profile.status !== "Active") {
    await auditService.emit({
      category: "SecurityDenial",
      eventType: "OperationalAccessDenied",
      actorRole: profile?.role ?? null,
      targetRole: null,
      performedByUserId: session.userId,
      performedByUsername: profile?.username ?? null,
      details: { reasonCode: profile ? "account_inactive" : "unauthenticated" },
    });
    throw new Error("Authentication is required.");
  }
  if (profile.role !== "Admin" && profile.role !== "User") {
    await auditService.emit({
      category: "SecurityDenial",
      eventType: "OperationalAccessDenied",
      actorRole: profile.role,
      targetRole: null,
      performedByUserId: profile.id,
      performedByUsername: profile.username,
      details: { reasonCode: "role_not_authorized" },
    });
    throw new Error("This role is not authorized to access patient or report-registry data.");
  }

  return { userId: profile.id, role: profile.role, username: profile.username };
}

export async function listRecentSessionsAction(
  input: unknown
): Promise<SessionHistoryEntryTransport[]> {
  const caller = await requireOperationalCaller();
  const { limit, search } = parseRecentSessionsInput(input);
  const repository = new SupabasePatientReportSessionRepository(caller);
  const sessions = await repository.getRecentSessionsWithOwnership(limit, search);
  return sessions.map((entry) => ({
    session: toSessionTransport(entry.session),
    canReopen: entry.ownedByCaller,
  }));
}

export async function deleteDraftSessionAction(input: unknown): Promise<void> {
  const caller = await requireOperationalCaller();
  const { sessionId } = parseSessionLoadInput(input);
  const repository = new SupabasePatientReportSessionRepository(caller);
  await repository.deleteDraftSession(sessionId);
  await auditService.emit({
    category: "SessionReport",
    eventType: "SessionDraftDeleted",
    actorRole: caller.role,
    targetRole: null,
    performedByUserId: caller.userId,
    performedByUsername: caller.username,
    targetReference: sessionId,
    details: { sessionId, deletedAt: new Date().toISOString() },
  });
}

export async function saveDraftAction(
  input: unknown
): Promise<PatientReportSessionTransport> {
  const caller = await requireOperationalCaller();
  const transport = parseSessionMutationInput(input);
  if (transport.status !== "Draft") throw new Error("Only draft sessions may be saved as drafts.");

  const repository = new SupabasePatientReportSessionRepository(caller);
  const saved = await repository.saveDraft(fromSessionTransport(transport));
  return toSessionTransport(saved);
}

export async function completeSessionAction(
  input: unknown
): Promise<PatientReportSessionTransport> {
  const caller = await requireOperationalCaller();
  const transport = parseSessionMutationInput(input);
  if (transport.status !== "Draft") throw new Error("Only draft sessions may be completed.");

  const repository = new SupabasePatientReportSessionRepository(caller);
  const completed = await repository.completeSession(fromSessionTransport(transport));

  const reportCount = completed.reports.length;
  const templateCodes = completed.reports.map((report) => report.templateCode);
  await auditService.emit({
    category: "SessionReport",
    eventType: "SessionCompleted",
    actorRole: caller.role,
    targetRole: null,
    performedByUserId: caller.userId,
    performedByUsername: caller.username,
    targetReference: completed.accessionNumber,
    details: { reportCount, templateCodes },
  });

  return toSessionTransport(completed);
}

export async function replaceSessionAction(
  input: unknown
): Promise<PatientReportSessionTransport> {
  const caller = await requireOperationalCaller();
  const transport = parseSessionMutationInput(input);
  if (transport.status !== "Completed") {
    await auditService.emit({
      category: "SecurityDenial",
      eventType: "SessionReplacementDenied",
      actorRole: caller.role,
      targetRole: null,
      performedByUserId: caller.userId,
      performedByUsername: caller.username,
      details: { reasonCode: "session_not_completed" },
    });
    throw new Error("Only completed sessions may be replaced.");
  }

  const repository = new SupabasePatientReportSessionRepository(caller);
  const replacement = fromSessionTransport(transport).recompleteSession();
  const replaced = await repository.replaceSession(replacement);

  const reportCount = replaced.reports.length;
  const templateCodes = replaced.reports.map((report) => report.templateCode);
  await auditService.emit({
    category: "SessionReport",
    eventType: "SessionReplaced",
    actorRole: caller.role,
    targetRole: null,
    performedByUserId: caller.userId,
    performedByUsername: caller.username,
    targetReference: replaced.accessionNumber,
    details: { reportCount, templateCodes },
  });

  return toSessionTransport(replaced);
}

export async function getReopenableSessionAction(
  input: unknown
): Promise<PatientReportSessionTransport> {
  const caller = await requireOperationalCaller();
  const { sessionId } = parseSessionLoadInput(input);
  const repository = new SupabasePatientReportSessionRepository(caller);
  const session = await repository.findReopenableSessionForCaller(sessionId);
  if (!session) {
    await auditService.emit({
      category: "SecurityDenial",
      eventType: "SessionReopenDenied",
      actorRole: caller.role,
      targetRole: null,
      performedByUserId: caller.userId,
      performedByUsername: caller.username,
      details: { reasonCode: "session_not_replaceable" },
    });
    throw new Error("This session cannot be reopened.");
  }

  return toSessionTransport(session);
}

export async function listActivePersonnelAction(): Promise<IPersonnel[]> {
  await requireOperationalCaller();
  const repository = new SupabasePersonnelRepository();
  return repository.findAllActive();
}

export async function listRegistryTemplatesAction(
  input: unknown
): Promise<HydratedTemplateSpec[]> {
  await requireOperationalCaller();
  parseEmptyActionInput(input);
  return reportRegistryService.warmCache();
}

export async function getRegistryTemplateAction(
  input: unknown
): Promise<HydratedTemplateSpec | null> {
  await requireOperationalCaller();
  const { templateCode } = parseRegistryTemplateInput(input);
  return reportRegistryService.getTemplateByCode(templateCode);
}
