import "server-only";

import { supabaseServer } from "@/lib/supabase/server";
import type { AuditLogEntry, IAuditLogRepository } from "@/repositories/interfaces";

export class SupabaseAuditLogRepository implements IAuditLogRepository {
  async append(entry: AuditLogEntry): Promise<void> {
    const { error } = await supabaseServer.from("audit_logs").insert({
      id: entry.id,
      category: entry.category,
      event_type: entry.eventType,
      performed_by_user_id: entry.performedByUserId,
      performed_by_username: entry.performedByUsername,
      target_reference: entry.targetReference,
      details: entry.details,
      occurred_at: entry.occurredAt,
    });

    if (error) throw error;
  }
}
