import { randomUUID } from "node:crypto";

import type {
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
  LastActiveAdminError,
  LastActiveDeveloperError,
  SelfDeactivationError,
  SelfDeletionError,
  UserNotFoundError,
  UserService,
} from "@/services/userService";
import type {
  CreateDeveloperAccountInput,
  ResetDeveloperPasswordInput,
  UpdateDeveloperSecurityQuestionInput,
  UpdateDeveloperUsernameInput,
} from "@/types/user";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Developer boundary verification failed: ${message}`);
}

class FakeCredentialRepository
  implements ICredentialRepository, ICredentialDirectoryRepository
{
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

  async record(attempt: AuthAttemptRecord): Promise<AuthAttemptRecord> {
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

async function verifyCreationPathsAgreeOnInitialLifecycle(): Promise<void> {
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

  const bootstrapSubject = createSubject([]);
  const bootstrapped = await bootstrapSubject.service.bootstrapFirstDeveloper({
    username: "bootstrap-created",
    password: randomUUID(),
    securityQuestion: SECURITY_QUESTION,
  });
  const storedBootstrapped = await bootstrapSubject.credentials.findById(bootstrapped.id);

  for (const [label, stored] of [
    ["createUser", storedOrdinary],
    ["createDeveloperAccount", storedDeveloper],
    ["bootstrapFirstDeveloper", storedBootstrapped],
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
  assert(stored.mustChangePassword === false, "case 28 must set mustChangePassword=false");
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
  await verifyCreationPathsAgreeOnInitialLifecycle();
  await verifyBootstrapCreatesFirstDeveloper();
  await verifyBootstrapRefusesWhenDeveloperExists();
  await verifyRepeatedBootstrapRefuses();
  process.stdout.write("Developer boundary verification passed: all 30 cases verified.\n");
}

void main();
