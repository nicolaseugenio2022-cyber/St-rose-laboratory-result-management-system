"use server";

import "server-only";

import type { HydratedTemplateSpec } from "@/services/interfaces";
import { getSession } from "@/lib/session";
import { SupabasePatientReportSessionRepository } from "@/repositories/supabase-session-repository";
import { reportRegistryService } from "@/services/report-registry-service";
import { userService } from "@/services/user-service-instance";
import {
  parseEmptyActionInput,
  parseRecentSessionsInput,
  parseRegistryTemplateInput,
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
};

async function requireOperationalCaller(): Promise<OperationalCaller> {
  const session = await getSession();
  if (!session) throw new Error("Authentication is required.");
  if (session.mustChangePassword || session.mustSetRecovery) {
    throw new Error("First-login account setup must be completed before accessing laboratory data.");
  }

  const profile = await userService.getUserById(session.userId);
  if (!profile || profile.status !== "Active") throw new Error("Authentication is required.");
  if (profile.role !== "Admin" && profile.role !== "User") {
    throw new Error("This role is not authorized to access patient or report-registry data.");
  }

  return { userId: profile.id, role: profile.role };
}

export async function listRecentSessionsAction(
  input: unknown
): Promise<PatientReportSessionTransport[]> {
  const caller = await requireOperationalCaller();
  const { limit } = parseRecentSessionsInput(input);
  const repository = new SupabasePatientReportSessionRepository(caller);
  const sessions = await repository.getRecentSessions(limit);
  return sessions.map(toSessionTransport);
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
  return toSessionTransport(completed);
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
