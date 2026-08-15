import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

import {
  BootstrapRefusedError,
  BOOTSTRAP_EVENT_TYPE,
  runBootstrap,
  runBootstrapAuditRepair,
} from "./bootstrap-core";

import { emitLogoutAuditForSession } from "@/features/auth/logout-audit";
import { firstLoginRedirectPath } from "@/lib/first-login-gate";
import { hashPassword, verifyPassword } from "@/lib/password";
import type { SessionPayload } from "@/lib/session-codec";
import type {
  AuditLogEntry,
  AuditLogQueryCriteria,
  AuthAttemptQuery,
  AuthAttemptRecord,
  AuthCredentialRecord,
  AuthRole,
  AuthStatus,
  ICredentialDirectoryRepository,
  ICredentialRepository,
  ILoginAttemptRepository,
} from "@/repositories/interfaces";
import {
  DeveloperAlreadyExistsError,
  InvalidCredentialsError,
  LastActiveAdminError,
  LastActiveDeveloperError,
  PasswordChangeConflictError,
  SelfDeactivationError,
  SelfDeletionError,
  UserNotFoundError,
  UserService,
} from "@/services/userService";
import type { AuditEvent, AuditService } from "@/services/audit-service";
import type {
  CreateDeveloperAccountInput,
  CreateUserInput,
  ResetDeveloperPasswordInput,
  UpdateDeveloperSecurityQuestionInput,
  UpdateDeveloperUsernameInput,
  UpdateUserInput,
} from "@/types/user";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Developer boundary verification failed: ${message}`);
}

class FakeCredentialRepository
  implements ICredentialRepository, ICredentialDirectoryRepository
{
  updateCalls = 0;
  rejectNextTokenVersionUpdate = false;
  private readonly records: Map<string, AuthCredentialRecord>;

  constructor(records: AuthCredentialRecord[]) {
    this.records = new Map(records.map((record) => [record.id, { ...record }]));
  }

  async findById(id: string): Promise<AuthCredentialRecord | null> {
    const record = this.records.get(id);
    return record ? { ...record } : null;
  }

  async findByUsername(username: string): Promise<AuthCredentialRecord | null> {
    const record = [...this.records.values()].find(
      (candidate) => candidate.username === username
    );
    return record ? { ...record } : null;
  }

  async findAll(): Promise<AuthCredentialRecord[]> {
    return [...this.records.values()].map((record) => ({ ...record }));
  }

  async findVisibleTo(visibleRoles: AuthRole[]): Promise<AuthCredentialRecord[]> {
    return [...this.records.values()]
      .filter((record) => visibleRoles.includes(record.role))
      .map((record) => ({ ...record }));
  }

  async countVisibleTo(visibleRoles: AuthRole[]): Promise<number> {
    return [...this.records.values()].filter((record) => visibleRoles.includes(record.role))
      .length;
  }

  async findByIdVisibleTo(
    id: string,
    visibleRoles: AuthRole[]
  ): Promise<AuthCredentialRecord | null> {
    const record = this.records.get(id);
    return record && visibleRoles.includes(record.role) ? { ...record } : null;
  }

  async listDeveloperIdentities(): Promise<{ id: string; username: string }[]> {
    return [...this.records.values()]
      .filter((record) => record.role === "Developer")
      .map(({ id, username }) => ({ id, username }));
  }

  async create(record: AuthCredentialRecord): Promise<AuthCredentialRecord> {
    if (this.records.has(record.id)) throw new Error(`Credential ${record.id} already exists.`);
    if (await this.findByUsername(record.username)) {
      throw new Error(`Credential username ${record.username} already exists.`);
    }
    const created = { ...record };
    this.records.set(created.id, created);
    return { ...created };
  }

  async update(
    id: string,
    updates: Partial<Omit<AuthCredentialRecord, "id" | "createdAt">>
  ): Promise<AuthCredentialRecord> {
    this.updateCalls += 1;
    const current = this.records.get(id);
    if (!current) throw new Error(`Credential ${id} was not found.`);
    const updated = { ...current, ...updates };
    this.records.set(id, updated);
    return { ...updated };
  }

  async updateIfTokenVersion(
    id: string,
    expectedTokenVersion: number,
    updates: Partial<Omit<AuthCredentialRecord, "id" | "createdAt">>
  ): Promise<AuthCredentialRecord | null> {
    const current = this.records.get(id);
    if (this.rejectNextTokenVersionUpdate) {
      this.rejectNextTokenVersionUpdate = false;
      return null;
    }
    if (!current || current.tokenVersion !== expectedTokenVersion) return null;
    const updated = { ...current, ...updates };
    this.records.set(id, updated);
    return { ...updated };
  }

  async delete(id: string): Promise<void> {
    if (!this.records.delete(id)) throw new Error(`Credential ${id} was not found.`);
  }
}

class FakeLoginAttemptRepository implements ILoginAttemptRepository {
  private readonly attempts: AuthAttemptRecord[] = [];
  recordFailures = 0;

  async record(attempt: AuthAttemptRecord): Promise<AuthAttemptRecord> {
    if (this.recordFailures > 0) {
      this.recordFailures -= 1;
      throw new Error("simulated rate-limit record failure");
    }
    const recorded = { ...attempt };
    this.attempts.push(recorded);
    return { ...recorded };
  }

  async findAttempts(query: AuthAttemptQuery): Promise<AuthAttemptRecord[]> {
    return this.attempts
      .filter(
        (attempt) =>
          attempt.attemptKind === query.attemptKind &&
          attempt.attemptedAt >= query.since &&
          (query.username === undefined || attempt.username === query.username) &&
          (query.clientIp === undefined || attempt.clientIp === query.clientIp)
      )
      .sort((left, right) => right.attemptedAt.localeCompare(left.attemptedAt))
      .map((attempt) => ({ ...attempt }));
  }
}

class FakeAuditLog {
  readonly entries: AuditLogEntry[] = [];
  failures = 0;
  public emitCalls = 0;

  async emit(event: AuditEvent): Promise<void> {
    this.emitCalls += 1;
    if (this.failures > 0) {
      this.failures -= 1;
      throw new Error("simulated audit persistence failure");
    }
    this.entries.push({
      id: randomUUID(),
      category: event.category,
      eventType: event.eventType,
      performedByUserId: event.performedByUserId ?? null,
      performedByUsername: event.performedByUsername ?? null,
      targetReference: event.targetReference ?? null,
      actorRole: event.actorRole,
      targetRole: event.targetRole,
      details: event.details ?? null,
      occurredAt: new Date().toISOString(),
    });
  }

  private matching(criteria: AuditLogQueryCriteria): AuditLogEntry[] {
    return this.entries.filter(
      (entry) => !criteria.eventType || entry.eventType === criteria.eventType
    );
  }

  async query(criteria: AuditLogQueryCriteria): Promise<AuditLogEntry[]> {
    return this.matching(criteria).slice(criteria.offset, criteria.offset + criteria.limit);
  }

  async count(criteria: AuditLogQueryCriteria): Promise<number> {
    return this.matching(criteria).length;
  }
}

const ADMIN_A = "admin-a";
const USER_A = "user-a";
const DEVELOPER_A = "developer-a";
const DEVELOPER_B = "developer-b";
const DISTINCT_ACTOR = "distinct-actor";
const TIMESTAMP = "2026-08-13T00:00:00.000Z";
const SECURITY_QUESTION = "What was the name of your first school?";

function credential(
  id: string,
  role: AuthRole = "User",
  status: AuthStatus = "Active"
): AuthCredentialRecord {
  const passwordHash = randomUUID();

  return {
    id,
    username: id,
    role,
    status,
    passwordHash,
    securityQuestion: SECURITY_QUESTION,
    securityAnswerHash: null,
    mustChangePassword: false,
    mustSetRecovery: false,
    tokenVersion: 1,
    passwordUpdatedAt: TIMESTAMP,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  };
}

function createSubject(records: AuthCredentialRecord[]): {
  credentials: FakeCredentialRepository;
  service: UserService;
} {
  const credentials = new FakeCredentialRepository(records);
  const attempts = new FakeLoginAttemptRepository();
  return { credentials, service: new UserService(credentials, attempts) };
}

function createAuditedSubject(
  records: AuthCredentialRecord[],
  audit: FakeAuditLog,
  attempts = new FakeLoginAttemptRepository()
): { credentials: FakeCredentialRepository; service: UserService } {
  const credentials = new FakeCredentialRepository(records);
  return {
    credentials,
    service: new UserService(credentials, attempts, audit as unknown as AuditService),
  };
}

function bootstrapDeps(subject: ReturnType<typeof createSubject>, audit: FakeAuditLog) {
  return {
    userService: subject.service,
    credentialDirectory: subject.credentials,
    auditLogs: audit,
    auditService: audit,
    sleep: async () => {},
  };
}

async function captureError(operation: () => Promise<unknown>): Promise<unknown> {
  const noError = Symbol("no error");
  let thrown: unknown = noError;
  try {
    await operation();
  } catch (error) {
    thrown = error;
  }
  assert(thrown !== noError, "the operation must throw");
  return thrown;
}

function errorSnapshot(error: unknown): unknown {
  if (!(error instanceof Error)) return error;
  const ownProperties = Object.fromEntries(
    Object.getOwnPropertyNames(error)
      .filter((key) => key !== "stack")
      .map((key) => [key, (error as unknown as Record<string, unknown>)[key]])
  );
  return { name: error.name, message: error.message, ...ownProperties };
}

function assertNoSensitiveData(value: unknown, secrets: string[], message: string): void {
  const serialized = JSON.stringify(errorSnapshot(value)).toLowerCase();
  assert(!serialized.includes("passwordhash"), `${message} must not expose passwordHash`);
  assert(
    !serialized.includes("securityanswerhash"),
    `${message} must not expose securityAnswerHash`
  );
  for (const secret of secrets) {
    assert(
      !serialized.includes(secret.toLowerCase()),
      `${message} must not expose sensitive input or stored material`
    );
  }
}

function sessionFor(userId: string): SessionPayload {
  return {
    userId,
    tokenVersion: 99,
    mustChangePassword: false,
    mustSetRecovery: false,
    rememberMe: false,
    expiresAt: "2099-01-01T00:00:00.000Z",
  };
}

async function verifyAdminListExcludesDevelopers(): Promise<void> {
  const { service } = createSubject([
    credential(ADMIN_A, "Admin"),
    credential(USER_A),
    credential(DEVELOPER_A, "Developer"),
  ]);
  const users = await service.getUsersVisibleTo("Admin");
  assert(users.length === 2, "case 1 must return only ordinary accounts");
  assert(!users.some(({ role }) => role === "Developer"), "case 1 must exclude Developers");
}

async function verifyDeveloperListIncludesDevelopers(): Promise<void> {
  const { service } = createSubject([
    credential(ADMIN_A, "Admin"),
    credential(DEVELOPER_A, "Developer"),
  ]);
  const users = await service.getUsersVisibleTo("Developer");
  assert(
    users.some(({ id }) => id === DEVELOPER_A),
    "case 2 must include Developer records"
  );
}

async function verifyAdminCountExcludesDevelopers(): Promise<void> {
  const { service } = createSubject([
    credential(ADMIN_A, "Admin"),
    credential(USER_A),
    credential(DEVELOPER_A, "Developer"),
  ]);
  assert((await service.countUsersVisibleTo("Admin")) === 2, "case 3 must exclude Developer records");
}

async function verifyAdminReadOfDeveloperIsNotFound(): Promise<void> {
  const { service } = createSubject([credential(DEVELOPER_A, "Developer")]);
  assert(
    (await service.getUserByIdVisibleTo(DEVELOPER_A, "Admin")) === null,
    "case 4 must return not-found for a Developer id"
  );
}

async function verifyDeveloperAndMissingNotFoundAreIndistinguishable(): Promise<void> {
  const withDeveloper = createSubject([credential(DEVELOPER_A, "Developer")]);
  const withoutDeveloper = createSubject([]);
  const hiddenError = await captureError(() =>
    withDeveloper.service.updateUser(
      DEVELOPER_A,
      { username: "hidden-developer" },
      ADMIN_A
    )
  );
  const missingError = await captureError(() =>
    withoutDeveloper.service.updateUser(
      DEVELOPER_A,
      { username: "hidden-developer" },
      ADMIN_A
    )
  );
  assert(hiddenError instanceof UserNotFoundError, "case 5 hidden target must be not-found");
  assert(missingError instanceof UserNotFoundError, "case 5 missing target must be not-found");
  assert(hiddenError.constructor === missingError.constructor, "case 5 error types must match");
  assert(hiddenError.message === missingError.message, "case 5 error messages must match");
}

async function verifyAdminUpdateCannotMutateDeveloper(): Promise<void> {
  const original = credential(DEVELOPER_A, "Developer");
  const { credentials, service } = createSubject([original]);
  const before = JSON.stringify(await credentials.findById(DEVELOPER_A));
  await captureError(() =>
    service.updateUser(
      DEVELOPER_A,
      { username: "changed-developer", status: "Inactive" },
      ADMIN_A
    )
  );
  assert(
    JSON.stringify(await credentials.findById(DEVELOPER_A)) === before,
    "case 6 must leave the Developer byte-unchanged"
  );
}

async function verifyAdminDeleteCannotRemoveDeveloper(): Promise<void> {
  const { credentials, service } = createSubject([credential(DEVELOPER_A, "Developer")]);
  await captureError(() => service.deleteUser(DEVELOPER_A, ADMIN_A));
  assert(await credentials.findById(DEVELOPER_A), "case 7 must retain the Developer record");
}

async function verifyAdminToggleCannotMutateDeveloper(): Promise<void> {
  const { credentials, service } = createSubject([credential(DEVELOPER_A, "Developer")]);
  await captureError(() => service.toggleUserStatus(DEVELOPER_A, ADMIN_A));
  assert(
    (await credentials.findById(DEVELOPER_A))?.status === "Active",
    "case 8 must leave the Developer Active"
  );
}

async function verifyOrdinaryCreateRejectsDeveloperRole(): Promise<void> {
  const initialPassword = randomUUID();
  const { service } = createSubject([]);
  await captureError(() =>
    service.createUser({
      username: "new-developer",
      password: initialPassword,
      role: "Developer",
      securityQuestion: SECURITY_QUESTION,
    })
  );
}

async function verifyOrdinaryPromotionToDeveloperFails(): Promise<void> {
  const { credentials, service } = createSubject([credential(USER_A)]);
  await captureError(() => service.updateUser(USER_A, { role: "Developer" }, ADMIN_A));
  assert((await credentials.findById(USER_A))?.role === "User", "case 10 must retain User role");
}

async function verifyOrdinaryDemotionOfDeveloperFailsForEveryRole(): Promise<void> {
  for (const callerRole of ["Admin", "User", "Developer"] as const) {
    const { credentials, service } = createSubject([credential(DEVELOPER_A, "Developer")]);
    const error = await captureError(() =>
      service.updateUser(DEVELOPER_A, { role: "User" }, DISTINCT_ACTOR)
    );
    assert(error instanceof UserNotFoundError, `case 11 must reject demotion for ${callerRole}`);
    assert(
      (await credentials.findById(DEVELOPER_A))?.role === "Developer",
      `case 11 must reject demotion for ${callerRole}`
    );
  }
}

async function verifyDeveloperCreatesDeveloperWithRequiredFlags(): Promise<void> {
  const initialPassword = randomUUID();
  const { credentials, service } = createSubject([credential(DEVELOPER_A, "Developer")]);
  const created = await service.createDeveloperAccount(
    {
      username: "developer-b-created",
      password: initialPassword,
      securityQuestion: SECURITY_QUESTION,
    },
    "Developer"
  );
  const stored = await credentials.findById(created.id);
  assert(stored?.role === "Developer", "case 12 must create the Developer role");
  assert(stored.mustChangePassword === false, "case 12 must set mustChangePassword=false");
  assert(stored.mustSetRecovery === true, "case 12 must set mustSetRecovery=true");
  assert(stored.securityAnswerHash === null, "case 12 must null securityAnswerHash");
}

async function verifyDeveloperEditsDeveloperUsername(): Promise<void> {
  const { credentials, service } = createSubject([
    credential(DEVELOPER_A, "Developer"),
    credential(DEVELOPER_B, "Developer"),
  ]);
  const updated = await service.updateDeveloperUsername(
    DEVELOPER_B,
    { username: "developer-b-renamed" },
    "Developer"
  );
  assert(updated.username === "developer-b-renamed", "case 13 response must contain new username");
  assert(
    (await credentials.findById(DEVELOPER_B))?.username === "developer-b-renamed",
    "case 13 must store the new username"
  );
}

async function verifySecurityQuestionResetInvalidatesRecovery(): Promise<void> {
  const existingAnswerHash = randomUUID();
  const developerB = credential(DEVELOPER_B, "Developer");
  developerB.securityAnswerHash = existingAnswerHash;
  developerB.tokenVersion = 7;
  const { credentials, service } = createSubject([
    credential(DEVELOPER_A, "Developer"),
    developerB,
  ]);
  await service.updateDeveloperSecurityQuestion(
    DEVELOPER_B,
    { securityQuestion: "What was your childhood nickname?" },
    "Developer"
  );
  const stored = await credentials.findById(DEVELOPER_B);
  assert(stored?.securityAnswerHash === null, "case 14 must null securityAnswerHash");
  assert(stored.mustSetRecovery === true, "case 14 must set mustSetRecovery=true");
  assert(stored.tokenVersion === 8, "case 14 must increment tokenVersion");
}

async function verifyPasswordResetInvalidatesSessionsWithoutFirstLoginFlag(): Promise<void> {
  const replacementPassword = randomUUID();
  const developerB = credential(DEVELOPER_B, "Developer");
  developerB.tokenVersion = 4;
  const previousHash = developerB.passwordHash;
  const { credentials, service } = createSubject([
    credential(DEVELOPER_A, "Developer"),
    developerB,
  ]);
  await service.resetDeveloperPassword(
    DEVELOPER_B,
    { password: replacementPassword },
    "Developer"
  );
  const stored = await credentials.findById(DEVELOPER_B);
  assert(stored?.tokenVersion === 5, "case 15 must increment tokenVersion");
  assert(stored.mustChangePassword === false, "case 15 must not set mustChangePassword");
  assert(stored.passwordHash !== previousHash, "case 15 must replace the stored password hash");
}

async function verifyDeveloperDeactivatesAndReactivatesDeveloper(): Promise<void> {
  const { credentials, service } = createSubject([
    credential(DEVELOPER_A, "Developer"),
    credential(DEVELOPER_B, "Developer"),
  ]);
  await service.toggleDeveloperStatus(DEVELOPER_B, DEVELOPER_A, "Developer");
  assert((await credentials.findById(DEVELOPER_B))?.status === "Inactive", "case 16 must deactivate B");
  await service.toggleDeveloperStatus(DEVELOPER_B, DEVELOPER_A, "Developer");
  assert((await credentials.findById(DEVELOPER_B))?.status === "Active", "case 16 must reactivate B");
}

async function verifyDeveloperDeletesDeveloper(): Promise<void> {
  const { credentials, service } = createSubject([
    credential(DEVELOPER_A, "Developer"),
    credential(DEVELOPER_B, "Developer"),
  ]);
  await service.deleteDeveloperAccount(DEVELOPER_B, DEVELOPER_A, "Developer");
  assert((await credentials.findById(DEVELOPER_B)) === null, "case 17 must remove B");
}

async function verifyDeveloperCannotDeleteSelf(): Promise<void> {
  const { credentials, service } = createSubject([
    credential(DEVELOPER_A, "Developer"),
    credential(DEVELOPER_B, "Developer"),
  ]);
  const error = await captureError(() =>
    service.deleteDeveloperAccount(DEVELOPER_A, DEVELOPER_A, "Developer")
  );
  assert(error instanceof SelfDeletionError, "case 18 must throw SelfDeletionError");
  assert(await credentials.findById(DEVELOPER_A), "case 18 must retain A");
}

async function verifyDeveloperCannotDeactivateSelf(): Promise<void> {
  const { credentials, service } = createSubject([
    credential(DEVELOPER_A, "Developer"),
    credential(DEVELOPER_B, "Developer"),
  ]);
  const error = await captureError(() =>
    service.toggleDeveloperStatus(DEVELOPER_A, DEVELOPER_A, "Developer")
  );
  assert(error instanceof SelfDeactivationError, "case 19 must throw SelfDeactivationError");
  assert((await credentials.findById(DEVELOPER_A))?.status === "Active", "case 19 must leave A Active");
}

async function verifyLastActiveDeveloperCannotBeDeactivated(): Promise<void> {
  const { credentials, service } = createSubject([credential(DEVELOPER_A, "Developer")]);
  const error = await captureError(() =>
    service.toggleDeveloperStatus(DEVELOPER_A, DISTINCT_ACTOR, "Developer")
  );
  assert(error instanceof LastActiveDeveloperError, "case 20 must throw LastActiveDeveloperError");
  assert((await credentials.findById(DEVELOPER_A))?.status === "Active", "case 20 must leave A Active");
}

async function verifyLastActiveDeveloperCannotBeDeleted(): Promise<void> {
  const { credentials, service } = createSubject([credential(DEVELOPER_A, "Developer")]);
  const error = await captureError(() =>
    service.deleteDeveloperAccount(DEVELOPER_A, DISTINCT_ACTOR, "Developer")
  );
  assert(error instanceof LastActiveDeveloperError, "case 21 must throw LastActiveDeveloperError");
  assert(await credentials.findById(DEVELOPER_A), "case 21 must retain A");
}

async function verifySelfDeletionPrecedesLastActiveDeveloper(): Promise<void> {
  const { credentials, service } = createSubject([credential(DEVELOPER_A, "Developer")]);
  const error = await captureError(() =>
    service.deleteDeveloperAccount(DEVELOPER_A, DEVELOPER_A, "Developer")
  );
  assert(error instanceof SelfDeletionError, "case 22 must throw SelfDeletionError");
  assert(!(error instanceof LastActiveDeveloperError), "case 22 must prefer SelfDeletionError");
  assert(await credentials.findById(DEVELOPER_A), "case 22 must retain A");
}

async function verifyDeveloperFlowCannotAlterRoles(): Promise<void> {
  const initialPassword = randomUUID();
  const replacementPassword = randomUUID();
  const records = [
    credential(DEVELOPER_A, "Developer"),
    credential(DEVELOPER_B, "Developer"),
    credential(ADMIN_A, "Admin"),
    credential(USER_A, "User"),
  ];
  const { credentials, service } = createSubject(records);
  const created = await service.createDeveloperAccount(
    {
      username: "developer-c",
      password: initialPassword,
      securityQuestion: SECURITY_QUESTION,
      role: "Admin",
    } as CreateDeveloperAccountInput,
    "Developer"
  );
  assert(created.role === "Developer", "case 23 create must force Developer role");

  await service.updateDeveloperUsername(
    DEVELOPER_B,
    { username: "developer-b-renamed", role: "User" } as UpdateDeveloperUsernameInput,
    "Developer"
  );
  await service.updateDeveloperSecurityQuestion(
    DEVELOPER_B,
    { securityQuestion: SECURITY_QUESTION, role: "User" } as UpdateDeveloperSecurityQuestionInput,
    "Developer"
  );
  await service.resetDeveloperPassword(
    DEVELOPER_B,
    { password: replacementPassword, role: "User" } as ResetDeveloperPasswordInput,
    "Developer"
  );
  await service.toggleDeveloperStatus(DEVELOPER_B, DEVELOPER_A, "Developer");
  await service.toggleDeveloperStatus(DEVELOPER_B, DEVELOPER_A, "Developer");

  for (const id of [ADMIN_A, USER_A]) {
    await captureError(() =>
      service.updateDeveloperUsername(id, { username: `${id}-changed` }, "Developer")
    );
    await captureError(() =>
      service.updateDeveloperSecurityQuestion(
        id,
        { securityQuestion: SECURITY_QUESTION },
        "Developer"
      )
    );
    await captureError(() =>
      service.resetDeveloperPassword(id, { password: replacementPassword }, "Developer")
    );
    await captureError(() =>
      service.toggleDeveloperStatus(id, DEVELOPER_A, "Developer")
    );
    await captureError(() => service.deleteDeveloperAccount(id, DEVELOPER_A, "Developer"));
  }

  await service.deleteDeveloperAccount(created.id, DEVELOPER_A, "Developer");
  for (const original of records) {
    assert(
      (await credentials.findById(original.id))?.role === original.role,
      `case 23 must preserve ${original.id} role`
    );
  }
}

async function verifyDeveloperFlowDoesNotExposeSecrets(): Promise<void> {
  const passwordHash = randomUUID();
  const answerHash = randomUUID();
  const initialPassword = randomUUID();
  const replacementPassword = randomUUID();
  const developerB = credential(DEVELOPER_B, "Developer");
  developerB.passwordHash = passwordHash;
  developerB.securityAnswerHash = answerHash;
  const { credentials, service } = createSubject([
    credential(DEVELOPER_A, "Developer"),
    developerB,
  ]);
  const responses: unknown[] = [];
  responses.push(await service.getDeveloperAccounts("Developer"));
  responses.push(
    await service.updateDeveloperUsername(
      DEVELOPER_B,
      { username: "developer-b-private" },
      "Developer"
    )
  );
  responses.push(
    await service.updateDeveloperSecurityQuestion(
      DEVELOPER_B,
      { securityQuestion: SECURITY_QUESTION },
      "Developer"
    )
  );
  responses.push(
    await service.resetDeveloperPassword(
      DEVELOPER_B,
      { password: replacementPassword },
      "Developer"
    )
  );
  const replacementHash = (await credentials.findById(DEVELOPER_B))?.passwordHash;
  responses.push(
    await service.toggleDeveloperStatus(DEVELOPER_B, DEVELOPER_A, "Developer")
  );
  responses.push(
    await service.toggleDeveloperStatus(DEVELOPER_B, DEVELOPER_A, "Developer")
  );
  const created = await service.createDeveloperAccount(
    {
      username: "developer-private-created",
      password: initialPassword,
      securityQuestion: SECURITY_QUESTION,
    },
    "Developer"
  );
  responses.push(created);
  const createdHash = (await credentials.findById(created.id))?.passwordHash;
  responses.push(
    await captureError(() =>
      service.deleteDeveloperAccount(DEVELOPER_A, DEVELOPER_A, "Developer")
    )
  );
  responses.push(
    await captureError(() =>
      service.updateDeveloperUsername("missing-developer", { username: "missing" }, "Developer")
    )
  );
  await service.deleteDeveloperAccount(created.id, DEVELOPER_A, "Developer");

  const secrets = [
    passwordHash,
    answerHash,
    initialPassword,
    replacementPassword,
    replacementHash ?? "",
    createdHash ?? "",
  ].filter(Boolean);
  responses.forEach((response, index) =>
    assertNoSensitiveData(response, secrets, `case 24 response ${index + 1}`)
  );
}

async function verifyDeveloperAuthenticationStillSucceeds(): Promise<void> {
  const loginPassword = randomUUID();
  const { service } = createSubject([]);
  const created = await service.createDeveloperAccount(
    {
      username: "developer-login",
      password: loginPassword,
      securityQuestion: SECURITY_QUESTION,
    },
    "Developer"
  );
  const authenticated = await service.authenticate(created.username, loginPassword);
  assert(authenticated.id === created.id, "case 25 must resolve the Developer account at login");
  assert(authenticated.role === "Developer", "case 25 must preserve the Developer role at login");
}

async function verifyAdminInvariantWithDeveloperFilteredCounts(): Promise<void> {
  const { credentials, service } = createSubject([
    credential(ADMIN_A, "Admin"),
    credential(DEVELOPER_A, "Developer"),
    credential(DEVELOPER_B, "Developer"),
  ]);
  assert((await service.countUsersVisibleTo("Admin")) === 1, "case 26 filtered count must exclude Developers");
  const error = await captureError(() =>
    service.updateUser(ADMIN_A, { status: "Inactive" }, DEVELOPER_A)
  );
  assert(error instanceof LastActiveAdminError, "case 26 must enforce LastActiveAdminError");
  assert((await credentials.findById(ADMIN_A))?.status === "Active", "case 26 must leave Admin Active");
}

async function verifyOrdinaryCreationPathsAgreeOnInitialLifecycle(): Promise<void> {
  const ordinarySubject = createSubject([]);
  const ordinary = await ordinarySubject.service.createUser({
    username: "ordinary-created",
    password: randomUUID(),
    role: "User",
    securityQuestion: SECURITY_QUESTION,
  });
  const storedOrdinary = await ordinarySubject.credentials.findById(ordinary.id);

  const developerSubject = createSubject([credential(DEVELOPER_A, "Developer")]);
  const developer = await developerSubject.service.createDeveloperAccount(
    {
      username: "developer-created",
      password: randomUUID(),
      securityQuestion: SECURITY_QUESTION,
    },
    "Developer"
  );
  const storedDeveloper = await developerSubject.credentials.findById(developer.id);

  for (const [label, stored] of [
    ["createUser", storedOrdinary],
    ["createDeveloperAccount", storedDeveloper],
  ] as const) {
    assert(stored, `case 27 must persist the account created by ${label}`);
    assert(
      stored.mustChangePassword === false,
      `case 27 ${label} must set mustChangePassword=false`
    );
    assert(
      stored.mustSetRecovery === true,
      `case 27 ${label} must set mustSetRecovery=true`
    );
    assert(
      stored.securityAnswerHash === null,
      `case 27 ${label} must null securityAnswerHash`
    );
    assert(stored.tokenVersion === 1, `case 27 ${label} must start at tokenVersion 1`);
  }
}

async function verifyBootstrapCreatesFirstDeveloper(): Promise<void> {
  const { credentials, service } = createSubject([]);
  const created = await service.bootstrapFirstDeveloper({
    username: "first-developer",
    password: randomUUID(),
    securityQuestion: SECURITY_QUESTION,
  });
  const stored = await credentials.findById(created.id);
  assert(stored?.role === "Developer", "case 28 must create the Developer role");
  assert(stored.status === "Active", "case 28 must create an Active account");
  assert(
    stored.mustChangePassword === true,
    "case 28 bootstrap must set mustChangePassword=true, the SECURITY_MODEL 6.5 exception that stops the operator's temporary credential persisting"
  );
  assert(stored.mustSetRecovery === true, "case 28 must set mustSetRecovery=true");
  assert(stored.securityAnswerHash === null, "case 28 must null securityAnswerHash");
  assert(stored.tokenVersion === 1, "case 28 must start at tokenVersion 1");
}

async function verifyBootstrapRefusesWhenDeveloperExists(): Promise<void> {
  for (const status of ["Active", "Inactive"] as const) {
    const { credentials, service } = createSubject([
      credential(DEVELOPER_A, "Developer", status),
    ]);
    const before = (await credentials.findAll()).length;
    const error = await captureError(() =>
      service.bootstrapFirstDeveloper({
        username: "second-developer",
        password: randomUUID(),
        securityQuestion: SECURITY_QUESTION,
      })
    );
    assert(
      error instanceof DeveloperAlreadyExistsError,
      `case 29 must refuse bootstrap when a ${status} Developer exists`
    );
    assert(
      (await credentials.findAll()).length === before,
      `case 29 must create no account when a ${status} Developer exists`
    );
  }
}

async function verifyRepeatedBootstrapRefuses(): Promise<void> {
  const { credentials, service } = createSubject([]);
  await service.bootstrapFirstDeveloper({
    username: "only-developer",
    password: randomUUID(),
    securityQuestion: SECURITY_QUESTION,
  });
  const afterFirst = (await credentials.findAll()).length;
  const error = await captureError(() =>
    service.bootstrapFirstDeveloper({
      username: "another-developer",
      password: randomUUID(),
      securityQuestion: SECURITY_QUESTION,
    })
  );
  assert(error instanceof DeveloperAlreadyExistsError, "case 30 must refuse a repeat bootstrap");
  assert(
    (await credentials.findAll()).length === afterFirst,
    "case 30 must create no second account"
  );
}

async function verifyBootstrapEmitsDurableAuditEvent(): Promise<void> {
  const subject = createSubject([]);
  const audit = new FakeAuditLog();
  const outcome = await runBootstrap(bootstrapDeps(subject, audit), {
    username: "bootstrap-audit",
    password: randomUUID(),
    securityQuestion: SECURITY_QUESTION,
  });

  assert(outcome.status === "created", "case 31 must report the Developer as created");
  assert(audit.entries.length === 1, "case 31 must emit exactly one durable audit event");
  const entry = audit.entries[0];
  assert(entry.eventType === BOOTSTRAP_EVENT_TYPE, "case 31 must use the bootstrap event type");
  assert(entry.category === "AuthAccount", "case 31 must classify the event as AuthAccount");
  assert(entry.actorRole === null, "case 31 must classify the operator as having no role");
  assert(entry.targetRole === "Developer", "case 31 must classify the target as Developer");
  assert(entry.performedByUserId === null, "case 31 must have no performing user id");
  assert(entry.performedByUsername === null, "case 31 must have no performing username");
  assert(entry.targetReference === outcome.username, "case 31 must target the created username");
  assert(entry.details?.targetUserId === outcome.userId, "case 31 must target the created user id");
}

async function verifyBootstrapRetriesTransientAuditFailure(): Promise<void> {
  const subject = createSubject([]);
  const audit = new FakeAuditLog();
  audit.failures = 2;

  const outcome = await runBootstrap(bootstrapDeps(subject, audit), {
    username: "bootstrap-retry",
    password: randomUUID(),
    securityQuestion: SECURITY_QUESTION,
  });

  assert(outcome.status === "created", "case 32 must report the Developer as created");
  assert(audit.entries.length === 1, "case 32 must record exactly one event after retrying");
}

async function verifyBootstrapAuditFailureRetainsAccount(): Promise<void> {
  const subject = createSubject([]);
  const audit = new FakeAuditLog();
  audit.failures = 99;

  const outcome = await runBootstrap(bootstrapDeps(subject, audit), {
    username: "bootstrap-audit-failure",
    password: randomUUID(),
    securityQuestion: SECURITY_QUESTION,
  });

  assert(
    outcome.status === "created-audit-failed",
    "case 33 must report exhausted audit retries"
  );
  assert(audit.entries.length === 0, "case 33 must record no audit event");
  assert(
    await subject.credentials.findById(outcome.userId),
    "case 33 must retain the created credential"
  );
  assert(
    (await subject.credentials.findAll()).length === 1,
    "case 33 must not delete the created account"
  );
}

async function verifyBootstrapAuditRepairTargetsPersistedDeveloper(): Promise<void> {
  const subject = createSubject([]);
  const audit = new FakeAuditLog();
  const deps = bootstrapDeps(subject, audit);
  audit.failures = 99;
  const outcome = await runBootstrap(deps, {
    username: "bootstrap-repair",
    password: randomUUID(),
    securityQuestion: SECURITY_QUESTION,
  });
  assert(
    outcome.status === "created-audit-failed",
    "case 34 setup must retain the Developer after audit failure"
  );

  audit.failures = 0;
  await runBootstrapAuditRepair(deps, outcome.username);
  assert(audit.entries.length === 1, "case 34 must emit exactly one repaired event");
  const entry = audit.entries[0];
  assert(entry.targetRole === "Developer", "case 34 must classify the target as Developer");
  assert(
    entry.details?.targetUserId === outcome.userId,
    "case 34 must target the exact persisted Developer"
  );

  const error = await captureError(() => runBootstrapAuditRepair(deps, outcome.username));
  assert(
    error instanceof BootstrapRefusedError,
    "case 34 must refuse repair when the bootstrap event already exists"
  );
}

async function verifyBootstrapAuditRepairIgnoresUnrelatedEvent(): Promise<void> {
  const subject = createSubject([]);
  const audit = new FakeAuditLog();
  const deps = bootstrapDeps(subject, audit);
  audit.failures = 99;
  const outcome = await runBootstrap(deps, {
    username: "bootstrap-unrelated-audit",
    password: randomUUID(),
    securityQuestion: SECURITY_QUESTION,
  });
  assert(
    outcome.status === "created-audit-failed",
    "case 35 setup must retain the Developer after audit failure"
  );

  audit.entries.push({
    id: randomUUID(),
    category: "AuthAccount",
    eventType: BOOTSTRAP_EVENT_TYPE,
    performedByUserId: null,
    performedByUsername: null,
    targetReference: "someone-else",
    actorRole: null,
    targetRole: "Developer",
    details: { targetUserId: "different-id" },
    occurredAt: new Date().toISOString(),
  });
  audit.failures = 0;

  await runBootstrapAuditRepair(deps, outcome.username);
  assert(audit.entries.length === 2, "case 35 must not let an unrelated row block repair");

  const error = await captureError(() =>
    runBootstrapAuditRepair(deps, "not-the-developer")
  );
  assert(
    error instanceof BootstrapRefusedError,
    "case 35 must refuse repair for a different username"
  );
}

async function verifyBootstrapAuditRepairMatchesRenamedDeveloperById(): Promise<void> {
  const subject = createSubject([]);
  const audit = new FakeAuditLog();
  const deps = bootstrapDeps(subject, audit);

  audit.failures = 99;
  const outcome = await runBootstrap(deps, {
    username: "bootstrap-rename",
    password: randomUUID(),
    securityQuestion: SECURITY_QUESTION,
  });
  assert(
    outcome.status === "created-audit-failed",
    "case 36 setup must retain the Developer after audit failure"
  );

  audit.failures = 0;
  await runBootstrapAuditRepair(deps, outcome.username);
  assert(audit.entries.length === 1, "case 36 setup must record the repaired event once");
  assert(
    audit.entries[0].targetReference === "bootstrap-rename",
    "case 36 setup must record the original username in targetReference"
  );

  // Rename the Developer. targetReference on the existing audit row is now stale; only
  // details.targetUserId still identifies this account.
  await subject.service.updateDeveloperUsername(
    outcome.userId,
    { username: "bootstrap-renamed" },
    "Developer"
  );

  const error = await captureError(() =>
    runBootstrapAuditRepair(deps, "bootstrap-renamed")
  );
  assert(
    error instanceof BootstrapRefusedError,
    "case 36 must refuse repair by persisted user id even after the username changed"
  );
  assert(
    audit.entries.length === 1,
    "case 36 must not emit a duplicate bootstrap event after a username change"
  );
}

async function verifyBootstrapAuditRepairRequiresSingleDeveloper(): Promise<void> {
  const subject = createSubject([
    credential(DEVELOPER_A, "Developer"),
    credential(DEVELOPER_B, "Developer"),
  ]);
  const audit = new FakeAuditLog();
  const deps = bootstrapDeps(subject, audit);

  const error = await captureError(() => runBootstrapAuditRepair(deps, DEVELOPER_A));
  assert(
    error instanceof BootstrapRefusedError,
    "case 37 must refuse repair when more than one Developer exists"
  );
  assert(
    audit.entries.length === 0,
    "case 37 must emit no audit event when repair is refused"
  );
}

async function verifyBootstrapRefusesNonCanonicalUsername(): Promise<void> {
  const subject = createSubject([]);
  const audit = new FakeAuditLog();
  const error = await captureError(() =>
    runBootstrap(bootstrapDeps(subject, audit), {
      username: "Invalid Username!",
      password: randomUUID(),
      securityQuestion: SECURITY_QUESTION,
    })
  );
  assert(
    error instanceof BootstrapRefusedError,
    "case 38 must refuse a non-canonical username as an operator refusal"
  );
  assert(
    !(error as Error).message.includes("Invalid Username!"),
    "case 38 refusal must not echo the supplied username"
  );
  assert(
    (await subject.credentials.findAll()).length === 0,
    "case 38 must create no account"
  );
  assert(audit.entries.length === 0, "case 38 must emit no audit event");
}

async function verifyBootstrapRefusesDuplicateUsername(): Promise<void> {
  const subject = createSubject([credential(USER_A)]);
  const audit = new FakeAuditLog();
  const error = await captureError(() =>
    runBootstrap(bootstrapDeps(subject, audit), {
      username: USER_A,
      password: randomUUID(),
      securityQuestion: SECURITY_QUESTION,
    })
  );
  assert(
    error instanceof BootstrapRefusedError,
    "case 39 must refuse a duplicate username as an operator refusal"
  );
  assert(
    !(error as Error).message.includes(USER_A),
    "case 39 refusal must not echo the supplied username"
  );
  assert(
    (await subject.credentials.findAll()).length === 1,
    "case 39 must create no additional account"
  );
  assert(audit.entries.length === 0, "case 39 must emit no audit event");
}

async function verifyDeveloperFirstLoginRecoveryIsDeveloperClassified(): Promise<void> {
  const audit = new FakeAuditLog();
  const subject = createAuditedSubject([credential(DEVELOPER_A, "Developer")], audit);
  await subject.service.setFirstLoginRecoveryAnswer(DEVELOPER_A, "a childhood school");
  assert(audit.entries.length === 1, "case 40 must emit exactly one first-login audit event");
  const entry = audit.entries[0];
  assert(
    entry.eventType === "FirstLoginRecoveryConfigured",
    "case 40 must emit FirstLoginRecoveryConfigured"
  );
  assert(entry.category === "AuthAccount", "case 40 must classify the event as AuthAccount");
  assert(
    entry.actorRole === "Developer" && entry.targetRole === "Developer",
    "case 40 must stamp both roles Developer so the generated column marks it Developer-involved"
  );
  assert(
    entry.performedByUserId === DEVELOPER_A && entry.targetReference === DEVELOPER_A,
    "case 40 identity must come from the persisted Developer record"
  );
  assertNoSensitiveData(
    entry,
    ["a childhood school"],
    "case 40 must not record the recovery answer"
  );
}

async function verifyDeveloperFirstLoginPasswordIsDeveloperClassified(): Promise<void> {
  const audit = new FakeAuditLog();
  const subject = createAuditedSubject([credential(DEVELOPER_A, "Developer")], audit);
  await subject.service.changeFirstLoginPassword(DEVELOPER_A, "a-new-passphrase");
  assert(audit.entries.length === 1, "case 41 must emit exactly one first-login audit event");
  const entry = audit.entries[0];
  assert(
    entry.eventType === "FirstLoginPasswordChanged",
    "case 41 must emit FirstLoginPasswordChanged"
  );
  assert(
    entry.actorRole === "Developer" && entry.targetRole === "Developer",
    "case 41 must stamp both roles Developer"
  );
  assertNoSensitiveData(entry, ["a-new-passphrase"], "case 41 must not record the new password");
}

async function verifyAdminFirstLoginIsNotDeveloperInvolved(): Promise<void> {
  const audit = new FakeAuditLog();
  const subject = createAuditedSubject([credential(ADMIN_A, "Admin")], audit);
  await subject.service.setFirstLoginRecoveryAnswer(ADMIN_A, "an answer");
  const entry = audit.entries[0];
  assert(
    entry.eventType === "FirstLoginRecoveryConfigured",
    "case 42 must emit FirstLoginRecoveryConfigured"
  );
  assert(
    entry.actorRole === "Admin" && entry.targetRole === "Admin",
    "case 42 must stamp both roles Admin, leaving developer_involved false so the event stays visible to Admin readers"
  );
}

async function verifyFirstLoginAuditRetriesTransientFailure(): Promise<void> {
  const audit = new FakeAuditLog();
  audit.failures = 2;
  const subject = createAuditedSubject([credential(USER_A, "User")], audit);
  await subject.service.setFirstLoginRecoveryAnswer(USER_A, "an answer");
  assert(
    audit.entries.length === 1,
    "case 43 must persist the event once the bounded retry succeeds"
  );
  assert(
    subject.credentials.updateCalls === 1,
    "case 43 must not repeat the credential mutation while retrying the audit write"
  );
}

async function verifyFirstLoginAuditExhaustionKeepsMutation(): Promise<void> {
  const audit = new FakeAuditLog();
  audit.failures = 3;
  const subject = createAuditedSubject([credential(USER_A, "User")], audit);

  const user = await subject.service.setFirstLoginRecoveryAnswer(USER_A, "an answer");

  assert(audit.entries.length === 0, "case 44 must exhaust every bounded audit retry");
  assert(
    subject.credentials.updateCalls === 1,
    "case 44 must perform the credential mutation exactly once, with no repeat and no compensation"
  );
  assert(
    user.mustSetRecovery === false && user.tokenVersion === 2,
    "case 44 must return the successfully updated user so session refresh and redirect continue"
  );
  const persisted = await subject.credentials.findById(USER_A);
  assert(
    persisted !== null &&
      persisted.mustSetRecovery === false &&
      persisted.securityAnswerHash !== null &&
      persisted.tokenVersion === 2,
    "case 44 must leave the credential mutation authoritative, with no rollback"
  );
}

async function verifyFirstLoginAuditFailureIsInvisibleToCaller(): Promise<void> {
  const succeeding = new FakeAuditLog();
  const healthy = createAuditedSubject([credential(USER_A, "User")], succeeding);
  const fromSuccess = await healthy.service.setFirstLoginRecoveryAnswer(USER_A, "an answer");

  const failing = new FakeAuditLog();
  failing.failures = 3;
  const degraded = createAuditedSubject([credential(USER_A, "User")], failing);
  const fromFailure = await degraded.service.setFirstLoginRecoveryAnswer(USER_A, "an answer");

  assert(
    fromSuccess.id === fromFailure.id &&
      fromSuccess.mustSetRecovery === fromFailure.mustSetRecovery &&
      fromSuccess.tokenVersion === fromFailure.tokenVersion &&
      fromSuccess.status === fromFailure.status,
    "case 45 must return the same successful user whether or not audit persistence succeeded"
  );
}

async function verifyBootstrapLifecycleIsNotSelectableThroughInput(): Promise<void> {
  const ordinarySubject = createSubject([]);
  const ordinary = await ordinarySubject.service.createUser({
    username: "input-forced-user",
    password: randomUUID(),
    role: "User",
    securityQuestion: SECURITY_QUESTION,
    mustChangePassword: true,
  } as unknown as CreateUserInput);
  const storedOrdinary = await ordinarySubject.credentials.findById(ordinary.id);
  assert(
    storedOrdinary?.mustChangePassword === false,
    "case 46 must ignore a mustChangePassword flag smuggled through ordinary user input"
  );

  const developerSubject = createSubject([credential(DEVELOPER_A, "Developer")]);
  const developer = await developerSubject.service.createDeveloperAccount(
    {
      username: "input-forced-developer",
      password: randomUUID(),
      securityQuestion: SECURITY_QUESTION,
      mustChangePassword: true,
    } as unknown as CreateDeveloperAccountInput,
    "Developer"
  );
  const storedDeveloper = await developerSubject.credentials.findById(developer.id);
  assert(
    storedDeveloper?.mustChangePassword === false,
    "case 46 must ignore a mustChangePassword flag smuggled through Developer creation input"
  );
}

async function verifyBootstrappedDeveloperRoutesThroughPasswordThenRecovery(): Promise<void> {
  const audit = new FakeAuditLog();
  const { credentials, service } = createAuditedSubject([], audit);
  const created = await service.bootstrapFirstDeveloper({
    username: "routing-first-developer",
    password: randomUUID(),
    securityQuestion: SECURITY_QUESTION,
  });

  // Mirrors destinationFor() in authActions.ts, which is byte-frozen and module-private.
  const destinationFor = (flags: { mustChangePassword: boolean; mustSetRecovery: boolean }) =>
    flags.mustChangePassword || flags.mustSetRecovery ? firstLoginRedirectPath(flags) : "/dashboard";

  assert(
    destinationFor(created) === "/first-login/password",
    "case 47 must route the bootstrapped Developer to the password-change step first"
  );

  const afterPassword = await service.changeFirstLoginPassword(created.id, randomUUID());
  assert(
    afterPassword.mustChangePassword === false && afterPassword.mustSetRecovery === true,
    "case 47 must clear mustChangePassword and still require recovery setup"
  );
  assert(
    destinationFor(afterPassword) === "/first-login/recovery",
    "case 47 must route to recovery setup after the password change"
  );

  const afterRecovery = await service.setFirstLoginRecoveryAnswer(created.id, "an answer");
  assert(
    destinationFor(afterRecovery) === "/dashboard",
    "case 47 must reach the dashboard once both first-login steps are complete"
  );
  const stored = await credentials.findById(created.id);
  assert(
    stored?.mustChangePassword === false && stored.mustSetRecovery === false,
    "case 47 must persist both first-login completions"
  );
}

async function verifyFailedDeveloperAuthenticationIsAudited(): Promise<void> {
  const audit = new FakeAuditLog();
  const subject = createAuditedSubject([credential(DEVELOPER_A, "Developer")], audit);

  const error = await captureError(() =>
    subject.service.authenticate(DEVELOPER_A, "wrong-password")
  );
  assert(
    error instanceof InvalidCredentialsError,
    "case 48 must reject a failed Developer login with InvalidCredentialsError"
  );

  const entries = audit.entries.filter((entry) => entry.eventType === "AuthenticationFailed");
  assert(entries.length === 1, "case 48 must emit exactly one AuthenticationFailed event");
  const entry = entries[0];
  assert(entry.category === "AuthAccount", "case 48 must classify the event as AuthAccount");
  assert(entry.actorRole === null, "case 48 must classify the unauthenticated actor as null");
  assert(
    entry.performedByUserId === null && entry.performedByUsername === null,
    "case 48 must not name or infer a performing user"
  );
  assert(
    entry.targetRole === "Developer",
    "case 48 must preserve the Developer target role because it makes developer_involved true and hides the event from Admin readers, preserving Developer invisibility"
  );
  assert(
    entry.targetReference === DEVELOPER_A,
    "case 48 must target the persisted Developer username"
  );
  assert(
    JSON.stringify(entry.details) === JSON.stringify({ outcome: "invalid_password" }),
    "case 48 details must contain only the invalid_password outcome"
  );
  assertNoSensitiveData(
    entry,
    ["wrong-password"],
    "case 48 must never record the attempted password"
  );
}

async function verifyFailedAdminAuthenticationIsAudited(): Promise<void> {
  const audit = new FakeAuditLog();
  const subject = createAuditedSubject([credential(ADMIN_A, "Admin")], audit);

  const error = await captureError(() =>
    subject.service.authenticate(ADMIN_A, "wrong-password")
  );
  assert(
    error instanceof InvalidCredentialsError,
    "case 49 must reject a failed Admin login with InvalidCredentialsError"
  );

  const entries = audit.entries.filter((entry) => entry.eventType === "AuthenticationFailed");
  assert(entries.length === 1, "case 49 must emit exactly one AuthenticationFailed event");
  const entry = entries[0];
  assert(
    entry.targetRole === "Admin" && entry.actorRole === null,
    "case 49 must keep the Admin target role and null actor role so developer_involved stays false and the event remains visible to Admin readers"
  );
}

async function verifyUnknownUsernameAuthenticationFailureIsAudited(): Promise<void> {
  const audit = new FakeAuditLog();
  const subject = createAuditedSubject([], audit);

  const error = await captureError(() =>
    subject.service.authenticate("no-such-user", "irrelevant")
  );
  assert(
    error instanceof InvalidCredentialsError,
    "case 50 must reject an unknown username with InvalidCredentialsError"
  );

  const entries = audit.entries.filter((entry) => entry.eventType === "AuthenticationFailed");
  assert(entries.length === 1, "case 50 must emit exactly one AuthenticationFailed event");
  const entry = entries[0];
  assert(
    entry.targetRole === null &&
      entry.actorRole === null &&
      entry.performedByUserId === null &&
      entry.performedByUsername === null,
    "case 50 must fabricate no user id or role for an unknown username"
  );
  assert(
    entry.targetReference === "no-such-user",
    "case 50 must retain the bounded unknown username as the target reference"
  );
  assert(
    JSON.stringify(entry.details) === JSON.stringify({ outcome: "unknown_username" }),
    "case 50 details must contain only the unknown_username outcome"
  );
}

async function verifyInactiveAccountAuthenticationFailureIsAudited(): Promise<void> {
  const audit = new FakeAuditLog();
  const subject = createAuditedSubject([credential(USER_A, "User", "Inactive")], audit);

  const error = await captureError(() =>
    subject.service.authenticate(USER_A, "wrong-password")
  );
  assert(
    error instanceof InvalidCredentialsError,
    "case 51 must reject a deactivated account with InvalidCredentialsError"
  );

  const entries = audit.entries.filter((entry) => entry.eventType === "AuthenticationFailed");
  assert(entries.length === 1, "case 51 must emit exactly one AuthenticationFailed event");
  const entry = entries[0];
  assert(
    entry.targetRole === "User",
    "case 51 must preserve the deactivated account's real User role"
  );
  assert(
    JSON.stringify(entry.details) === JSON.stringify({ outcome: "inactive_account" }),
    "case 51 details must contain only the inactive_account outcome"
  );
}

async function verifyFailedAuthenticationAuditFailureIsSwallowedWithoutRetry(): Promise<void> {
  const audit = new FakeAuditLog();
  audit.failures = 1;
  const subject = createAuditedSubject([credential(USER_A, "User")], audit);

  const error = await captureError(() =>
    subject.service.authenticate(USER_A, "wrong-password")
  );
  assert(
    error instanceof InvalidCredentialsError,
    "case 52 must preserve InvalidCredentialsError when audit persistence fails"
  );
  assert(audit.emitCalls === 1, "case 52 must make exactly one audit persistence attempt");

  const entries = audit.entries.filter((entry) => entry.eventType === "AuthenticationFailed");
  assert(
    entries.length === 0,
    "case 52 must persist no AuthenticationFailed entry; a retrying writer would have succeeded on a second attempt and produced an entry, so this is the behavioural proof that no retry exists on the attacker-reachable path"
  );
}

async function verifySuccessfulAuthenticationEmitsNoFailureEvent(): Promise<void> {
  const audit = new FakeAuditLog();
  const loginPassword = randomUUID();
  const subject = createAuditedSubject([], audit);
  const created = await subject.service.createDeveloperAccount(
    {
      username: "successful-login",
      password: loginPassword,
      securityQuestion: SECURITY_QUESTION,
    },
    "Developer"
  );

  const authenticated = await subject.service.authenticate(created.username, loginPassword);
  assert(
    authenticated.id === created.id,
    "case 53 must authenticate the account with the correct password"
  );
  const entries = audit.entries.filter((entry) => entry.eventType === "AuthenticationFailed");
  assert(
    entries.length === 0,
    "case 53 must emit no AuthenticationFailed event for a successful login; successful-login auditing belongs to a later slice"
  );
}

async function verifySuccessfulDeveloperAuthenticationIsAudited(): Promise<void> {
  const audit = new FakeAuditLog();
  const loginPassword = randomUUID();
  const subject = createAuditedSubject([], audit);
  const created = await subject.service.createDeveloperAccount(
    {
      username: "audited-developer-login",
      password: loginPassword,
      securityQuestion: SECURITY_QUESTION,
    },
    "Developer"
  );

  const authenticated = await subject.service.authenticate(created.username, loginPassword);
  assert(
    authenticated.id === created.id,
    "case 54 must authenticate the Developer account with the correct password"
  );
  const entries = audit.entries.filter(
    (e) => e.eventType === "AuthenticationSucceeded"
  );
  assert(entries.length === 1, "case 54 must emit exactly one AuthenticationSucceeded event");
  const entry = entries[0];
  assert(entry.category === "AuthAccount", "case 54 must classify the event as AuthAccount");
  assert(
    entry.actorRole === "Developer" && entry.targetRole === "Developer",
    "case 54 must stamp both roles as Developer, making developer_involved true so the event is hidden from Admin readers"
  );
  assert(
    entry.performedByUserId === created.id &&
      entry.targetReference === created.username,
    "case 54 must resolve the actor id and target reference from the created Developer account"
  );
  assert(entry.details === null, "case 54 must persist no extra details payload");
}

async function verifySuccessfulOrdinaryAuthenticationIsAudited(): Promise<void> {
  const audit = new FakeAuditLog();
  const loginPassword = randomUUID();
  const subject = createAuditedSubject([], audit);
  const created = await subject.service.createUser({
    username: "audited-ordinary-login",
    password: loginPassword,
    role: "User",
    securityQuestion: SECURITY_QUESTION,
  });

  const authenticated = await subject.service.authenticate(created.username, loginPassword);
  assert(
    authenticated.id === created.id,
    "case 55 must authenticate the ordinary account with the correct password"
  );
  const entries = audit.entries.filter(
    (e) => e.eventType === "AuthenticationSucceeded"
  );
  assert(entries.length === 1, "case 55 must emit exactly one AuthenticationSucceeded event");
  const entry = entries[0];
  assert(
    entry.actorRole === "User" && entry.targetRole === "User",
    "case 55 must stamp both roles as User, leaving developer_involved false so the event stays visible to Admin readers"
  );
}

async function verifySuccessfulAuthenticationAuditFailureIsSwallowedWithoutRetry(): Promise<void> {
  const audit = new FakeAuditLog();
  const loginPassword = randomUUID();
  const subject = createAuditedSubject([], audit);
  const created = await subject.service.createUser({
    username: "successful-audit-failure",
    password: loginPassword,
    role: "User",
    securityQuestion: SECURITY_QUESTION,
  });

  audit.failures = 1;
  const emitCallsBeforeAuthentication = audit.emitCalls;
  const authenticated = await subject.service.authenticate(created.username, loginPassword);
  assert(
    authenticated.id === created.id,
    "case 56 must still succeed and return the account when success-audit persistence fails"
  );
  assert(
    audit.emitCalls === emitCallsBeforeAuthentication + 1,
    "case 56 must make exactly one successful-authentication audit persistence attempt"
  );
  const entries = audit.entries.filter(
    (e) => e.eventType === "AuthenticationSucceeded"
  );
  assert(
    entries.length === 0,
    "case 56 must persist no AuthenticationSucceeded entry; a retrying writer would have succeeded on a second attempt and produced an entry, so this is the behavioural proof that no retry exists"
  );
}

async function verifyFailedAuthenticationEmitsNoSuccessEvent(): Promise<void> {
  const audit = new FakeAuditLog();
  const subject = createAuditedSubject([credential(USER_A, "User")], audit);

  const error = await captureError(() =>
    subject.service.authenticate(USER_A, "wrong-password")
  );
  assert(
    error instanceof InvalidCredentialsError,
    "case 57 must reject the wrong password with InvalidCredentialsError"
  );
  const entries = audit.entries.filter(
    (e) => e.eventType === "AuthenticationSucceeded"
  );
  assert(
    entries.length === 0,
    "case 57 must emit no AuthenticationSucceeded event for a failed login"
  );
}

async function verifySuccessfulDeveloperPasswordChangeIsAudited(): Promise<void> {
  const currentPassword = randomUUID();
  const newPassword = randomUUID();
  const initial = {
    ...credential(DEVELOPER_A, "Developer"),
    passwordHash: await hashPassword(currentPassword),
    securityQuestion: "What is the persisted Developer recovery question?",
    securityAnswerHash: "persisted-developer-security-answer-hash",
    mustChangePassword: true,
    mustSetRecovery: true,
    tokenVersion: 7,
  };
  const audit = new FakeAuditLog();
  const subject = createAuditedSubject([initial], audit);

  const changed = await subject.service.changeOwnPassword(
    initial.id,
    currentPassword,
    newPassword,
    "198.51.100.58"
  );
  const stored = await subject.credentials.findById(initial.id);
  assert(stored, "case 58 must retain the changed Developer account");
  assert(
    changed.tokenVersion === initial.tokenVersion + 1 &&
      stored.tokenVersion === initial.tokenVersion + 1,
    "case 58 must increment the Developer tokenVersion by exactly one"
  );
  assert(
    stored.securityAnswerHash === initial.securityAnswerHash &&
      stored.securityQuestion === initial.securityQuestion &&
      stored.mustChangePassword === initial.mustChangePassword &&
      stored.mustSetRecovery === initial.mustSetRecovery,
    "case 58 must leave the security answer, security question, and both first-login flags unchanged"
  );
  assert(
    stored.passwordHash !== initial.passwordHash &&
      (await verifyPassword(newPassword, stored.passwordHash)),
    "case 58 must persist the new Developer password after current-password verification"
  );

  const entries = audit.entries.filter((entry) => entry.eventType === "AccountPasswordChanged");
  assert(entries.length === 1, "case 58 must emit exactly one AccountPasswordChanged event");
  const entry = entries[0];
  assert(entry.category === "AuthAccount", "case 58 must classify the event as AuthAccount");
  assert(
    entry.actorRole === "Developer" && entry.targetRole === "Developer",
    "case 58 must stamp both roles as Developer, making developer_involved true"
  );
  assert(
    entry.performedByUserId === initial.id &&
      entry.performedByUsername === initial.username &&
      entry.targetReference === initial.username,
    "case 58 must resolve all audit identity from the persisted Developer record"
  );
  assert(entry.details === null, "case 58 must persist no password-change details payload");
  assertNoSensitiveData(
    entry,
    [currentPassword, newPassword, initial.passwordHash, initial.securityAnswerHash],
    "case 58 AccountPasswordChanged event"
  );
}

async function verifySuccessfulOrdinaryPasswordChangeIsAudited(): Promise<void> {
  const currentPassword = randomUUID();
  const newPassword = randomUUID();
  const initial = {
    ...credential(USER_A, "User"),
    passwordHash: await hashPassword(currentPassword),
    securityAnswerHash: "persisted-user-security-answer-hash",
    tokenVersion: 11,
  };
  const audit = new FakeAuditLog();
  const subject = createAuditedSubject([initial], audit);

  const changed = await subject.service.changeOwnPassword(
    initial.id,
    currentPassword,
    newPassword,
    "198.51.100.59"
  );
  const stored = await subject.credentials.findById(initial.id);
  assert(stored, "case 59 must retain the changed ordinary account");
  assert(
    changed.tokenVersion === initial.tokenVersion + 1 &&
      stored.tokenVersion === initial.tokenVersion + 1,
    "case 59 must increment the ordinary account tokenVersion by exactly one"
  );
  assert(
    stored.securityAnswerHash === initial.securityAnswerHash &&
      stored.securityQuestion === initial.securityQuestion &&
      stored.mustChangePassword === initial.mustChangePassword &&
      stored.mustSetRecovery === initial.mustSetRecovery,
    "case 59 must leave ordinary-account recovery state and first-login flags unchanged"
  );

  const entries = audit.entries.filter((entry) => entry.eventType === "AccountPasswordChanged");
  assert(entries.length === 1, "case 59 must emit exactly one AccountPasswordChanged event");
  const entry = entries[0];
  assert(
    entry.actorRole === "User" && entry.targetRole === "User",
    "case 59 must stamp both roles as User, leaving developer_involved false"
  );
  assert(entry.details === null, "case 59 must persist no password-change details payload");
  assertNoSensitiveData(
    entry,
    [currentPassword, newPassword, initial.passwordHash, initial.securityAnswerHash],
    "case 59 AccountPasswordChanged event"
  );
}

async function verifyWrongCurrentPasswordLeavesCredentialUnchanged(): Promise<void> {
  const currentPassword = randomUUID();
  const wrongPassword = randomUUID();
  const proposedPassword = randomUUID();
  const initial = {
    ...credential(USER_A, "User"),
    passwordHash: await hashPassword(currentPassword),
    securityAnswerHash: "wrong-password-case-security-answer-hash",
    tokenVersion: 13,
  };
  const audit = new FakeAuditLog();
  const subject = createAuditedSubject([initial], audit);

  const error = await captureError(() =>
    subject.service.changeOwnPassword(
      initial.id,
      wrongPassword,
      proposedPassword,
      "198.51.100.60"
    )
  );
  assert(
    error instanceof InvalidCredentialsError,
    "case 60 must reject a wrong current password with InvalidCredentialsError"
  );
  const stored = await subject.credentials.findById(initial.id);
  assert(
    stored?.passwordHash === initial.passwordHash &&
      stored.tokenVersion === initial.tokenVersion,
    "case 60 must leave passwordHash and tokenVersion unchanged after a wrong current password"
  );
  assert(subject.credentials.updateCalls === 0, "case 60 must perform no credential mutation");

  const entries = audit.entries.filter(
    (entry) => entry.eventType === "AccountPasswordChangeFailed"
  );
  assert(
    entries.length === 1,
    "case 60 must emit exactly one AccountPasswordChangeFailed event"
  );
  const entry = entries[0];
  assert(
    entry.actorRole === "User" &&
      entry.targetRole === "User" &&
      entry.performedByUserId === initial.id &&
      entry.performedByUsername === initial.username &&
      entry.targetReference === initial.username,
    "case 60 must derive the failed-change event identity and roles from the persisted account"
  );
  assert(entry.details === null, "case 60 must persist no failed-change details payload");
  assertNoSensitiveData(
    entry,
    [
      currentPassword,
      wrongPassword,
      proposedPassword,
      initial.passwordHash,
      initial.securityAnswerHash,
    ],
    "case 60 AccountPasswordChangeFailed event"
  );
}

async function verifySuccessfulPasswordChangeAuditFailureIsSwallowed(): Promise<void> {
  const currentPassword = randomUUID();
  const newPassword = randomUUID();
  const initial = {
    ...credential(USER_A, "User"),
    passwordHash: await hashPassword(currentPassword),
    tokenVersion: 17,
  };
  const audit = new FakeAuditLog();
  audit.failures = 1;
  const subject = createAuditedSubject([initial], audit);

  const changed = await subject.service.changeOwnPassword(
    initial.id,
    currentPassword,
    newPassword,
    null
  );
  const stored = await subject.credentials.findById(initial.id);
  assert(
    changed.tokenVersion === initial.tokenVersion + 1 &&
      stored?.tokenVersion === initial.tokenVersion + 1 &&
      stored.passwordHash !== initial.passwordHash,
    "case 61 must preserve the successful password-change outcome when audit persistence fails"
  );
  assert(audit.emitCalls === 1, "case 61 must make exactly one audit persistence attempt");
  assert(
    audit.entries.filter((entry) => entry.eventType === "AccountPasswordChanged").length === 0,
    "case 61 must not retry the failed AccountPasswordChanged audit write"
  );
}

async function verifyFailedPasswordChangeAuditFailureIsSwallowed(): Promise<void> {
  const currentPassword = randomUUID();
  const wrongPassword = randomUUID();
  const proposedPassword = randomUUID();
  const initial = {
    ...credential(USER_A, "User"),
    passwordHash: await hashPassword(currentPassword),
    tokenVersion: 19,
  };
  const audit = new FakeAuditLog();
  audit.failures = 1;
  const subject = createAuditedSubject([initial], audit);

  const error = await captureError(() =>
    subject.service.changeOwnPassword(initial.id, wrongPassword, proposedPassword, null)
  );
  assert(
    error instanceof InvalidCredentialsError,
    "case 62 must preserve InvalidCredentialsError when failed-change audit persistence fails"
  );
  const stored = await subject.credentials.findById(initial.id);
  assert(
    stored?.passwordHash === initial.passwordHash &&
      stored.tokenVersion === initial.tokenVersion,
    "case 62 must preserve the rejected password-change outcome when audit persistence fails"
  );
  assert(audit.emitCalls === 1, "case 62 must make exactly one audit persistence attempt");
  assert(
    audit.entries.filter((entry) => entry.eventType === "AccountPasswordChangeFailed").length === 0,
    "case 62 must not retry the failed AccountPasswordChangeFailed audit write"
  );
}

async function verifyStalePasswordChangeStateIsRejected(): Promise<void> {
  const currentPassword = randomUUID();
  const newPassword = randomUUID();
  const initial = {
    ...credential(USER_A, "User"),
    passwordHash: await hashPassword(currentPassword),
    tokenVersion: 23,
  };
  const audit = new FakeAuditLog();
  const subject = createAuditedSubject([initial], audit);
  subject.credentials.rejectNextTokenVersionUpdate = true;

  const error = await captureError(() =>
    subject.service.changeOwnPassword(initial.id, currentPassword, newPassword, "198.51.100.63")
  );
  assert(
    error instanceof PasswordChangeConflictError,
    "case 63 must reject a stale expected token version with PasswordChangeConflictError"
  );
  const stored = await subject.credentials.findById(initial.id);
  assert(
    stored?.passwordHash === initial.passwordHash && stored.tokenVersion === initial.tokenVersion,
    "case 63 must leave passwordHash and tokenVersion unchanged after a guarded-update conflict"
  );
  assert(
    audit.entries.filter((entry) => entry.eventType === "AccountPasswordChanged").length === 0,
    "case 63 must emit no AccountPasswordChanged event after a guarded-update conflict"
  );
}

async function verifyFailedPasswordChangeAuditSurvivesRecordFailure(): Promise<void> {
  const currentPassword = randomUUID();
  const wrongPassword = randomUUID();
  const proposedPassword = randomUUID();
  const initial = {
    ...credential(USER_A, "User"),
    passwordHash: await hashPassword(currentPassword),
    tokenVersion: 29,
  };
  const audit = new FakeAuditLog();
  const attempts = new FakeLoginAttemptRepository();
  attempts.recordFailures = 1;
  const subject = createAuditedSubject([initial], audit, attempts);

  const error = await captureError(() =>
    subject.service.changeOwnPassword(initial.id, wrongPassword, proposedPassword, "198.51.100.64")
  );
  assert(
    error instanceof Error && error.message === "simulated rate-limit record failure",
    "case 64 must surface the rate-limit record failure after handling the wrong current password"
  );
  const stored = await subject.credentials.findById(initial.id);
  assert(
    stored?.passwordHash === initial.passwordHash && stored.tokenVersion === initial.tokenVersion,
    "case 64 must perform no password mutation when rate-limit recording throws after a mismatch"
  );
  assert(subject.credentials.updateCalls === 0, "case 64 must make no unguarded mutation call");
  assert(
    audit.entries.filter((entry) => entry.eventType === "AccountPasswordChangeFailed").length === 1,
    "case 64 must emit exactly one AccountPasswordChangeFailed before rate-limit recording throws"
  );
}

async function verifyAdminResetsOrdinaryPassword(): Promise<void> {
  const replacementPassword = randomUUID();
  const initial = credential(USER_A);
  initial.passwordHash = randomUUID();
  initial.securityAnswerHash = randomUUID();
  initial.securityQuestion = "What city were you born in?";
  initial.mustChangePassword = true;
  initial.mustSetRecovery = true;
  initial.tokenVersion = 7;
  const { credentials, service } = createSubject([initial]);

  await service.resetUserPassword(
    initial.id,
    { password: replacementPassword },
    "Admin"
  );

  const stored = await credentials.findById(initial.id);
  assert(
    stored !== null &&
      stored.passwordHash !== initial.passwordHash &&
      (await verifyPassword(replacementPassword, stored.passwordHash)),
    "case 65 must replace the ordinary account password hash"
  );
  assert(
    stored.tokenVersion === initial.tokenVersion + 1,
    "case 65 must increment tokenVersion by exactly one"
  );
  assert(
    stored.securityAnswerHash === initial.securityAnswerHash &&
      stored.securityQuestion === initial.securityQuestion &&
      stored.mustChangePassword === initial.mustChangePassword &&
      stored.mustSetRecovery === initial.mustSetRecovery,
    "case 65 must preserve recovery and first-login state"
  );
}

async function verifyDeveloperResetsOrdinaryPassword(): Promise<void> {
  const replacementPassword = randomUUID();
  const initial = credential(USER_A, "Admin");
  initial.securityAnswerHash = randomUUID();
  initial.securityQuestion = "What city were you born in?";
  initial.mustChangePassword = false;
  initial.mustSetRecovery = true;
  initial.tokenVersion = 13;
  const { credentials, service } = createSubject([initial]);

  await service.resetUserPassword(
    initial.id,
    { password: replacementPassword },
    "Developer"
  );

  const stored = await credentials.findById(initial.id);
  assert(
    stored !== null &&
      stored.passwordHash !== initial.passwordHash &&
      (await verifyPassword(replacementPassword, stored.passwordHash)),
    "case 66 must allow a Developer caller to replace an ordinary password hash"
  );
  assert(
    stored.tokenVersion === initial.tokenVersion + 1,
    "case 66 must increment tokenVersion by exactly one"
  );
  assert(
    stored.securityAnswerHash === initial.securityAnswerHash &&
      stored.securityQuestion === initial.securityQuestion &&
      stored.mustChangePassword === initial.mustChangePassword &&
      stored.mustSetRecovery === initial.mustSetRecovery,
    "case 66 must preserve recovery and first-login state"
  );
}

async function verifyUserCannotResetOrdinaryPassword(): Promise<void> {
  const replacementPassword = randomUUID();
  const initial = credential(USER_A);
  initial.tokenVersion = 17;
  const { credentials, service } = createSubject([initial]);

  const error = await captureError(() =>
    service.resetUserPassword(initial.id, { password: replacementPassword }, "User")
  );
  const stored = await credentials.findById(initial.id);
  assert(error instanceof Error, "case 67 must reject a User caller");
  assert(
    stored?.passwordHash === initial.passwordHash &&
      stored.tokenVersion === initial.tokenVersion,
    "case 67 must leave the credential unchanged"
  );
}

async function verifyOrdinaryResetRejectsDeveloperTarget(): Promise<void> {
  const replacementPassword = randomUUID();
  const initial = credential(DEVELOPER_A, "Developer");
  initial.tokenVersion = 19;
  const { credentials, service } = createSubject([initial]);

  let error: unknown = null;
  try {
    await service.resetUserPassword(initial.id, { password: replacementPassword }, "Admin");
  } catch (caught) {
    error = caught;
  }
  const stored = await credentials.findById(initial.id);
  assert(
    error instanceof UserNotFoundError,
    "case 68 must hide and reject a Developer target from Admin"
  );
  assert(
    stored?.passwordHash === initial.passwordHash &&
      stored.tokenVersion === initial.tokenVersion,
    "case 68 must leave the Developer credential unchanged"
  );
}

async function verifyUpdateUserIgnoresPasswordLikeField(): Promise<void> {
  const replacementPassword = randomUUID();
  const initial = credential(USER_A);
  initial.tokenVersion = 23;
  const { credentials, service } = createSubject([initial]);

  await service.updateUser(
    initial.id,
    { password: replacementPassword } as UpdateUserInput,
    ADMIN_A
  );

  const stored = await credentials.findById(initial.id);
  assert(
    stored?.passwordHash === initial.passwordHash &&
      stored.tokenVersion === initial.tokenVersion,
    "case 69 must leave passwordHash and tokenVersion untouched"
  );
}

async function verifyDeveloperLogoutUsesPersistedIdentity(): Promise<void> {
  const persisted = {
    ...credential(DEVELOPER_A, "Developer"),
    username: "persisted-developer-logout",
  };
  const audit = new FakeAuditLog();
  const lookupIds: string[] = [];
  const sessionUserId = "session-developer-id";
  const spoofedSession = {
    ...sessionFor(sessionUserId),
    role: "Admin" as AuthRole,
    username: "session-supplied-identity",
  };

  await emitLogoutAuditForSession(spoofedSession, {
    getUserById: async (userId) => {
      lookupIds.push(userId);
      return persisted;
    },
    emit: (event) => audit.emit(event),
  });

  assert(
    lookupIds.length === 1 && lookupIds[0] === sessionUserId,
    "case 70 must re-read the persisted Developer account exactly once by session userId"
  );
  const entries = audit.entries.filter(
    (entry) => entry.eventType === "AuthenticationLoggedOut"
  );
  assert(entries.length === 1, "case 70 must emit exactly one AuthenticationLoggedOut event");
  const entry = entries[0];
  assert(entry.category === "AuthAccount", "case 70 must classify the event as AuthAccount");
  assert(
    entry.actorRole === "Developer" && entry.targetRole === "Developer",
    "case 70 must stamp both roles as Developer, making developer_involved true so Admin readers cannot see the event"
  );
  assert(
    entry.performedByUserId === persisted.id &&
      entry.performedByUsername === persisted.username &&
      entry.targetReference === persisted.username,
    "case 70 must derive every audit identity field from the persisted Developer record"
  );
  assert(entry.details === null, "case 70 must persist no extra details payload");
}

async function verifyOrdinaryLogoutUsesPersistedRole(): Promise<void> {
  const persisted = {
    ...credential(USER_A, "User"),
    username: "persisted-ordinary-logout",
  };
  const audit = new FakeAuditLog();
  const spoofedSession = {
    ...sessionFor(persisted.id),
    role: "Developer" as AuthRole,
    username: "spoofed-developer-session",
  };

  await emitLogoutAuditForSession(spoofedSession, {
    getUserById: async () => persisted,
    emit: (event) => audit.emit(event),
  });

  const entries = audit.entries.filter(
    (entry) => entry.eventType === "AuthenticationLoggedOut"
  );
  assert(entries.length === 1, "case 71 must emit exactly one AuthenticationLoggedOut event");
  const entry = entries[0];
  assert(
    entry.actorRole === persisted.role && entry.targetRole === persisted.role,
    "case 71 must stamp both roles from the persisted ordinary account"
  );
  assert(
    entry.performedByUserId === persisted.id &&
      entry.performedByUsername === persisted.username &&
      entry.targetReference === persisted.username,
    "case 71 must derive every audit identity field from the persisted ordinary account"
  );
}

async function verifyNullSessionEmitsNoLogout(): Promise<void> {
  let lookupCalls = 0;
  const audit = new FakeAuditLog();

  await emitLogoutAuditForSession(null, {
    getUserById: async () => {
      lookupCalls += 1;
      return credential(USER_A);
    },
    emit: (event) => audit.emit(event),
  });

  assert(lookupCalls === 0, "case 72 must not resolve an account for a null session");
  assert(audit.emitCalls === 0, "case 72 must emit nothing for passive session loss");
}

async function verifyMissingLogoutAccountEmitsNothing(): Promise<void> {
  let lookupCalls = 0;
  const audit = new FakeAuditLog();

  await emitLogoutAuditForSession(sessionFor("removed-account"), {
    getUserById: async () => {
      lookupCalls += 1;
      return null;
    },
    emit: (event) => audit.emit(event),
  });

  assert(lookupCalls === 1, "case 73 must attempt exactly one persisted-account re-read");
  assert(audit.emitCalls === 0, "case 73 must emit nothing when the account no longer resolves");
}

async function verifyLogoutAuditFailureIsSwallowedWithoutRetry(): Promise<void> {
  const persisted = credential(USER_A, "User");
  const audit = new FakeAuditLog();
  audit.failures = 1;
  const consoleErrors: unknown[][] = [];
  const originalConsoleError = console.error;
  let logoutCompleted = false;
  let logoutError: unknown = null;

  try {
    console.error = (...values: unknown[]) => {
      consoleErrors.push(values);
    };
    try {
      await emitLogoutAuditForSession(sessionFor(persisted.id), {
        getUserById: async () => persisted,
        emit: (event) => audit.emit(event),
      });
      logoutCompleted = true;
    } catch (error) {
      logoutError = error;
    }
  } finally {
    console.error = originalConsoleError;
  }

  assert(
    logoutCompleted && logoutError === null,
    "case 74 must allow logout completion after audit persistence fails"
  );
  assert(audit.emitCalls === 1, "case 74 must make exactly one logout audit persistence attempt");
  assert(
    audit.entries.every((entry) => entry.eventType !== "AuthenticationLoggedOut"),
    "case 74 must not retry the failed AuthenticationLoggedOut persistence attempt"
  );
  assert(consoleErrors.length === 1, "case 74 must make exactly one sanitized console.error call");
  assert(
    consoleErrors[0].length === 2 &&
      JSON.stringify(consoleErrors[0][1]) ===
        JSON.stringify({ eventType: "AuthenticationLoggedOut" }),
    "case 74 console.error metadata must carry only the AuthenticationLoggedOut eventType"
  );
}

async function verifyLogoutAccountLookupFailureIsSwallowed(): Promise<void> {
  const audit = new FakeAuditLog();
  const consoleErrors: unknown[][] = [];
  const originalConsoleError = console.error;
  let lookupCalls = 0;
  let logoutCompleted = false;
  let logoutError: unknown = null;

  try {
    console.error = (...values: unknown[]) => {
      consoleErrors.push(values);
    };
    try {
      await emitLogoutAuditForSession(sessionFor(USER_A), {
        getUserById: async () => {
          lookupCalls += 1;
          throw new Error("injected persisted-account lookup failure");
        },
        emit: (event) => audit.emit(event),
      });
      logoutCompleted = true;
    } catch (error) {
      logoutError = error;
    }
  } finally {
    console.error = originalConsoleError;
  }

  assert(
    logoutCompleted && logoutError === null,
    "case 75 must allow logout completion after the persisted-account lookup rejects"
  );
  assert(lookupCalls === 1, "case 75 must attempt the persisted-account lookup exactly once");
  assert(audit.emitCalls === 0, "case 75 must not emit without a resolved persisted account");
  assert(consoleErrors.length === 1, "case 75 must make exactly one sanitized console.error call");
  assert(
    consoleErrors[0].length === 2 &&
      JSON.stringify(consoleErrors[0][1]) ===
        JSON.stringify({ eventType: "AuthenticationLoggedOut" }),
    "case 75 console.error metadata must carry only the AuthenticationLoggedOut eventType"
  );
}

function verifyAuthActionsExportsOnlyApprovedSurface(): void {
  const source = readFileSync(
    new URL("../src/features/auth/authActions.ts", import.meta.url),
    "utf8"
  );
  const exportedNames = new Set<string>();

  for (const match of source.matchAll(
    /\bexport\s+(?:declare\s+)?(?:async\s+)?(?:function|type|interface|class|const|let|var|enum)\s+([A-Za-z_$][\w$]*)/g
  )) {
    exportedNames.add(match[1]);
  }
  for (const match of source.matchAll(/\bexport\s*\{([^}]+)\}/g)) {
    for (const specifier of match[1].split(",")) {
      const name = /\bas\s+([A-Za-z_$][\w$]*)\s*$/.exec(specifier.trim())?.[1] ??
        specifier.trim().split(/\s+/)[0];
      if (name) exportedNames.add(name);
    }
  }

  const approved = [
    "AuthActionResult",
    "changeFirstLoginPasswordAction",
    "loginAction",
    "logoutAction",
    "setFirstLoginRecoveryAnswerAction",
  ];
  assert(
    !/\bexport\s+(?:default|\*)/.test(source) &&
      JSON.stringify([...exportedNames].sort()) === JSON.stringify(approved),
    "case 76 authActions.ts must export exactly the five approved pre-F5 names and nothing else"
  );
}

async function main(): Promise<void> {
  await verifyAdminListExcludesDevelopers();
  await verifyDeveloperListIncludesDevelopers();
  await verifyAdminCountExcludesDevelopers();
  await verifyAdminReadOfDeveloperIsNotFound();
  await verifyDeveloperAndMissingNotFoundAreIndistinguishable();
  await verifyAdminUpdateCannotMutateDeveloper();
  await verifyAdminDeleteCannotRemoveDeveloper();
  await verifyAdminToggleCannotMutateDeveloper();
  await verifyOrdinaryCreateRejectsDeveloperRole();
  await verifyOrdinaryPromotionToDeveloperFails();
  await verifyOrdinaryDemotionOfDeveloperFailsForEveryRole();
  await verifyDeveloperCreatesDeveloperWithRequiredFlags();
  await verifyDeveloperEditsDeveloperUsername();
  await verifySecurityQuestionResetInvalidatesRecovery();
  await verifyPasswordResetInvalidatesSessionsWithoutFirstLoginFlag();
  await verifyDeveloperDeactivatesAndReactivatesDeveloper();
  await verifyDeveloperDeletesDeveloper();
  await verifyDeveloperCannotDeleteSelf();
  await verifyDeveloperCannotDeactivateSelf();
  await verifyLastActiveDeveloperCannotBeDeactivated();
  await verifyLastActiveDeveloperCannotBeDeleted();
  await verifySelfDeletionPrecedesLastActiveDeveloper();
  await verifyDeveloperFlowCannotAlterRoles();
  await verifyDeveloperFlowDoesNotExposeSecrets();
  await verifyDeveloperAuthenticationStillSucceeds();
  await verifyAdminInvariantWithDeveloperFilteredCounts();
  await verifyOrdinaryCreationPathsAgreeOnInitialLifecycle();
  await verifyBootstrapCreatesFirstDeveloper();
  await verifyBootstrapRefusesWhenDeveloperExists();
  await verifyRepeatedBootstrapRefuses();
  await verifyBootstrapEmitsDurableAuditEvent();
  await verifyBootstrapRetriesTransientAuditFailure();
  await verifyBootstrapAuditFailureRetainsAccount();
  await verifyBootstrapAuditRepairTargetsPersistedDeveloper();
  await verifyBootstrapAuditRepairIgnoresUnrelatedEvent();
  await verifyBootstrapAuditRepairMatchesRenamedDeveloperById();
  await verifyBootstrapAuditRepairRequiresSingleDeveloper();
  await verifyBootstrapRefusesNonCanonicalUsername();
  await verifyBootstrapRefusesDuplicateUsername();
  await verifyDeveloperFirstLoginRecoveryIsDeveloperClassified();
  await verifyDeveloperFirstLoginPasswordIsDeveloperClassified();
  await verifyAdminFirstLoginIsNotDeveloperInvolved();
  await verifyFirstLoginAuditRetriesTransientFailure();
  await verifyFirstLoginAuditExhaustionKeepsMutation();
  await verifyFirstLoginAuditFailureIsInvisibleToCaller();
  await verifyBootstrapLifecycleIsNotSelectableThroughInput();
  await verifyBootstrappedDeveloperRoutesThroughPasswordThenRecovery();
  await verifyFailedDeveloperAuthenticationIsAudited();
  await verifyFailedAdminAuthenticationIsAudited();
  await verifyUnknownUsernameAuthenticationFailureIsAudited();
  await verifyInactiveAccountAuthenticationFailureIsAudited();
  await verifyFailedAuthenticationAuditFailureIsSwallowedWithoutRetry();
  await verifySuccessfulAuthenticationEmitsNoFailureEvent();
  await verifySuccessfulDeveloperAuthenticationIsAudited();
  await verifySuccessfulOrdinaryAuthenticationIsAudited();
  await verifySuccessfulAuthenticationAuditFailureIsSwallowedWithoutRetry();
  await verifyFailedAuthenticationEmitsNoSuccessEvent();
  await verifySuccessfulDeveloperPasswordChangeIsAudited();
  await verifySuccessfulOrdinaryPasswordChangeIsAudited();
  await verifyWrongCurrentPasswordLeavesCredentialUnchanged();
  await verifySuccessfulPasswordChangeAuditFailureIsSwallowed();
  await verifyFailedPasswordChangeAuditFailureIsSwallowed();
  await verifyStalePasswordChangeStateIsRejected();
  await verifyFailedPasswordChangeAuditSurvivesRecordFailure();
  await verifyAdminResetsOrdinaryPassword();
  await verifyDeveloperResetsOrdinaryPassword();
  await verifyUserCannotResetOrdinaryPassword();
  await verifyOrdinaryResetRejectsDeveloperTarget();
  await verifyUpdateUserIgnoresPasswordLikeField();
  await verifyDeveloperLogoutUsesPersistedIdentity();
  await verifyOrdinaryLogoutUsesPersistedRole();
  await verifyNullSessionEmitsNoLogout();
  await verifyMissingLogoutAccountEmitsNothing();
  await verifyLogoutAuditFailureIsSwallowedWithoutRetry();
  await verifyLogoutAccountLookupFailureIsSwallowed();
  verifyAuthActionsExportsOnlyApprovedSurface();
  process.stdout.write("Developer boundary verification passed: all 76 cases verified.\n");
}

void main();
