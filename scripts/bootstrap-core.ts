import type {
  IAuditLogQueryRepository,
  ICredentialDirectoryRepository,
} from "../src/repositories/interfaces";
import { canonicalizeAndValidateUsername } from "../src/lib/username";
import type { AuditEvent } from "../src/services/audit-service";
import { DuplicateUsernameError } from "../src/services/userService";
import type { CreateDeveloperAccountInput, User } from "../src/types/user";

export const BOOTSTRAP_EVENT_TYPE = "InitialDeveloperBootstrapExecuted";

export class BootstrapRefusedError extends Error {}

export type BootstrapDependencies = {
  userService: {
    bootstrapFirstDeveloper(input: CreateDeveloperAccountInput): Promise<User>;
  };
  credentialDirectory: Pick<ICredentialDirectoryRepository, "findVisibleTo">;
  auditLogs: IAuditLogQueryRepository;
  auditService: { emit(event: AuditEvent): Promise<void> };
  sleep?: (milliseconds: number) => Promise<void>;
};

export type BootstrapOutcome =
  | { status: "created"; userId: string; username: string }
  | {
      status: "created-audit-failed";
      userId: string;
      username: string;
      attempts: number;
    };

export type RepairOutcome = { status: "repaired"; userId: string; username: string };

const RETRY_DELAYS_MS = [250, 1000];
const AUDIT_PAGE_SIZE = 100;
const MAX_AUDIT_ROWS_SCANNED = 1000;

class AuditEmitRetryError extends Error {
  constructor(public readonly attempts: number) {
    super(`Bootstrap audit emission failed after ${attempts} attempts.`);
    this.name = "AuditEmitRetryError";
  }
}

function fail(message: string): never {
  throw new BootstrapRefusedError(`Developer bootstrap refused: ${message}`);
}

function bootstrapEvent(user: Pick<User, "id" | "username" | "status">): AuditEvent {
  return {
    category: "AuthAccount",
    eventType: BOOTSTRAP_EVENT_TYPE,
    actorRole: null,
    targetRole: "Developer",
    performedByUserId: null,
    performedByUsername: null,
    targetReference: user.username,
    details: { targetUserId: user.id, status: user.status, bootstrap: true },
  };
}

async function emitWithRetry(
  deps: BootstrapDependencies,
  event: AuditEvent
): Promise<number> {
  const sleep =
    deps.sleep ??
    ((milliseconds: number) =>
      new Promise<void>((resolve) => {
        setTimeout(resolve, milliseconds);
      }));

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      await deps.auditService.emit(event);
      return attempt + 1;
    } catch {
      if (attempt === RETRY_DELAYS_MS.length) {
        throw new AuditEmitRetryError(attempt + 1);
      }
      await sleep(RETRY_DELAYS_MS[attempt]);
    }
  }

  throw new AuditEmitRetryError(RETRY_DELAYS_MS.length + 1);
}

export async function runBootstrap(
  deps: BootstrapDependencies,
  input: CreateDeveloperAccountInput
): Promise<BootstrapOutcome> {
  if (!canonicalizeAndValidateUsername(input.username)) {
    fail(
      "the username does not match the canonical username rule: use 3-50 characters of " +
        "lowercase a-z, 0-9, and the separators . _ - , beginning and ending with a letter " +
        "or digit, with no consecutive separators"
    );
  }

  let user: User;
  try {
    user = await deps.userService.bootstrapFirstDeveloper(input);
  } catch (error) {
    if (error instanceof DuplicateUsernameError) {
      fail("the requested username is already in use by another account");
    }
    throw error;
  }

  try {
    await emitWithRetry(deps, bootstrapEvent(user));
  } catch (error) {
    if (!(error instanceof AuditEmitRetryError)) throw error;
    return {
      status: "created-audit-failed",
      userId: user.id,
      username: user.username,
      attempts: error.attempts,
    };
  }

  return { status: "created", userId: user.id, username: user.username };
}

export async function runBootstrapAuditRepair(
  deps: BootstrapDependencies,
  username: string
): Promise<RepairOutcome> {
  const developers = await deps.credentialDirectory.findVisibleTo(["Developer"]);
  if (developers.length !== 1) {
    fail(`expected exactly one Developer account but found ${developers.length}`);
  }

  const developer = developers[0];
  if (developer.username !== username) {
    fail("the repair username does not match the only Developer account");
  }

  const total = await deps.auditLogs.count({
    eventType: BOOTSTRAP_EVENT_TYPE,
    limit: 1,
    offset: 0,
  });
  if (total > MAX_AUDIT_ROWS_SCANNED) {
    fail(
      `cannot prove the bootstrap audit event is absent because ${total} rows exceed the scan limit`
    );
  }

  for (let offset = 0; offset < total; offset += AUDIT_PAGE_SIZE) {
    const rows = await deps.auditLogs.query({
      eventType: BOOTSTRAP_EVENT_TYPE,
      limit: AUDIT_PAGE_SIZE,
      offset,
    });
    if (
      rows.some(
        (row) =>
          row.details?.targetUserId === developer.id ||
          row.targetReference === developer.username
      )
    ) {
      fail("the bootstrap audit event already exists for the only Developer account");
    }
  }

  await emitWithRetry(deps, bootstrapEvent(developer));
  return {
    status: "repaired",
    userId: developer.id,
    username: developer.username,
  };
}
