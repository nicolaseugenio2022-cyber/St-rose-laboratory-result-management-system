"use server";

import "server-only";

import type { IPersonnel } from "@/domain/models/interfaces";
import type { PersonnelDirectoryEntry } from "@/features/personnel/personnel-directory-entry";
import type {
  PersonnelDeletionRefusal,
  RecordDeletionResult,
} from "@/features/personnel/record-deletion";
import { requirePersonnelAdmin, requirePersonnelReader } from "@/lib/personnel-guard";
import {
  createPersonnelSchema,
  updatePersonnelSchema,
  personnelStatusSchema,
  personnelDeleteSchema,
} from "@/lib/validations/personnelValidation";
import { SupabasePersonnelRepository } from "@/repositories/supabase-personnel-repository";
import { auditService } from "@/services/audit-service-instance";

export type PersonnelActionResult =
  | { success: true }
  | { success: false; error: "DUPLICATE_PRC" };

/** Its own closed union: a deletion is refused for reasons no other personnel write can produce. */
export type PersonnelDeleteActionResult = RecordDeletionResult<PersonnelDeletionRefusal>;

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

  // `signatureImageUrl` is deliberately never present in `updates`. Both signature-eligible
  // roles - Pathologist and Medical Technologist - may hold a stored signature, so an
  // ordinary profile edit must preserve whatever is on file rather than rewrite it. The
  // reference is written only by `uploadPersonnelSignatureAction` /
  // `removePersonnelSignatureAction`, which is what keeps this action incapable of clearing
  // or forging one, and keeps the client-supplied payload unable to reach the column at all.

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

/**
 * Permanently delete ONE inactive personnel record from the LIVE directory.
 *
 * Deactivation remains the ordinary, reversible withdrawal. This removes the directory entry for
 * good, and it is offered for a record historical reports name as well as for one nothing ever
 * used. The caller is an Administrator, checked BEFORE the payload is parsed - Developer and User
 * callers are refused by the guard, which audits the refusal exactly as for every other write - and
 * the id is parsed strictly. Every other condition is decided by the database, inside
 * `delete_inactive_personnel()`, in the one transaction that also deletes the row and writes its
 * audit record:
 *
 *   - the record exists and is INACTIVE - an active signatory must be deactivated first.
 *
 * That is now the whole condition. It used to also require that no laboratory report named the
 * record, which made anyone who had ever signed undeletable. What a completed report prints about
 * its signatory - name, credentials, PRC licence, signature reference, order - lives on that
 * report's own `report_signatories` row, and that row references the permanent
 * `personnel_identities` record rather than the live directory entry. The directory entry is
 * therefore not a dependency of any issued report, and removing it changes nothing one renders.
 *
 * NOTHING CLINICAL IS TOUCHED. The function deletes one row, from `personnel`, and nothing else.
 * No report, result, session, completed snapshot, signatory row or audit record is deleted,
 * detached or rewritten, and no foreign key it relies on cascades. The row is locked before
 * anything is checked, so it cannot be reactivated underneath the decision.
 *
 * THE SIGNATURE OBJECT IS RETAINED, BY POLICY, AND STAYS REACHABLE. A stored signature image stays
 * in the private `personnel-signatures` bucket when its record is deleted. The signature actions
 * never delete an object either, so every image ever uploaded stays available to audit, and a
 * storage call could not join the row delete in one transaction in any case. Where a completed
 * report references the object, the signature proxy still serves it to an authorized caller: the
 * frozen address resolves through the report's own `report_signatories` row, which survives, and
 * the legacy path address is still validated against that row. Only an object no report references
 * becomes unreachable once the directory entry is gone. The function writes the retained path into
 * the deletion audit as `objectPath` either way, so an operator can find it.
 *
 * A refusal commits nothing and records nothing, exactly like DUPLICATE_PRC. DELETED means the row
 * and its PersonnelRecordDeleted audit record committed together, so `auditRecorded` is true. A
 * failed request is thrown: the transaction rolled back, or its answer was lost, and the screen then
 * says the deletion could not be confirmed and re-reads the directory rather than claiming either.
 */
export async function deletePersonnelAction(input: unknown): Promise<PersonnelDeleteActionResult> {
  const caller = await requirePersonnelAdmin();
  const parsed = personnelDeleteSchema.parse(input);
  const repository = new SupabasePersonnelRepository();

  const outcome = await repository.deleteInactive(parsed.id, {
    userId: caller.userId,
    username: caller.username,
    role: caller.role,
  });

  if (outcome === "DELETED") {
    return { success: true, auditRecorded: true };
  }
  return { success: false, error: outcome };
}
