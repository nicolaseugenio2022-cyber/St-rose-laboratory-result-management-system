"use server";

import "server-only";

import { authorizeOrdinaryAccountWrite } from "@/features/server-boundary/ordinary-account-guard";
import {
  toAdminAccountEntry,
  type AdminAccountEntry,
} from "@/features/users/account-directory-entry";
import { resetUserPasswordSchema } from "@/lib/validations/userValidation";
import { auditService } from "@/services/audit-service-instance";
import { userService } from "@/services/user-service-instance";

/**
 * Reset an ordinary account's password.
 *
 * Admin only. This action previously accepted `caller.role === "Developer"` explicitly, which made
 * it the most sensitive of the four Developer writes: resetting a password rotates the credential
 * and increments `tokenVersion`, invalidating the target's live sessions. ADR-005 and
 * SECURITY_MODEL.md §6.4 both place that outside Developer's privileges. Developer retains
 * `resetDeveloperPasswordAction` for Developer accounts, which is unaffected.
 *
 * Two boundaries now refuse it rather than one: this guard, and `userService.resetUserPassword`,
 * which no longer accepts a Developer caller role even if reached another way.
 *
 * The result is projected. It used to return the full `User`, handing the browser `tokenVersion`
 * and `passwordUpdatedAt` for an account whose credential had just changed - the state of a
 * credential, which SECURITY_MODEL.md §74 keeps out of every browser-reachable projection.
 */
export async function resetUserPasswordAction(input: unknown): Promise<AdminAccountEntry> {
  const auth = await authorizeOrdinaryAccountWrite("RESET");
  if (!auth.authorized) {
    throw new Error("Unauthorized");
  }
  const caller = auth.caller;

  const { id, ...updates } = resetUserPasswordSchema.parse(input);
  const user = await userService.resetUserPassword(id, updates, caller.role);
  await auditService.emit({
    category: "AuthAccount",
    eventType: "AccountPasswordReset",
    actorRole: caller.role,
    targetRole: user.role,
    performedByUserId: caller.id,
    performedByUsername: caller.username,
    targetReference: user.username,
    details: { targetUserId: user.id },
  });
  return toAdminAccountEntry(user);
}
