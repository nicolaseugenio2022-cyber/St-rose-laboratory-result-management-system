import "server-only";

import { SupabaseAuditLogRepository } from "@/repositories/supabase-audit-log-repository";
import { SupabaseCredentialRepository } from "@/repositories/supabase-credential-repository";
import { SupabaseLoginAttemptRepository } from "@/repositories/supabase-login-attempt-repository";
import { AuditService } from "@/services/audit-service";
import { UserService } from "@/services/userService";

export const userService = new UserService(
  new SupabaseCredentialRepository(),
  new SupabaseLoginAttemptRepository(),
  new AuditService(new SupabaseAuditLogRepository())
);
