import "server-only";

import { cache } from "react";
import { SupabaseAuditLogRepository } from "@/repositories/supabase-audit-log-repository";
import { SupabaseCredentialRepository } from "@/repositories/supabase-credential-repository";
import { AuditReadService } from "@/services/audit-read-service";

/**
 * CLINIC-PERF-02: the Admin audit read's Developer-identity lookup, memoized per render.
 *
 * `readPage` needs the Developer identities to build the Admin exclusion filter, and it used to
 * discover that only after the page had resolved the caller - so /audit paid three sequential
 * Supabase round trips instead of two. The page now starts this read before it resolves the caller
 * (`prefetchDeveloperIdentities`), and `readPage` picks up the same promise.
 *
 * React `cache()` memoizes within one Server Component render and nowhere else. Nothing is shared
 * across requests, so a Developer account created or renamed is excluded on the very next read,
 * exactly as before. Outside a render - the audit auto-sync Server Action - it calls straight
 * through and behaves as it always did.
 */
class RenderScopedCredentialRepository extends SupabaseCredentialRepository {
  private readonly listDeveloperIdentitiesForRender: () => Promise<{ id: string; username: string }[]>;

  constructor() {
    super();
    this.listDeveloperIdentitiesForRender = cache(super.listDeveloperIdentities.bind(this));
  }

  override listDeveloperIdentities(): Promise<{ id: string; username: string }[]> {
    return this.listDeveloperIdentitiesForRender();
  }
}

const credentialDirectory = new RenderScopedCredentialRepository();

export const auditReadService = new AuditReadService(
  new SupabaseAuditLogRepository(),
  credentialDirectory
);

/**
 * Starts this render's Developer-identity read without waiting for it.
 *
 * Speculative by design: it runs before the caller's role is known. Only `readPage`'s Admin branch
 * ever consumes the result, from the same memoized promise; for a Developer or an unauthorized
 * caller it is discarded on the server and never reaches a response. The rejection handler exists
 * only so a discarded read cannot surface as an unhandled rejection - `readPage` awaits the
 * original promise and still receives any failure unchanged.
 */
export function prefetchDeveloperIdentities(): void {
  credentialDirectory.listDeveloperIdentities().catch(() => undefined);
}
