import "server-only";

import { supabaseServer } from "@/lib/supabase/server";
import type {
  AuditLogEntry,
  AuditLogQueryCriteria,
  IAuditLogQueryRepository,
  IAuditLogRepository,
} from "@/repositories/interfaces";

const AUDIT_LOG_COLUMNS = `
  id,
  category,
  event_type,
  performed_by_user_id,
  performed_by_username,
  target_reference,
  details,
  occurred_at
`;

type AuditLogRow = {
  id: string;
  category: string;
  event_type: string;
  performed_by_user_id: string | null;
  performed_by_username: string | null;
  target_reference: string | null;
  details: Record<string, unknown> | null;
  occurred_at: string;
};

function mapAuditLog(row: AuditLogRow): AuditLogEntry {
  return {
    id: row.id,
    category: row.category,
    eventType: row.event_type,
    performedByUserId: row.performed_by_user_id,
    performedByUsername: row.performed_by_username,
    targetReference: row.target_reference,
    details: row.details,
    occurredAt: row.occurred_at,
  };
}

function quotePostgrestValue(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function buildSearchPredicate(search: string): string {
  const pattern = quotePostgrestValue(`*${search}*`);
  return [
    `performed_by_username.ilike.${pattern}`,
    `target_reference.ilike.${pattern}`,
  ].join(",");
}

function buildExclusionPredicate(criteria: AuditLogQueryCriteria): string | null {
  const exclusion = criteria.exclusion;
  if (!exclusion) return null;

  const predicates: string[] = [];
  if (exclusion.performedByUserIds.length > 0) {
    const ids = exclusion.performedByUserIds.map(quotePostgrestValue).join(",");
    predicates.push(
      `or(performed_by_user_id.is.null,performed_by_user_id.not.in.(${ids}))`
    );
  }

  if (exclusion.usernames.length > 0) {
    const usernames = exclusion.usernames.map(quotePostgrestValue).join(",");
    predicates.push(
      `or(performed_by_username.is.null,performed_by_username.not.in.(${usernames}))`,
      `or(target_reference.is.null,target_reference.not.in.(${usernames}))`
    );
  }

  return predicates.length > 0 ? `and(${predicates.join(",")})` : null;
}

export class SupabaseAuditLogRepository
  implements IAuditLogRepository, IAuditLogQueryRepository
{
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

  async query(criteria: AuditLogQueryCriteria): Promise<AuditLogEntry[]> {
    let query = supabaseServer.from("audit_logs").select(AUDIT_LOG_COLUMNS);

    if (criteria.categories?.length === 1) {
      query = query.eq("category", criteria.categories[0]);
    } else if (criteria.categories && criteria.categories.length > 1) {
      query = query.in("category", criteria.categories);
    }
    if (criteria.eventType) query = query.eq("event_type", criteria.eventType);
    if (criteria.occurredAtFrom) {
      query = query.gte("occurred_at", criteria.occurredAtFrom);
    }
    if (criteria.occurredAtTo) query = query.lte("occurred_at", criteria.occurredAtTo);
    if (criteria.search) query = query.or(buildSearchPredicate(criteria.search));

    const exclusionPredicate = buildExclusionPredicate(criteria);
    if (exclusionPredicate) query = query.or(exclusionPredicate);

    const { data, error } = await query
      .order("occurred_at", { ascending: false })
      .order("id", { ascending: false })
      .range(criteria.offset, criteria.offset + criteria.limit - 1);

    if (error) throw error;
    if (!data) throw new Error("Supabase audit log query returned no data.");
    return data.map((row) => mapAuditLog(row as AuditLogRow));
  }

  async count(criteria: AuditLogQueryCriteria): Promise<number> {
    let query = supabaseServer
      .from("audit_logs")
      .select("id", { count: "exact", head: true });

    if (criteria.categories?.length === 1) {
      query = query.eq("category", criteria.categories[0]);
    } else if (criteria.categories && criteria.categories.length > 1) {
      query = query.in("category", criteria.categories);
    }
    if (criteria.eventType) query = query.eq("event_type", criteria.eventType);
    if (criteria.occurredAtFrom) {
      query = query.gte("occurred_at", criteria.occurredAtFrom);
    }
    if (criteria.occurredAtTo) query = query.lte("occurred_at", criteria.occurredAtTo);
    if (criteria.search) query = query.or(buildSearchPredicate(criteria.search));

    const exclusionPredicate = buildExclusionPredicate(criteria);
    if (exclusionPredicate) query = query.or(exclusionPredicate);

    const { count, error } = await query;
    if (error) throw error;
    if (count === null) throw new Error("Supabase audit log count returned no count.");
    return count;
  }
}
