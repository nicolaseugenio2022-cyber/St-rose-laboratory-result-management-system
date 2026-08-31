import "server-only";

import { checkRouteAccess, getCurrentUserProfile } from "@/lib/auth-guards";
import { auditService } from "@/services/audit-service-instance";
import type { UserProfile } from "@/types/user";

/**
 * The authorization boundary for ordinary (Admin / User) account operations.
 *
 * Every `/users` operation previously authorized through `checkRouteAccess("/users", caller)`
 * alone. That function admits **Admin and Developer**, because it answers "may this role reach the
 * route", and reaching a route is not the same question as being allowed to write through it.
 * The result was that POST, PATCH, DELETE and the password reset each accepted a Developer caller:
 * Developer could create, edit, deactivate, delete and reset the password of ordinary accounts.
 *
 * That contradicts the authorities directly. ADR-005 records that Developer **"holds no
 * user-management writes"** and may read only a restricted projection; SECURITY_MODEL.md §6.4 adds
 * **"no password-reset controls, no account write operations"**. Read access was correct all along
 * - only the writes were over-granted.
 *
 * Both helpers below therefore resolve the caller from the verified session, never from request
 * input, and split the single previous question into the two that were being conflated:
 *
 *   - `authorizeOrdinaryAccountRead`  - Admin or Developer.
 *   - `authorizeOrdinaryAccountWrite` - Admin only.
 *
 * They return a result rather than throwing, because the two callers need different failures: a
 * route handler owes the browser a 403 response, a Server Action owes it a thrown error. Encoding
 * that as a return value keeps the audit emission in one place instead of one per call site.
 */

/** Mirrors the `method` value the existing denial details already carry. */
export type OrdinaryAccountMethod = "GET" | "POST" | "PATCH" | "DELETE" | "RESET";

export type OrdinaryAccountAuthorization =
  | { authorized: true; caller: UserProfile }
  | { authorized: false };

/**
 * Emit the denial.
 *
 * Deliberately the same event the route handlers already emitted, field for field: category
 * `SecurityDenial`, type `UserManagementAccessDenied`, roles and identity resolved from the
 * persisted profile, and a `details` object of exactly `{ reasonCode, method }`. Audit semantics
 * are preserved rather than extended - a Developer refused a write is `role_not_authorized`, which
 * is the same reason code an unauthorized role already produced.
 */
async function emitDenial(
  caller: UserProfile | null,
  method: OrdinaryAccountMethod
): Promise<void> {
  await auditService.emit({
    category: "SecurityDenial",
    eventType: "UserManagementAccessDenied",
    actorRole: caller?.role ?? null,
    targetRole: null,
    performedByUserId: caller?.id ?? null,
    performedByUsername: caller?.username ?? null,
    details: {
      reasonCode: caller ? "role_not_authorized" : "unauthenticated",
      method,
    },
  });
}

/**
 * Authorize reading the ordinary-account directory: Admin or Developer.
 *
 * Unchanged in effect from the previous guard - `checkRouteAccess` already limits `/users` to
 * those two roles, and also enforces active status and first-login completion. What the caller
 * then *sees* is narrowed by the projection in `account-directory-entry.ts`, not here: this
 * function answers "may you read", and that module answers "how much".
 */
export async function authorizeOrdinaryAccountRead(
  method: OrdinaryAccountMethod
): Promise<OrdinaryAccountAuthorization> {
  const caller = await getCurrentUserProfile();
  const access = checkRouteAccess("/users", caller);

  if (!access.allowed || !caller) {
    await emitDenial(caller, method);
    return { authorized: false };
  }
  return { authorized: true, caller };
}

/**
 * Authorize writing an ordinary account: Admin only.
 *
 * The route gate still runs first, so an inactive or first-login-incomplete Admin is refused for
 * the reason that actually applies rather than being mislabelled a role failure. The Admin check
 * is then the addition this slice exists for.
 *
 * This is the authoritative boundary. The client hides its management controls from Developer as
 * well, but that is presentation: a Developer posting directly to the route is refused here, on
 * the server, from the session-derived role - not because a button was absent.
 */
export async function authorizeOrdinaryAccountWrite(
  method: OrdinaryAccountMethod
): Promise<OrdinaryAccountAuthorization> {
  const caller = await getCurrentUserProfile();
  const access = checkRouteAccess("/users", caller);

  if (!access.allowed || !caller || caller.role !== "Admin") {
    await emitDenial(caller, method);
    return { authorized: false };
  }
  return { authorized: true, caller };
}
