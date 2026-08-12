import type {
  AuthAttemptQuery,
  AuthAttemptRecord,
  AuthCredentialRecord,
  AuthRole,
  AuthStatus,
  ICredentialRepository,
  ILoginAttemptRepository,
} from "@/repositories/interfaces";
import {
  AccountOwnsReportsError,
  LastActiveAdminError,
  SelfDeactivationError,
  SelfDeletionError,
  UserService,
} from "@/services/userService";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Admin invariant verification failed: ${message}`);
}

class FakeCredentialRepository implements ICredentialRepository {
  private readonly records: Map<string, AuthCredentialRecord>;
  deleteFailure: unknown;

  constructor(records: AuthCredentialRecord[]) {
    this.records = new Map(records.map((record) => [record.id, { ...record }]));
  }

  async findById(id: string): Promise<AuthCredentialRecord | null> {
    const record = this.records.get(id);
    return record ? { ...record } : null;
  }

  async findByUsername(username: string): Promise<AuthCredentialRecord | null> {
    const record = [...this.records.values()].find((candidate) => candidate.username === username);
    return record ? { ...record } : null;
  }

  async findAll(): Promise<AuthCredentialRecord[]> {
    return [...this.records.values()].map((record) => ({ ...record }));
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

  async delete(id: string): Promise<void> {
    if (this.deleteFailure !== undefined) throw this.deleteFailure;
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
const ADMIN_B = "admin-b";
const DISTINCT_ACTOR = "actor-d";
const TIMESTAMP = "2026-08-12T00:00:00.000Z";

function credential(
  id: string,
  role: AuthRole = "Admin",
  status: AuthStatus = "Active"
): AuthCredentialRecord {
  return {
    id,
    username: id,
    role,
    status,
    passwordHash: "placeholder-not-a-hash",
    securityQuestion: "Placeholder verification question",
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

async function verifyDeletingOneOfTwoActiveAdmins(): Promise<void> {
  const { credentials, service } = createSubject([
    credential(ADMIN_A),
    credential(ADMIN_B),
  ]);
  await service.deleteUser(ADMIN_B, ADMIN_A);
  assert((await credentials.findById(ADMIN_B)) === null, "case 1 must remove Admin B");
}

async function verifyDeactivatingOneOfTwoActiveAdmins(): Promise<void> {
  const { credentials, service } = createSubject([
    credential(ADMIN_A),
    credential(ADMIN_B),
  ]);
  await service.updateUser(ADMIN_B, { status: "Inactive" }, ADMIN_A);
  assert(
    (await credentials.findById(ADMIN_B))?.status === "Inactive",
    "case 2 must make Admin B Inactive"
  );
}

async function verifyReactivatingAnAdmin(): Promise<void> {
  const { credentials, service } = createSubject([
    credential(ADMIN_A),
    credential(ADMIN_B, "Admin", "Inactive"),
  ]);
  await service.updateUser(ADMIN_B, { status: "Active" }, ADMIN_A);
  assert(
    (await credentials.findById(ADMIN_B))?.status === "Active",
    "case 3 must make Admin B Active"
  );
}

async function verifyDeletingLastActiveAdminFails(): Promise<void> {
  const { credentials, service } = createSubject([credential(ADMIN_A)]);
  const error = await captureError(() => service.deleteUser(ADMIN_A, DISTINCT_ACTOR));
  assert(error instanceof LastActiveAdminError, "case 4 must throw LastActiveAdminError");
  assert(await credentials.findById(ADMIN_A), "case 4 must retain Admin A");
}

async function verifyDeactivatingLastActiveAdminFails(): Promise<void> {
  const { credentials, service } = createSubject([credential(ADMIN_A)]);
  const error = await captureError(() =>
    service.updateUser(ADMIN_A, { status: "Inactive" }, DISTINCT_ACTOR)
  );
  assert(error instanceof LastActiveAdminError, "case 5 must throw LastActiveAdminError");
  assert(
    (await credentials.findById(ADMIN_A))?.status === "Active",
    "case 5 must leave Admin A Active"
  );
}

async function verifyDemotingLastActiveAdminFails(): Promise<void> {
  const { credentials, service } = createSubject([credential(ADMIN_A)]);
  const error = await captureError(() =>
    service.updateUser(ADMIN_A, { role: "User" }, DISTINCT_ACTOR)
  );
  assert(error instanceof LastActiveAdminError, "case 6 must throw LastActiveAdminError");
  assert(
    (await credentials.findById(ADMIN_A))?.role === "Admin",
    "case 6 must leave Admin A in the Admin role"
  );
}

async function verifySelfDeactivationFails(): Promise<void> {
  const { credentials, service } = createSubject([credential(ADMIN_A)]);
  const error = await captureError(() =>
    service.updateUser(ADMIN_A, { status: "Inactive" }, ADMIN_A)
  );
  assert(error instanceof SelfDeactivationError, "case 7 must throw SelfDeactivationError");
  assert(
    (await credentials.findById(ADMIN_A))?.status === "Active",
    "case 7 must leave Admin A Active"
  );
}

async function verifySelfDeletionPrecedence(): Promise<void> {
  const arrangements = [
    { name: "sole-Admin", records: [credential(ADMIN_A)] },
    { name: "non-sole-Admin", records: [credential(ADMIN_A), credential(ADMIN_B)] },
  ];

  for (const arrangement of arrangements) {
    const { credentials, service } = createSubject(arrangement.records);
    const error = await captureError(() => service.deleteUser(ADMIN_A, ADMIN_A));
    assert(
      error instanceof SelfDeletionError,
      `case 8 ${arrangement.name} arrangement must throw SelfDeletionError`
    );
    assert(
      !(error instanceof LastActiveAdminError),
      `case 8 ${arrangement.name} arrangement must prefer SelfDeletionError`
    );
    assert(
      await credentials.findById(ADMIN_A),
      `case 8 ${arrangement.name} arrangement must retain Admin A`
    );
  }
}

async function verifyForeignKeyFailureTranslation(): Promise<void> {
  const { credentials, service } = createSubject([
    credential(ADMIN_A),
    credential(ADMIN_B),
  ]);
  const rawFailure = { code: "23503" };
  credentials.deleteFailure = rawFailure;
  const error = await captureError(() => service.deleteUser(ADMIN_B, ADMIN_A));
  assert(error instanceof AccountOwnsReportsError, "case 9 must throw AccountOwnsReportsError");
  assert(!Object.is(error, rawFailure), "case 9 must not expose the raw foreign-key failure");
  assert(await credentials.findById(ADMIN_B), "case 9 must retain Admin B");
}

async function verifyInactiveAdminDoesNotSatisfyInvariant(): Promise<void> {
  const { credentials, service } = createSubject([
    credential(ADMIN_A),
    credential(ADMIN_B, "Admin", "Inactive"),
  ]);
  const error = await captureError(() => service.deleteUser(ADMIN_A, DISTINCT_ACTOR));
  assert(error instanceof LastActiveAdminError, "case 10 must throw LastActiveAdminError");
  assert(await credentials.findById(ADMIN_A), "case 10 must retain Admin A");
}

async function verifyDemotingInactiveAdminSucceeds(): Promise<void> {
  const { credentials, service } = createSubject([
    credential(ADMIN_A),
    credential(ADMIN_B, "Admin", "Inactive"),
  ]);
  await service.updateUser(ADMIN_B, { role: "User" }, ADMIN_A);
  const adminB = await credentials.findById(ADMIN_B);
  assert(adminB?.role === "User", "case 11 must change Admin B to the User role");
  assert(adminB.status === "Inactive", "case 11 must leave Admin B Inactive");
}

async function verifyTogglePathInheritsGuards(): Promise<void> {
  const { credentials, service } = createSubject([
    credential(ADMIN_A),
    credential(ADMIN_B),
  ]);
  await service.toggleUserStatus(ADMIN_B, ADMIN_A);
  assert(
    (await credentials.findById(ADMIN_B))?.status === "Inactive",
    "case 12 must first make Admin B Inactive"
  );

  const error = await captureError(() => service.toggleUserStatus(ADMIN_A, ADMIN_A));
  assert(error instanceof SelfDeactivationError, "case 12 must throw SelfDeactivationError");
  assert(
    (await credentials.findById(ADMIN_A))?.status === "Active",
    "case 12 must leave Admin A Active"
  );
}

async function main(): Promise<void> {
  await verifyDeletingOneOfTwoActiveAdmins();
  await verifyDeactivatingOneOfTwoActiveAdmins();
  await verifyReactivatingAnAdmin();
  await verifyDeletingLastActiveAdminFails();
  await verifyDeactivatingLastActiveAdminFails();
  await verifyDemotingLastActiveAdminFails();
  await verifySelfDeactivationFails();
  await verifySelfDeletionPrecedence();
  await verifyForeignKeyFailureTranslation();
  await verifyInactiveAdminDoesNotSatisfyInvariant();
  await verifyDemotingInactiveAdminSucceeds();
  await verifyTogglePathInheritsGuards();
  process.stdout.write("Admin invariant verification passed: all 12 cases verified.\n");
}

void main();
