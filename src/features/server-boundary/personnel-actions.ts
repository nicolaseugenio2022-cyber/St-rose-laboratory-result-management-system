"use server";

import "server-only";

import type { IPersonnel } from "@/domain/models/interfaces";
import { requirePersonnelAdmin, requirePersonnelReader } from "@/lib/personnel-guard";
import {
  createPersonnelSchema,
  updatePersonnelSchema,
  personnelStatusSchema,
} from "@/lib/validations/personnelValidation";
import { SupabasePersonnelRepository } from "@/repositories/supabase-personnel-repository";
import { auditService } from "@/services/audit-service-instance";

export type PersonnelActionResult =
  | { success: true; data: IPersonnel }
  | { success: false; error: "DUPLICATE_PRC" };

export async function listPersonnelAction(): Promise<IPersonnel[]> {
  await requirePersonnelReader();
  const repository = new SupabasePersonnelRepository();
  return repository.findAll();
}

export async function createPersonnelAction(input: unknown): Promise<PersonnelActionResult> {
  const caller = await requirePersonnelAdmin();
  const parsed = createPersonnelSchema.parse(input);
  const repository = new SupabasePersonnelRepository();

  let created: IPersonnel;
  try {
    created = await repository.create({
      firstName: parsed.firstName,
      lastName: parsed.lastName,
      middleInitial: parsed.middleInitial ?? null,
      credentials: parsed.credentials,
      prcLicenseNumber: parsed.prcLicenseNumber,
      role: parsed.role,
      signatureImageUrl: null,
      isActive: parsed.isActive,
    });
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: string }).code === "23505"
    ) {
      return { success: false, error: "DUPLICATE_PRC" };
    }
    throw error;
  }

  await auditService.emit({
    category: "PersonnelCredential",
    eventType: "PersonnelRecordCreated",
    actorRole: caller.role,
    targetRole: null,
    performedByUserId: caller.userId,
    performedByUsername: caller.username,
    targetReference: `${created.firstName} ${created.lastName}`,
    details: {
      personnelId: created.id,
      personnelRole: created.role,
      isActive: created.isActive,
    },
  });

  return { success: true, data: created };
}

export async function updatePersonnelAction(input: unknown): Promise<PersonnelActionResult> {
  const caller = await requirePersonnelAdmin();
  const parsed = updatePersonnelSchema.parse(input);
  const { id, ...rawUpdates } = parsed;
  const repository = new SupabasePersonnelRepository();

  const existing = await repository.findById(id);
  if (!existing) {
    throw new Error("Personnel record was not found.");
  }

  const updates: Partial<IPersonnel> = {};
  if (rawUpdates.firstName !== undefined) updates.firstName = rawUpdates.firstName;
  if (rawUpdates.lastName !== undefined) updates.lastName = rawUpdates.lastName;
  if (rawUpdates.middleInitial !== undefined) updates.middleInitial = rawUpdates.middleInitial;
  if (rawUpdates.credentials !== undefined) updates.credentials = rawUpdates.credentials;
  if (rawUpdates.prcLicenseNumber !== undefined) {
    updates.prcLicenseNumber = rawUpdates.prcLicenseNumber;
  }
  if (rawUpdates.role !== undefined) updates.role = rawUpdates.role;

  const resolvedRole = updates.role ?? existing.role;
  if (resolvedRole === "MedicalTechnologist") {
    updates.signatureImageUrl = null;
  }
  // For Pathologist: omit signatureImageUrl entirely to preserve existing URL.

  if (rawUpdates.isActive !== undefined) updates.isActive = rawUpdates.isActive;

  let updated: IPersonnel;
  try {
    updated = await repository.update(id, updates);
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: string }).code === "23505"
    ) {
      return { success: false, error: "DUPLICATE_PRC" };
    }
    throw error;
  }

  const changedFields: string[] = [];
  for (const key of Object.keys(updates) as Array<keyof IPersonnel>) {
    if (key === "signatureImageUrl") continue;
    const newVal = updates[key];
    const oldVal = existing[key];
    if (JSON.stringify(newVal) !== JSON.stringify(oldVal)) {
      changedFields.push(key);
    }
  }

  await auditService.emit({
    category: "PersonnelCredential",
    eventType: "PersonnelRecordUpdated",
    actorRole: caller.role,
    targetRole: null,
    performedByUserId: caller.userId,
    performedByUsername: caller.username,
    targetReference: `${updated.firstName} ${updated.lastName}`,
    details: {
      personnelId: updated.id,
      personnelRole: updated.role,
      changedFields,
    },
  });

  return { success: true, data: updated };
}

export async function togglePersonnelStatusAction(input: unknown): Promise<IPersonnel> {
  const caller = await requirePersonnelAdmin();
  const parsed = personnelStatusSchema.parse(input);
  const repository = new SupabasePersonnelRepository();

  const updated = await repository.toggleActiveStatus(parsed.id, parsed.isActive);

  await auditService.emit({
    category: "PersonnelCredential",
    eventType: "PersonnelStatusToggled",
    actorRole: caller.role,
    targetRole: null,
    performedByUserId: caller.userId,
    performedByUsername: caller.username,
    targetReference: `${updated.firstName} ${updated.lastName}`,
    details: {
      personnelId: updated.id,
      personnelRole: updated.role,
      isActive: updated.isActive,
    },
  });

  return updated;
}
