"use server";

import "server-only";

import { ReportDefinitionRegistry } from "@/domain/definitions/report-definition-registry";
import type {
  IPhysician,
  IPhysicianExaminationAssignment,
} from "@/domain/models/interfaces";
import type {
  PhysicianAssignmentEntry,
  PhysicianDirectoryEntry,
} from "@/features/physicians/physician-directory-entry";
import { requirePersonnelAdmin, requirePersonnelReader } from "@/lib/personnel-guard";
import {
  createPhysicianSchema,
  updatePhysicianSchema,
  physicianConfigurationSchema,
  physicianStatusSchema,
} from "@/lib/validations/physicianValidation";
import { SupabasePhysicianRepository } from "@/repositories/supabase-physician-repository";
import { auditService } from "@/services/audit-service-instance";

export type PhysicianActionResult =
  | { success: true }
  | { success: false; error: "DUPLICATE_NAME" };

/**
 * Project a server-side physician record onto the client-safe directory entry.
 *
 * Field by field rather than a spread: a spread would silently carry any field later added to
 * IPhysician across the boundary, which is exactly the failure this projection exists to prevent.
 */
function toDirectoryEntry(physician: IPhysician): PhysicianDirectoryEntry {
  return {
    id: physician.id,
    fullName: physician.fullName,
    isActive: physician.isActive,
    createdAt: physician.createdAt,
    updatedAt: physician.updatedAt,
  };
}

export async function listPhysiciansAction(): Promise<PhysicianDirectoryEntry[]> {
  await requirePersonnelReader();
  const repository = new SupabasePhysicianRepository();
  const physicians = await repository.findAll();
  return physicians.map(toDirectoryEntry);
}

export async function createPhysicianAction(input: unknown): Promise<PhysicianActionResult> {
  const caller = await requirePersonnelAdmin();
  const parsed = createPhysicianSchema.parse(input);
  const repository = new SupabasePhysicianRepository();

  let created: IPhysician;
  try {
    created = await repository.create({
      fullName: parsed.fullName,
      isActive: parsed.isActive,
    });
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: string }).code === "23505"
    ) {
      return { success: false, error: "DUPLICATE_NAME" };
    }
    throw error;
  }

  await auditService.emit({
    category: "PersonnelCredential",
    eventType: "PhysicianRecordCreated",
    actorRole: caller.role,
    targetRole: null,
    performedByUserId: caller.userId,
    performedByUsername: caller.username,
    targetReference: created.fullName,
    details: {
      isActive: created.isActive,
    },
  });

  return { success: true };
}

/**
 * This action can also set `isActive`, so it is a status-changing path too - and it gets the
 * deactivation invariant from the same place `togglePhysicianStatusAction` does:
 * `trg_physicians_clear_defaults_on_deactivation`, the row trigger on the active -> inactive
 * transition, never from a check written here. That is the point of enforcing it at the row rather
 * than at each caller.
 *
 * The clearing is NOT separately audited, deliberately. Recording it from here would mean reading
 * the flags before the write, and that read is not part of the transaction the trigger runs in -
 * a concurrent status change or assignment save between the read and the write would make the
 * record wrong in either direction. A wrong audit entry is worse than a missing one, and the
 * event this action already emits, `PhysicianRecordUpdated` with `isActive` among its
 * `changedFields`, is true. What the deactivation implies for defaults is a documented property
 * of the trigger.
 */
export async function updatePhysicianAction(input: unknown): Promise<PhysicianActionResult> {
  const caller = await requirePersonnelAdmin();
  const parsed = updatePhysicianSchema.parse(input);
  const { id, ...rawUpdates } = parsed;
  const repository = new SupabasePhysicianRepository();

  const existing = await repository.findById(id);
  if (!existing) {
    throw new Error("Physician record was not found.");
  }

  const updates: Partial<IPhysician> = {};
  if (rawUpdates.fullName !== undefined) updates.fullName = rawUpdates.fullName;
  if (rawUpdates.isActive !== undefined) updates.isActive = rawUpdates.isActive;

  let updated: IPhysician;
  try {
    updated = await repository.update(id, updates);
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: string }).code === "23505"
    ) {
      return { success: false, error: "DUPLICATE_NAME" };
    }
    throw error;
  }

  const changedFields: string[] = [];
  for (const key of Object.keys(updates) as Array<keyof IPhysician>) {
    const newVal = updates[key];
    const oldVal = existing[key];
    if (JSON.stringify(newVal) !== JSON.stringify(oldVal)) {
      changedFields.push(key);
    }
  }

  await auditService.emit({
    category: "PersonnelCredential",
    eventType: "PhysicianRecordUpdated",
    actorRole: caller.role,
    targetRole: null,
    performedByUserId: caller.userId,
    performedByUsername: caller.username,
    targetReference: updated.fullName,
    details: {
      changedFields,
    },
  });

  return { success: true };
}

