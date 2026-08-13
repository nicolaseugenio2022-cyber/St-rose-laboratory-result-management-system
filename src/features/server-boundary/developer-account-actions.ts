"use server";

import "server-only";

import { requireDeveloper } from "@/lib/developer-guard";
import {
  createDeveloperAccountSchema,
  developerAccountIdSchema,
  emptyDeveloperAccountActionSchema,
  resetDeveloperPasswordSchema,
  updateDeveloperSecurityQuestionSchema,
  updateDeveloperUsernameSchema,
} from "@/lib/validations/developerAccountValidation";
import { auditService } from "@/services/audit-service-instance";
import { userService } from "@/services/user-service-instance";
import type { User } from "@/types/user";

export async function listDeveloperAccountsAction(input: unknown): Promise<User[]> {
  const caller = await requireDeveloper();
  emptyDeveloperAccountActionSchema.parse(input);
  return userService.getDeveloperAccounts(caller.role);
}

export async function createDeveloperAccountAction(input: unknown): Promise<User> {
  const caller = await requireDeveloper();
  const parsed = createDeveloperAccountSchema.parse(input);
  const user = await userService.createDeveloperAccount(parsed, caller.role);
  await auditService.emit({
    category: "AuthAccount",
    eventType: "AccountCreated",
    actorRole: caller.role,
    targetRole: user.role,
    performedByUserId: caller.id,
    performedByUsername: caller.username,
    targetReference: user.username,
    details: { targetUserId: user.id, status: user.status },
  });
  return user;
}

export async function updateDeveloperUsernameAction(input: unknown): Promise<User> {
  const caller = await requireDeveloper();
  const { id, ...updates } = updateDeveloperUsernameSchema.parse(input);
  const user = await userService.updateDeveloperUsername(id, updates, caller.role);
  await auditService.emit({
    category: "AuthAccount",
    eventType: "AccountUsernameChanged",
    actorRole: caller.role,
    targetRole: user.role,
    performedByUserId: caller.id,
    performedByUsername: caller.username,
    targetReference: user.username,
    details: { targetUserId: user.id },
  });
  return user;
}

export async function updateDeveloperSecurityQuestionAction(
  input: unknown
): Promise<User> {
  const caller = await requireDeveloper();
  const { id, ...updates } = updateDeveloperSecurityQuestionSchema.parse(input);
  const user = await userService.updateDeveloperSecurityQuestion(id, updates, caller.role);
  await auditService.emit({
    category: "AuthAccount",
    eventType: "AccountSecurityQuestionReset",
    actorRole: caller.role,
    targetRole: user.role,
    performedByUserId: caller.id,
    performedByUsername: caller.username,
    targetReference: user.username,
    details: { targetUserId: user.id },
  });
  return user;
}

export async function resetDeveloperPasswordAction(input: unknown): Promise<User> {
  const caller = await requireDeveloper();
  const { id, ...updates } = resetDeveloperPasswordSchema.parse(input);
  const user = await userService.resetDeveloperPassword(id, updates, caller.role);
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

export async function toggleDeveloperStatusAction(input: unknown): Promise<User> {
  const caller = await requireDeveloper();
  const { id } = developerAccountIdSchema.parse(input);
  const user = await userService.toggleDeveloperStatus(id, caller.id, caller.role);
  await auditService.emit({
    category: "AuthAccount",
    eventType: "AccountStatusToggled",
    actorRole: caller.role,
    targetRole: user.role,
    performedByUserId: caller.id,
    performedByUsername: caller.username,
    targetReference: user.username,
    details: { targetUserId: user.id, status: user.status },
  });
  return user;
}

export async function deleteDeveloperAccountAction(input: unknown): Promise<void> {
  const caller = await requireDeveloper();
  const { id } = developerAccountIdSchema.parse(input);
  const target = await userService.getUserByIdVisibleTo(id, caller.role);
  await userService.deleteDeveloperAccount(id, caller.id, caller.role);
  await auditService.emit({
    category: "AuthAccount",
    eventType: "AccountDeleted",
    actorRole: caller.role,
    targetRole: target?.role ?? null,
    performedByUserId: caller.id,
    performedByUsername: caller.username,
    targetReference: target?.username ?? null,
    details: { targetUserId: id, previousStatus: target?.status ?? null },
  });
}
