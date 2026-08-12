import { z } from "zod";
import type { IPatientReportSession } from "@/domain/models/interfaces";

const OWNERSHIP_ALIASES = new Set([
  "createdby",
  "createdbyuser",
  "createdbyuserid",
  "creatoruserid",
  "owner",
  "ownerid",
  "owneruserid",
  "ownedby",
  "ownedbyuserid",
  "ownership",
  "ownershipid",
  "ownershipuserid",
]);

function normalizedFieldName(fieldName: string): string {
  return fieldName.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function assertNoOwnershipFields(value: unknown): void {
  if (Array.isArray(value)) {
    for (const item of value) assertNoOwnershipFields(item);
    return;
  }

  if (!value || typeof value !== "object") return;

  for (const [fieldName, fieldValue] of Object.entries(value)) {
    if (OWNERSHIP_ALIASES.has(normalizedFieldName(fieldName))) {
      throw new Error("Session ownership is server-authoritative; ownership fields are forbidden.");
    }
    assertNoOwnershipFields(fieldValue);
  }
}

const laboratoryResultSchema = z.object({
  id: z.string().min(1),
  reportId: z.string().min(1),
  parameterCode: z.string(),
  parameterName: z.string(),
  resultValue: z.string(),
  rawResultValue: z.string().nullable().optional(),
  formattedResultValue: z.string().nullable().optional(),
  unit: z.string().nullable().optional(),
  evaluationOutcome: z.string(),
  referenceRuleSnapshot: z.unknown().nullable().optional(),
  computationMetadata: z.record(z.string(), z.unknown()).nullable().optional(),
  displayOrder: z.number(),
  isSelected: z.boolean().optional(),
}).strict();

const laboratoryReportSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  templateCode: z.string().min(1),
  templateTitle: z.string(),
  rendererFamily: z.string(),
  reagentKitInfo: z.unknown().nullable().optional(),
  remarks: z.string().nullable().optional(),
  encodingData: z.unknown().optional(),
  results: z.array(laboratoryResultSchema),
  signatories: z.array(z.unknown()),
}).strict();

const patientReportSessionSchema = z.object({
  id: z.string().min(1),
  accessionNumber: z.string().min(1),
  status: z.enum(["Draft", "Completed"]),
  demographics: z.record(z.string(), z.unknown()),
  reports: z.array(laboratoryReportSchema),
  createdAt: z.string().min(1),
  completedAt: z.string().nullable().optional(),
  expiresAt: z.string().nullable().optional(),
  completedSnapshot: z.unknown().nullable().optional(),
}).strict();

const sessionMutationInputSchema = z.object({
  session: patientReportSessionSchema,
}).strict();

const recentSessionsInputSchema = z.object({
  limit: z.number().int().min(1).max(100),
}).strict();

const registryTemplateInputSchema = z.object({
  templateCode: z.string().trim().min(1).max(100),
}).strict();

const emptyActionInputSchema = z.object({}).strict();

export function parseSessionMutationInput(input: unknown): IPatientReportSession {
  assertNoOwnershipFields(input);
  return sessionMutationInputSchema.parse(input).session as unknown as IPatientReportSession;
}

export function parseRecentSessionsInput(input: unknown): { limit: number } {
  assertNoOwnershipFields(input);
  return recentSessionsInputSchema.parse(input);
}

export function parseRegistryTemplateInput(input: unknown): { templateCode: string } {
  assertNoOwnershipFields(input);
  return registryTemplateInputSchema.parse(input);
}

export function parseEmptyActionInput(input: unknown): void {
  assertNoOwnershipFields(input);
  emptyActionInputSchema.parse(input);
}