/** Returns nothing to the client. The audit payload reads the updated record server-side; the
 *  client refreshes the directory on success. Deactivation is the only removal this directory
 *  has - a physician row is never deleted, so historical reports keep resolving their name.
 *
 *  DEACTIVATION ALSO CLEARS THIS PHYSICIAN'S DEFAULT EXAMINATIONS, and that does not happen here.
 *  It is enforced by `trg_physicians_clear_defaults_on_deactivation`, a row trigger on the
 *  active -> inactive transition itself (20260912120000_physician_deactivation_clears_defaults.sql).
 *  Because it fires on the transition rather than in a caller, it covers every CURRENT physician
 *  status-changing application path - this action, `updatePhysicianAction`, and the physician
 *  UPDATE inside `save_physician_configuration`. Being a trigger it runs inside the transaction of
 *  the UPDATE below, so the status change and the cleared defaults commit together. Ordinary
 *  assignments are preserved, and reactivating restores no default automatically.
 *
 *  WHAT IS NOT CLAIMED. The opposite direction - assigning a default TO a physician who is already
 *  inactive - is refused by `save_physician_configuration` (PHYSICIAN_INACTIVE / ST004), which
 *  covers every current assignment write. It is not refused by the assignment table itself, so
 *  symmetric table-level enforcement remains defense-in-depth backlog rather than an invariant
 *  this schema holds.
 *
 *  The clearing is not separately audited; see the note on `updatePhysicianAction` for why a
 *  pre-read taken outside the trigger's transaction would produce a record that can be wrong. */
export async function togglePhysicianStatusAction(input: unknown): Promise<void> {
  const caller = await requirePersonnelAdmin();
  const parsed = physicianStatusSchema.parse(input);
  const repository = new SupabasePhysicianRepository();

  const updated = await repository.toggleActiveStatus(parsed.id, parsed.isActive);

  await auditService.emit({
    category: "PersonnelCredential",
    eventType: "PhysicianStatusToggled",
    actorRole: caller.role,
    targetRole: null,
    performedByUserId: caller.userId,
    performedByUsername: caller.username,
    targetReference: updated.fullName,
    details: {
      isActive: updated.isActive,
    },
  });
}


/**
 * The assignment write has its own closed result union.
 *
 * `PhysicianActionResult` above is not widened: its shape is a frozen contract and its only
 * failure - a duplicate NAME - is not a failure this action can produce. Every case here is a
 * refusal the SERVER decided, returned as data so the screen can explain it, never thrown.
 */
export type PhysicianAssignmentActionResult =
  | { success: true }
  | {
      success: false;
      error:
        | "DUPLICATE_ASSIGNMENT"
        | "UNKNOWN_TEMPLATE"
        | "DEFAULT_NOT_ASSIGNED"
        | "PHYSICIAN_NOT_FOUND"
        | "PHYSICIAN_INACTIVE";
    };

/**
 * Project a server-side assignment record onto the client-safe entry.
 *
 * Field by field rather than a spread, for the same reason as `toDirectoryEntry`: a spread would
 * carry whatever column is added to the assignment record next across the boundary.
 */
function toAssignmentEntry(assignment: IPhysicianExaminationAssignment): PhysicianAssignmentEntry {
  return {
    physicianId: assignment.physicianId,
    templateCode: assignment.templateCode,
    isDefault: assignment.isDefault,
  };
}

/** Every (physician, examination) assignment, for the administration screen. */
export async function listPhysicianAssignmentsAction(): Promise<PhysicianAssignmentEntry[]> {
  await requirePersonnelReader();
  const repository = new SupabasePhysicianRepository();
  const assignments = await repository.findAllAssignments();
  return assignments.map(toAssignmentEntry);
}

