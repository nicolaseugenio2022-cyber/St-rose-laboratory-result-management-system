import "server-only";

import { SupabaseAuditLogRepository } from "@/repositories/supabase-audit-log-repository";
import { AuditService } from "@/services/audit-service";

export const auditService = new AuditService(new SupabaseAuditLogRepository());
