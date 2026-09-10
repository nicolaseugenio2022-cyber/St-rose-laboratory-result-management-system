import { 
  IPatientReportSession, 
  IPersonnel, 
  IPhysician,
  IPhysicianExaminationAssignment,
  IUserProfile,
  IReportTemplate, 
  ITemplateParameter, 
  ITemplateSignatoryRequirement 
} from "../../domain/models/interfaces";
import { UserRole, UserStatus } from "../../domain/types";
import { HydratedTemplateSpec } from "../../services/interfaces";

export type AuthRole = "Admin" | "User" | "Developer";
export type AuthStatus = "Active" | "Inactive";

export interface AuthCredentialRecord {
  id: string;
  username: string;
  role: AuthRole;
  status: AuthStatus;
  passwordHash: string;
  securityQuestion: string;
  securityAnswerHash: string | null;
  mustChangePassword: boolean;
  mustSetRecovery: boolean;
  tokenVersion: number;
  passwordUpdatedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ICredentialRepository {
  findById(id: string): Promise<AuthCredentialRecord | null>;
  findByUsername(username: string): Promise<AuthCredentialRecord | null>;
  findAll(): Promise<AuthCredentialRecord[]>;
  create(record: AuthCredentialRecord): Promise<AuthCredentialRecord>;
  update(id: string, updates: Partial<Omit<AuthCredentialRecord, "id" | "createdAt">>): Promise<AuthCredentialRecord>;
  updateIfTokenVersion(
    id: string,
    expectedTokenVersion: number,
    updates: Partial<Omit<AuthCredentialRecord, "id" | "createdAt">>
  ): Promise<AuthCredentialRecord | null>;
  delete(id: string): Promise<void>;
}

export interface ICredentialDirectoryRepository {
  findVisibleTo(visibleRoles: AuthRole[]): Promise<AuthCredentialRecord[]>;
  countVisibleTo(visibleRoles: AuthRole[]): Promise<number>;
  summarizeVisibleTo?(visibleRoles: AuthRole[]): Promise<CredentialDirectorySummary>;
  findByIdVisibleTo(
    id: string,
    visibleRoles: AuthRole[]
  ): Promise<AuthCredentialRecord | null>;
  listDeveloperIdentities(): Promise<{ id: string; username: string }[]>;
}

export interface CredentialDirectorySummary {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  adminUsers: number;
}

export type AuthAttemptKind = "Login" | "RecoveryLookup" | "RecoveryAnswer" | "PasswordReset" | "PasswordChange";

export interface AuthAttemptRecord {
  id: string;
  username: string;
  attemptKind: AuthAttemptKind;
  succeeded: boolean;
  clientIp: string | null;
  attemptedAt: string;
}

export interface AuthAttemptQuery {
  attemptKind: AuthAttemptKind;
  since: string;
  username?: string;
  clientIp?: string;
}

export interface ILoginAttemptRepository {
  record(attempt: AuthAttemptRecord): Promise<AuthAttemptRecord>;
  findAttempts(query: AuthAttemptQuery): Promise<AuthAttemptRecord[]>;
}

export type LockoutRecord = {
  id: string;
  username: string;
  lockedAt: string;
  expiresAt: string;
  releasedAt: string | null;
  failureCount: number;
};

export type OpenLockoutInput = {
  id: string;
  username: string;
  lockedAt: string;
  expiresAt: string;
  failureCount: number;
};

export interface ILockoutRepository {
  // Inserts a new open lockout. Returns the created record, or null when an open lockout
  // for this username already exists. Never throws on that conflict.
  openLockout(input: OpenLockoutInput): Promise<LockoutRecord | null>;
  // Atomically closes the open, already-expired lockout for this username. Returns the
  // released record, or null when there was nothing to release.
  releaseExpiredLockout(username: string, now: string): Promise<LockoutRecord | null>;
}

export type AuditLogEntry = {
  id: string;
  category: string;
  eventType: string;
  performedByUserId: string | null;
  performedByUsername: string | null;
  targetReference: string | null;
  actorRole: AuthRole | null;
  targetRole: AuthRole | null;
  details: Record<string, unknown> | null;
  occurredAt: string;
};

export interface IAuditLogRepository {
  append(entry: AuditLogEntry): Promise<void>;
}

export type AuditLogQueryExclusion = {
  performedByUserIds: string[];
  usernames: string[];
};

export type AuditLogQueryCriteria = {
  categories?: string[];
  eventType?: string;
  occurredAtFrom?: string;
  occurredAtTo?: string;
  search?: string;
  exclusion?: AuditLogQueryExclusion;
  limit: number;
  offset: number;
};

export interface IAuditLogQueryRepository {
  query(criteria: AuditLogQueryCriteria): Promise<AuditLogEntry[]>;
  count(criteria: AuditLogQueryCriteria): Promise<number>;
}

export interface IPatientReportSessionRepository {
  findById(id: string): Promise<IPatientReportSession | null>;
  findByAccessionNumber(accessionNumber: string): Promise<IPatientReportSession | null>;
  findActiveCompletedSessions(): Promise<IPatientReportSession[]>;
  saveDraft(session: IPatientReportSession): Promise<IPatientReportSession>;
  completeSession(session: IPatientReportSession): Promise<IPatientReportSession>;
  replaceSession(session: IPatientReportSession): Promise<IPatientReportSession>;
  purgeExpiredSessions(): Promise<number>; // Returns count of purged sessions
}

/**
 * The Administrator a permanent deletion is recorded against. Always taken from the server-side
 * guard, never from the client payload.
 */
export interface DirectoryDeletionActor {
  userId: string;
  username: string;
  role: AuthRole;
}

/**
 * What `delete_inactive_personnel()` answers: a closed set of words, DELETED or one refusal.
 *
 * REFERENCED_BY_REPORTS is deliberately NOT among them. A completed report keeps its signatory's
 * name, credentials, PRC licence and signature on its own frozen `report_signatories` row, and that
 * row now references the permanent `personnel_identities` record rather than the live directory
 * entry, so removing the directory entry changes nothing a completed report renders. The function
 * has no reason left to refuse a record that once signed.
 */
export type PersonnelDeletionOutcome = "DELETED" | "NOT_FOUND" | "STILL_ACTIVE";

/**
 * What `delete_inactive_physician()` answers.
 *
 * Stated in full rather than extended from the personnel set: a physician is named by PRINTED TEXT
 * inside reports, sessions and completed snapshots, which no separate row preserves, so a physician
 * any retained report names is still refused as REFERENCED_BY_REPORTS. The two closed sets are
 * independent contracts and must not move together.
 */
export type PhysicianDeletionOutcome =
  | "DELETED"
  | "NOT_FOUND"
  | "STILL_ACTIVE"
  | "REFERENCED_BY_REPORTS"
  | "HAS_ASSIGNMENTS";

export interface IPersonnelRepository {
  findById(id: string): Promise<IPersonnel | null>;
  findAllActive(): Promise<IPersonnel[]>;
  findAll(): Promise<IPersonnel[]>;
  create(personnel: Omit<IPersonnel, "id" | "createdAt" | "updatedAt">): Promise<IPersonnel>;
  update(id: string, updates: Partial<IPersonnel>): Promise<IPersonnel>;
  toggleActiveStatus(id: string, isActive: boolean): Promise<IPersonnel>;
}

/**
 * Permanent deletion of a personnel record, declared apart from IPersonnelRepository on purpose:
 * that contract's shape is frozen at Milestone 6B, and this capability is not part of it.
 */
export interface IPersonnelDeletionRepository {
  /**
   * Permanently delete ONE inactive record, and record the deletion, in ONE database transaction -
   * `delete_inactive_personnel()`.
   *
   * The function locks the row, re-decides every condition, deletes, and writes the audit record
   * before it commits; either both happen or neither does. This method issues no table delete of
   * its own. Returns the function's answer; a failed request is thrown, never read as a refusal.
   *
   * A record historical reports name is deleted like any other: the reports keep their own frozen
   * signatory rows and nothing clinical is cascaded, deleted or rewritten.
   */
  deleteInactive(id: string, actor: DirectoryDeletionActor): Promise<PersonnelDeletionOutcome>;
}

/**
 * The managed physician directory behind the report "Requested By" field.
 *
 * Mirrors IPersonnelRepository deliberately. A physician who no longer refers is deactivated;
 * permanent deletion exists only for an inactive physician with no examination assignment that no
 * laboratory report references, and it is decided by the database, so historical reports keep the
 * name they were issued with.
 */
export interface IPhysicianRepository {
  findById(id: string): Promise<IPhysician | null>;
  findAllActive(): Promise<IPhysician[]>;
  findAll(): Promise<IPhysician[]>;
  create(physician: Omit<IPhysician, "id" | "createdAt" | "updatedAt">): Promise<IPhysician>;
  update(id: string, updates: Partial<IPhysician>): Promise<IPhysician>;
  toggleActiveStatus(id: string, isActive: boolean): Promise<IPhysician>;
  findAllAssignments(): Promise<IPhysicianExaminationAssignment[]>;
  findAssignmentsByTemplate(templateCode: string): Promise<IPhysicianExaminationAssignment[]>;
  findAssignmentsByPhysician(physicianId: string): Promise<IPhysicianExaminationAssignment[]>;
  /**
   * Save one physician's record AND its complete examination-assignment set as ONE transaction.
   *
   * All of it or none of it. The record is created or updated, the physician's previous pairs are
   * replaced wholesale, the default is transferred onto the templates named, and the physician's
   * identifier is returned - and a failure anywhere leaves the directory exactly as it was. This
   * replaces a sequence of independent statements that could commit partially and strand a
   * physician half-configured, or clear ANOTHER physician's default while reporting failure.
   *
   * A replacement, not a merge: a code absent from `templateCodes` is no longer an assignment of
   * that physician afterwards. This save deletes no physician row; permanent removal is
   * `deleteInactive` alone.
   *
   * Returns the physician's id, produced server-side, so a newly created physician never has to
   * be found again by name.
   */
  savePhysicianConfiguration(configuration: PhysicianConfigurationInput): Promise<string>;
  /**
   * Permanently delete ONE inactive physician that holds no examination assignment and that no
   * laboratory report references, and record the deletion, in ONE database transaction -
   * `delete_inactive_physician()`.
   *
   * Assignments are never cascaded: `physician_examination_assignments.physician_id` is ON DELETE
   * RESTRICT and the function refuses first, so an orphaned assignment or default is
   * unrepresentable. This method issues no table delete of its own. Returns the function's answer;
   * a failed request is thrown, never read as a refusal.
   */
  deleteInactive(id: string, actor: DirectoryDeletionActor): Promise<PhysicianDeletionOutcome>;
}

/** The writable half of an assignment: the pair, plus whether it is the template's default. */
export interface PhysicianExaminationAssignmentInput {
  templateCode: string;
  isDefault: boolean;
}

/**
 * One complete physician form save.
 *
 * `id` is null for a physician being created: the identifier is produced by the transaction and
 * handed back, never guessed by the caller. `defaultTemplateCodes` is a subset of `templateCodes`
 * - a default that is not assigned is refused by the schema, by the server action and by the
 * database function, in that order.
 */
export interface PhysicianConfigurationInput {
  id: string | null;
  fullName: string;
  isActive: boolean;
  templateCodes: readonly string[];
  defaultTemplateCodes: readonly string[];
}

export interface IUserProfileRepository {
  findById(id: string): Promise<IUserProfile | null>;
  findByUsername(username: string): Promise<IUserProfile | null>;
  findAll(): Promise<IUserProfile[]>;
  createProfile(profile: Omit<IUserProfile, "createdAt" | "updatedAt">): Promise<IUserProfile>;
  updateRole(id: string, role: UserRole): Promise<IUserProfile>;
  updateStatus(id: string, status: UserStatus): Promise<IUserProfile>;
}

/**
 * Marks a bulk hydration result that came from SEED data because the database read failed.
 *
 * The seed fallback is deliberate resilience and is unchanged: the caller that asked during an
 * outage still gets a usable registry. What the marker adds is the ability to tell that result
 * apart from a database-hydrated one, so it is never committed as the complete registry - a cached
 * fallback would keep serving seed parameters and reference ranges long after the database
 * recovered, with nothing to indicate the data was not authoritative.
 *
 * A symbol on the array, rather than a changed return type: every existing caller keeps reading the
 * array exactly as before, and an implementation that never degrades needs no change at all.
 */
export const DEGRADED_REGISTRY_RESULT = Symbol.for("stRose.degradedRegistryResult");

/** True only for a bulk result the repository explicitly marked as a seed fallback. */
export function isDegradedRegistryResult(specs: HydratedTemplateSpec[]): boolean {
  return (specs as unknown as Record<symbol, unknown>)[DEGRADED_REGISTRY_RESULT] === true;
}

/** Marks a bulk result as seed-derived, returning the same array for the caller to hand back. */
export function markDegradedRegistryResult(specs: HydratedTemplateSpec[]): HydratedTemplateSpec[] {
  return Object.defineProperty(specs, DEGRADED_REGISTRY_RESULT, {
    value: true,
    enumerable: false,
  });
}

/**
 * The interface body below is SHA-pinned to the Milestone 6B baseline by
 * `verify-checkpoint-m6c.ts`, so the contract note for `getAllHydratedTemplates` lives here rather
 * than inside it: a result carrying `DEGRADED_REGISTRY_RESULT` is seed-derived and must not be
 * cached as the complete registry, while an unmarked result is database-hydrated and is cached
 * normally. No method or signature changes - only the marker travelling on the returned array.
 */
export interface IReportRegistryRepository {
  getTemplateByCode(templateCode: string): Promise<IReportTemplate | null>;
  getParametersByTemplateCode(templateCode: string): Promise<ITemplateParameter[]>;
  getSignatoryRequirementByTemplateCode(templateCode: string): Promise<ITemplateSignatoryRequirement | null>;
  getAllActiveTemplates(): Promise<IReportTemplate[]>;
  getAllHydratedTemplates?(): Promise<HydratedTemplateSpec[]>;
}
