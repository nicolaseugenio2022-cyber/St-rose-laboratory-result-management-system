import "server-only";

// TEMPORARY minimum persistent audit path added for Forgot Password; the existing in-memory
// src/services/audit-log-service.ts prototype and its UI read path remain until full Milestone 6D.
import { randomUUID } from "node:crypto";
import type { IAuditLogRepository } from "@/repositories/interfaces";

export type RecoveryAuditEventType =
  | "RecoveryLookupAttempted"
  | "RecoveryLookupThrottled"
  | "RecoveryAnswerFailed"
  | "RecoveryAnswerVerified"
  | "RecoveryPasswordResetCompleted";

export type RecoveryAuditEvent = {
  eventType: RecoveryAuditEventType;
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

  async emit(event: RecoveryAuditEvent): Promise<void> {
    assertDetailsAreStructurallySafe(event.details);
    await this.auditLogs.append({
      id: randomUUID(),
      category: "Authentication",
      eventType: event.eventType,
      performedByUserId: event.performedByUserId ?? null,
      performedByUsername: event.performedByUsername ?? null,
      targetReference: event.targetReference ?? null,
      details: event.details ?? null,
      occurredAt: new Date().toISOString(),
    });
  }
}
