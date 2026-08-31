"use server";

import "server-only";

import type { IPersonnel } from "@/domain/models/interfaces";
import type { PersonnelDirectoryEntry } from "@/features/personnel/personnel-directory-entry";
import { requirePersonnelAdmin, requirePersonnelReader } from "@/lib/personnel-guard";
import {
  createPersonnelSchema,
  updatePersonnelSchema,
  personnelStatusSchema,
} from "@/lib/validations/personnelValidation";
import { SupabasePersonnelRepository } from "@/repositories/supabase-personnel-repository";
import { auditService } from "@/services/audit-service-instance";

export type PersonnelActionResult =
  | { success: true }
  | { success: false; error: "DUPLICATE_PRC" };

/**
 * Project a server-side personnel record onto the client-safe directory entry.
 *
 * The single place `signatureImageUrl` is reduced to a boolean. Field-by-field rather than a
 * spread-and-delete: a spread would silently carry any field later added to IPersonnel across
 * the boundary, which is exactly the failure this projection exists to prevent.
 */
function toDirectoryEntry(person: IPersonnel): PersonnelDirectoryEntry {
  return {
    id: person.id,
    firstName: person.firstName,
    lastName: person.lastName,
    middleInitial: person.middleInitial ?? null,
    credentials: person.credentials,
    prcLicenseNumber: person.prcLicenseNumber,
    role: person.role,
    isActive: person.isActive,
    createdAt: person.createdAt,
    updatedAt: person.updatedAt,
    hasSignature: Boolean(person.signatureImageUrl),
  };
}

export async function listPersonnelAction(): Promise<PersonnelDirectoryEntry[]> {
  await requirePersonnelReader();
  const repository = new SupabasePersonnelRepository();
  const personnel = await repository.findAll();
  return personnel.map(toDirectoryEntry);
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

  return { success: true };
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

  return { success: true };
}

/** Returns nothing to the client. The audit payload below is unchanged and still reads the
 *  updated record server-side; the client refreshes the directory on success. */
export async function togglePersonnelStatusAction(input: unknown): Promise<void> {
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
}
