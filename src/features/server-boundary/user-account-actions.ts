"use server";

import "server-only";

import { checkRouteAccess, getCurrentUserProfile } from "@/lib/auth-guards";
import { resetUserPasswordSchema } from "@/lib/validations/userValidation";
import { auditService } from "@/services/audit-service-instance";
import { userService } from "@/services/user-service-instance";
import type { User } from "@/types/user";

export async function resetUserPasswordAction(input: unknown): Promise<User> {
  const caller = await getCurrentUserProfile();
  const access = checkRouteAccess("/users", caller);
  if (
    !access.allowed ||
    !caller ||
    (caller.role !== "Admin" && caller.role !== "Developer")
  ) {
    throw new Error("Unauthorized");
  }
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
  return user;
}
