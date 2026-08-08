/**
 * Audit Log Event Domain Types & Entity
 * Aligned 100% with SECURITY_MODEL.md Section 10
 */

export type AuditEventCategory =
  | "AuthAccount"
  | "PersonnelCredential"
  | "SessionReport"
  | "SecurityDenial";

export interface IAuditLogEntry {
  id: string;
  category: AuditEventCategory;
  eventType: string;
  performedByUserId: string;
  performedByUsername: string;
  targetEntityId?: string | null;
  targetEntityType?: string | null;
  details: Record<string, unknown>;
  ipAddress?: string | null;
  timestamp: string; // ISO 8601
}

export class AuditLogEntryDomain implements IAuditLogEntry {
  readonly id: string;
  readonly category: AuditEventCategory;
  readonly eventType: string;
  readonly performedByUserId: string;
  readonly performedByUsername: string;
  readonly targetEntityId?: string | null;
  readonly targetEntityType?: string | null;
  readonly details: Record<string, unknown>;
  readonly ipAddress?: string | null;
  readonly timestamp: string;

  constructor(init: IAuditLogEntry) {
    this.id = init.id;
    this.category = init.category;
    this.eventType = init.eventType;
    this.performedByUserId = init.performedByUserId;
    this.performedByUsername = init.performedByUsername;
    this.targetEntityId = init.targetEntityId ?? null;
    this.targetEntityType = init.targetEntityType ?? null;
    this.details = init.details || {};
    this.ipAddress = init.ipAddress ?? null;
    this.timestamp = init.timestamp || new Date().toISOString();
  }
}
