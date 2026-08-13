import "server-only";

// Durable audit write path for persistent security and account events.
import { randomUUID } from "node:crypto";
import type { AuthRole, IAuditLogRepository } from "@/repositories/interfaces";

export type AuditCategory =
  | "AuthAccount"
  | "PersonnelCredential"
  | "SessionReport"
  | "SecurityDenial";

export type RecoveryAuditEventType =
  | "RecoveryLookupAttempted"
  | "RecoveryLookupThrottled"
  | "RecoveryAnswerFailed"
  | "RecoveryAnswerVerified"
  | "RecoveryPasswordResetCompleted";

export type AuditEvent = {
  category: AuditCategory;
  eventType: string;
  actorRole: AuthRole | null;
  targetRole: AuthRole | null;
  performedByUserId?: string | null;
  performedByUsername?: string | null;
  targetReference?: string | null;
  details?: Record<string, unknown> | null;
};

const SENSITIVE_DETAIL_KEY = /pass(word)?|answer|hash|secret|token(?!Version)|cookie/i;

function assertDetailsAreStructurallySafe(value: unknown, visited = new WeakSet<object>()): void {
  if (!value || typeof value !== "object") return;
  if (visited.has(value)) return;
  visited.add(value);

  for (const [key, nestedValue] of Object.entries(value)) {
    if (SENSITIVE_DETAIL_KEY.test(key)) {
      throw new Error("Audit details contain a prohibited credential-material key.");
    }
    assertDetailsAreStructurallySafe(nestedValue, visited);
  }
}

export class AuditService {
  constructor(private readonly auditLogs: IAuditLogRepository) {}

  async emit(event: AuditEvent): Promise<void> {
    assertDetailsAreStructurallySafe(event.details);
    await this.auditLogs.append({
      id: randomUUID(),
      category: event.category,
      eventType: event.eventType,
      performedByUserId: event.performedByUserId ?? null,
      performedByUsername: event.performedByUsername ?? null,
      targetReference: event.targetReference ?? null,
      actorRole: event.actorRole,
      targetRole: event.targetRole,
      details: event.details ?? null,
      occurredAt: new Date().toISOString(),
    });
  }
}
