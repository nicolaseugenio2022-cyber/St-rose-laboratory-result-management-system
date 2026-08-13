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
  return userService.createDeveloperAccount(parsed, caller.role);
}

export async function updateDeveloperUsernameAction(input: unknown): Promise<User> {
  const caller = await requireDeveloper();
  const { id, ...updates } = updateDeveloperUsernameSchema.parse(input);
  return userService.updateDeveloperUsername(id, updates, caller.role);
}

export async function updateDeveloperSecurityQuestionAction(
  input: unknown
): Promise<User> {
  const caller = await requireDeveloper();
  const { id, ...updates } = updateDeveloperSecurityQuestionSchema.parse(input);
  return userService.updateDeveloperSecurityQuestion(id, updates, caller.role);
}

export async function resetDeveloperPasswordAction(input: unknown): Promise<User> {
  const caller = await requireDeveloper();
  const { id, ...updates } = resetDeveloperPasswordSchema.parse(input);
  return userService.resetDeveloperPassword(id, updates, caller.role);
}

export async function toggleDeveloperStatusAction(input: unknown): Promise<User> {
  const caller = await requireDeveloper();
  const { id } = developerAccountIdSchema.parse(input);
  return userService.toggleDeveloperStatus(id, caller.id, caller.role);
}

export async function deleteDeveloperAccountAction(input: unknown): Promise<void> {
  const caller = await requireDeveloper();
  const { id } = developerAccountIdSchema.parse(input);
  await userService.deleteDeveloperAccount(id, caller.id, caller.role);
}