/**
 * The result of ONE complete physician form save.
 *
 * Deliberately the union of the two existing closed contracts rather than a third one. A single
 * save can now be refused for a reason that belongs to the record (a duplicate name) or for a
 * reason that belongs to its assignment set, and both unions already state their own refusals
 * exactly. Widening either of them, or inventing a flat replacement, would have changed a frozen
 * contract that the form already answers member by member.
 */
export type PhysicianConfigurationActionResult =
  | PhysicianActionResult
  | PhysicianAssignmentActionResult;

/**
 * Every refusal `save_physician_configuration` raises, by its PostgreSQL SQLSTATE.
 *
 * Recognised by SQLSTATE, never by message text, for the same reason `createPhysicianAction`
 * reads 23505 rather than matching on "duplicate key": a message is a diagnostic string that a
 * server version or a locale may change, and a SQLSTATE is the contract. The function raises
 * these in the `ST` class, which PostgreSQL does not use, so none of them can collide with a
 * condition the database raises on its own.
 */
const CONFIGURATION_REFUSAL_BY_SQLSTATE = {
  ST001: "DUPLICATE_NAME",
  ST002: "DUPLICATE_ASSIGNMENT",
  ST003: "PHYSICIAN_NOT_FOUND",
  ST004: "PHYSICIAN_INACTIVE",
  ST005: "DEFAULT_NOT_ASSIGNED",
  ST006: "UNKNOWN_TEMPLATE",
} as const;

type ConfigurationRefusal =
  (typeof CONFIGURATION_REFUSAL_BY_SQLSTATE)[keyof typeof CONFIGURATION_REFUSAL_BY_SQLSTATE];

/**
 * Map a thrown database error onto a typed refusal, or onto nothing.
 *
 * `null` for anything that is not one of the function's own refusals - an outage, a permission
 * failure, a bug - so the caller rethrows it. A bare catch that reported every failure as a
 * refusal would tell the operator their input was wrong when the database was simply unreachable.
 * `INVALID_PAYLOAD` (ST007) is deliberately absent: this action's schema has already refused
 * every shape that can raise it, so reaching it means something bypassed the schema, which is a
 * bug rather than an operator's mistake.
 */
function toConfigurationRefusal(error: unknown): ConfigurationRefusal | null {
  if (!error || typeof error !== "object" || !("code" in error)) return null;
  const code = (error as { code: unknown }).code;
  if (typeof code !== "string") return null;
  return (
    CONFIGURATION_REFUSAL_BY_SQLSTATE[code as keyof typeof CONFIGURATION_REFUSAL_BY_SQLSTATE] ??
    null
  );
}

/**
 * Save ONE physician: the record and its complete examination assignment set, atomically.
 *
 * THIS IS THE WHOLE SAVE, AND THAT IS THE POINT. It replaces a composition of two actions - write
 * the record, then find it again by name, then replace its assignments - whose steps committed
 * independently. A failure part-way through that composition could leave a physician created but
 * unassigned, an assignment set half replaced, or another physician's examination stripped of its
 * default while the operator was shown a failure. One transaction removes every one of those
 * states: it commits in full or changes nothing.
 *
 * Everything the UI could get wrong is decided again here, because the UI is not a security
 * boundary and a server action is reachable without it:
 *
 *   - the caller is an Administrator, checked BEFORE the payload is even parsed;
 *   - `.strict()` parsing rejects an unexpected key, and the schema's own refinements reject a
 *     duplicate code and a default that is not also assigned - the client's checkbox state is
 *     never trusted for either;
 *   - every template code is checked against the report-definition registry, so an examination
 *     that does not exist cannot be written even though the column is a plain TEXT foreign key;
 *   - a physician who is not active is never made the default for anything. A deactivated
 *     physician is not offered for new work, so pre-selecting them for an examination would put a
 *     name the roster refuses to suggest into the one slot that fills itself in.
 *
 * And decided a third time inside the transaction: `save_physician_configuration` re-derives the
 * payload shape, the two cross-field rules and the template existence itself, so the guarantee
 * does not depend on this action having run first.
 */
