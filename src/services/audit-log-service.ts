import { AuditLogEntryDomain, AuditEventCategory, IAuditLogEntry } from "@/domain/models/audit-log-entry";

/**
 * Audit Logging Service
 * Implements the mandatory security audit logging architecture from SECURITY_MODEL.md Section 10.
 * Supports:
 * - Auth & Account events
 * - Personnel & Credential events
 * - Session & Report events
 * - Security Access & Denial events
 */
export class AuditLogService {
  private static logs: AuditLogEntryDomain[] = [];

  /**
   * Record a security audit event into the append-only log boundary.
   */
  public async logEvent(params: {
    category: AuditEventCategory;
    eventType: string;
    performedByUserId: string;
    performedByUsername: string;
    targetEntityId?: string | null;
    targetEntityType?: string | null;
    details?: Record<string, unknown>;
    ipAddress?: string | null;
  }): Promise<AuditLogEntryDomain> {
    const entry = new AuditLogEntryDomain({
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      category: params.category,
      eventType: params.eventType,
      performedByUserId: params.performedByUserId,
      performedByUsername: params.performedByUsername,
      targetEntityId: params.targetEntityId,
      targetEntityType: params.targetEntityType,
      details: params.details || {},
      ipAddress: params.ipAddress,
      timestamp: new Date().toISOString(),
    });

    AuditLogService.logs.unshift(entry);
    return entry;
  }

  /**
   * Retrieve audit logs, optionally filtered by category.
   */
  public async getLogs(category?: AuditEventCategory): Promise<AuditLogEntryDomain[]> {
    if (category) {
      return AuditLogService.logs.filter((l) => l.category === category);
    }
    return AuditLogService.logs;
  }

  /**
   * Clear logs (for unit testing purposes only).
   */
  public async clearLogsForTesting(): Promise<void> {
    AuditLogService.logs = [];
  }
}

export const auditLogService = new AuditLogService();
