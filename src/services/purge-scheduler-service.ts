import { SupabasePatientReportSessionRepository } from "@/repositories/supabase-session-repository";
import { auditLogService } from "./audit-log-service";

/**
 * Scheduled Purge & Recovery Service
 * Integrates retention purge execution for expired sessions per SECURITY_MODEL.md and DOMAIN_MODEL.md.
 * Note: purgeExpiredSessions() is invoked by an external scheduler / cron trigger.
 */
export class PurgeSchedulerService {
  private sessionRepository: SupabasePatientReportSessionRepository;

  constructor(repository?: SupabasePatientReportSessionRepository) {
    this.sessionRepository = repository || new SupabasePatientReportSessionRepository();
  }

  /**
   * Execute scheduled retention purge of expired completed sessions (> 30 days old).
   */
  public async executeScheduledPurge(runnerUserId = "system-scheduler"): Promise<{ purgedCount: number; timestamp: string }> {
    const startTime = new Date().toISOString();
    const purgedCount = await this.sessionRepository.purgeExpiredSessions();

    if (purgedCount > 0) {
      await auditLogService.logEvent({
        category: "SessionReport",
        eventType: "AutomatedRetentionPurgeExecuted",
        performedByUserId: runnerUserId,
        performedByUsername: "System Retention Scheduler",
        details: {
          purgedCount,
          executionTimestamp: startTime,
          retentionWindowDays: 30,
        },
      });
    }

    return {
      purgedCount,
      timestamp: startTime,
    };
  }
}

export const purgeSchedulerService = new PurgeSchedulerService();