export async function savePhysicianConfigurationAction(
  input: unknown
): Promise<PhysicianConfigurationActionResult> {
  const caller = await requirePersonnelAdmin();
  const parsed = physicianConfigurationSchema.parse(input);
  const repository = new SupabasePhysicianRepository();

  for (const templateCode of parsed.templateCodes) {
    if (!ReportDefinitionRegistry.hasDefinition(templateCode)) {
      return { success: false, error: "UNKNOWN_TEMPLATE" };
    }
  }

  // Restated rather than relied upon. The schema already refuses both, and so does the database,
  // but this action is the last thing between a caller and the transaction and the invariants are
  // cheap to hold twice.
  const assignedCodes = new Set(parsed.templateCodes);
  for (const templateCode of parsed.defaultTemplateCodes) {
    if (!assignedCodes.has(templateCode)) {
      return { success: false, error: "DEFAULT_NOT_ASSIGNED" };
    }
  }
  if (!parsed.isActive && parsed.defaultTemplateCodes.length > 0) {
    return { success: false, error: "PHYSICIAN_INACTIVE" };
  }

  // Read BEFORE the write, and only to compute what the audit record already reports. An id that
  // no longer names a row is refused here rather than being silently re-created by the
  // transaction, which would treat a missing id as a create.
  let existing: IPhysician | null = null;
  let previousAssignments: IPhysicianExaminationAssignment[] = [];
  if (parsed.id !== null) {
    existing = await repository.findById(parsed.id);
    if (!existing) {
      return { success: false, error: "PHYSICIAN_NOT_FOUND" };
    }
    previousAssignments = await repository.findAssignmentsByPhysician(parsed.id);
  }

  try {
    await repository.savePhysicianConfiguration({
      id: parsed.id,
      fullName: parsed.fullName,
      isActive: parsed.isActive,
      templateCodes: parsed.templateCodes,
      defaultTemplateCodes: parsed.defaultTemplateCodes,
    });
  } catch (error: unknown) {
    // NOTHING IS AUDITED HERE. The transaction rolled back, so the directory is exactly as it was
    // and there is no change to record. The previous implementation emitted a successful
    // assignment-update event on this path precisely because a failed write COULD have left
    // damage behind; it cannot any more, and recording a rolled-back attempt as a completed
    // assignment update would put an event in the audit trail that never happened.
    const refusal = toConfigurationRefusal(error);
    if (refusal !== null) return { success: false, error: refusal };
    throw error;
  }

  // ── Audited only now, and only with keys the audit presentation already curates ────────────
  // Two existing event types, both emitted after the transaction committed. Neither is new, and
  // `details` carries only `isActive` and `changedFields`, the two keys AuditLogView already
  // labels - a new key would render as an unlabelled row and is refused by the presentation gate.
  if (existing === null) {
    await auditService.emit({
      category: "PersonnelCredential",
      eventType: "PhysicianRecordCreated",
      actorRole: caller.role,
      targetRole: null,
      performedByUserId: caller.userId,
      performedByUsername: caller.username,
      targetReference: parsed.fullName,
      details: {
        isActive: parsed.isActive,
      },
    });
  } else {
    const changedRecordFields: string[] = [];
    if (existing.fullName !== parsed.fullName) changedRecordFields.push("fullName");
    if (existing.isActive !== parsed.isActive) changedRecordFields.push("isActive");
    await auditService.emit({
      category: "PersonnelCredential",
      eventType: "PhysicianRecordUpdated",
      actorRole: caller.role,
      targetRole: null,
      performedByUserId: caller.userId,
      performedByUsername: caller.username,
      targetReference: parsed.fullName,
      details: {
        changedFields: changedRecordFields,
      },
    });
  }

  const previousAssigned = previousAssignments
    .map((assignment) => assignment.templateCode)
    .sort();
  const previousDefaults = previousAssignments
    .filter((assignment) => assignment.isDefault)
    .map((assignment) => assignment.templateCode)
    .sort();
  const changedFields: string[] = [];
  if (JSON.stringify(previousAssigned) !== JSON.stringify([...parsed.templateCodes].sort())) {
    changedFields.push("assignedExaminations");
  }
  if (
    JSON.stringify(previousDefaults) !==
    JSON.stringify([...parsed.defaultTemplateCodes].sort())
  ) {
    changedFields.push("defaultExaminations");
  }

  await auditService.emit({
    category: "PersonnelCredential",
    eventType: "PhysicianExaminationAssignmentsUpdated",
    actorRole: caller.role,
    targetRole: null,
    performedByUserId: caller.userId,
    performedByUsername: caller.username,
    targetReference: parsed.fullName,
    details: {
      changedFields,
    },
  });

  return { success: true };
}
