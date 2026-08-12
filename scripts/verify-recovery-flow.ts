import { readFileSync } from "node:fs";
import path from "node:path";
import { hashSecurityAnswer } from "@/lib/password";
import { LoginRateLimiter } from "@/lib/login-rate-limit";
import {
  RECOVERY_RATE_LIMIT_POLICY,
  RecoveryRateLimitError,
  RecoveryRateLimiter,
} from "@/lib/recovery-rate-limit";
import { decryptSessionToken, encryptSessionToken } from "@/lib/session-codec";
import type {
  AuditLogEntry,
  AuthAttemptQuery,
  AuthAttemptRecord,
  AuthCredentialRecord,
  IAuditLogRepository,
  ICredentialRepository,
  ILoginAttemptRepository,
} from "@/repositories/interfaces";
import { AuditService } from "@/services/audit-service";
import {
  RecoveryResetConflictError,
  UserService,
} from "@/services/userService";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Recovery flow verification failed: ${message}`);
}

class FakeCredentialRepository implements ICredentialRepository {
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

  async create(record: AuthCredentialRecord): Promise<AuthCredentialRecord> {
    this.records.set(record.id, { ...record });
    return { ...record };
  }

  async update(
    id: string,
    updates: Partial<Omit<AuthCredentialRecord, "id" | "createdAt">>
  ): Promise<AuthCredentialRecord> {
    const current = this.records.get(id);
    if (!current) throw new Error(`Fake credential ${id} was not found.`);
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
    this.records.delete(id);
  }
}

class FakeLoginAttemptRepository implements ILoginAttemptRepository {
  readonly attempts: AuthAttemptRecord[] = [];
  readonly queries: AuthAttemptQuery[] = [];

  constructor(private readonly now: () => number) {}

  async record(attempt: AuthAttemptRecord): Promise<AuthAttemptRecord> {
    const recorded = {
      ...attempt,
      attemptedAt: new Date(this.now()).toISOString(),
    };
    this.attempts.push(recorded);
    return { ...recorded };
  }

  async findAttempts(query: AuthAttemptQuery): Promise<AuthAttemptRecord[]> {
    this.queries.push({ ...query });
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

class FakeAuditLogRepository implements IAuditLogRepository {
  readonly entries: AuditLogEntry[] = [];

  async append(entry: AuditLogEntry): Promise<void> {
    this.entries.push({
      ...entry,
      details: entry.details ? { ...entry.details } : null,
    });
  }
}

type Subject = {
  credentials: FakeCredentialRepository;
  attempts: FakeLoginAttemptRepository;
  audits: FakeAuditLogRepository;
  service: UserService;
};

const TIMESTAMP = "2026-08-12T00:00:00.000Z";

function credential(
  id: string,
  username: string,
  status: "Active" | "Inactive",
  answerHash: string | null
): AuthCredentialRecord {
  return {
    id,
    username,
    role: "User",
    status,
    passwordHash: "inert-placeholder",
    securityQuestion: "What is the verification phrase?",
    securityAnswerHash: answerHash,
    mustChangePassword: false,
    mustSetRecovery: answerHash === null,
    tokenVersion: 7,
    passwordUpdatedAt: TIMESTAMP,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  };
}

function createSubject(
  records: AuthCredentialRecord[],
  now: () => number
): Subject {
  const credentials = new FakeCredentialRepository(records);
  const attempts = new FakeLoginAttemptRepository(now);
  const audits = new FakeAuditLogRepository();
  const service = new UserService(
    credentials,
    attempts,
    new AuditService(audits)
  );
  return { credentials, attempts, audits, service };
}

async function captureError(operation: () => Promise<unknown>): Promise<unknown> {
  const sentinel = Symbol("no error");
  let caught: unknown = sentinel;
  try {
    await operation();
  } catch (error) {
    caught = error;
  }
  assert(caught !== sentinel, "the operation must throw");
  return caught;
}

function read(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n"
  );
}

function verifyRecoveryStateGuards(): void {
  const stateSource = read("src/lib/recovery-state.ts");
  const actionsSource = read("src/features/auth/forgotPasswordActions.ts");

  assert(
    /payload\.purpose\s*===\s*["']recovery["']/.test(stateSource),
    "wrong-purpose recovery state must be rejected structurally"
  );
  assert(
    /crypto\.subtle\.verify\s*\(/.test(stateSource) &&
      /if\s*\(\s*!validSignature\s*\)\s*return null/.test(stateSource),
    "forged recovery state must be rejected by signature verification"
  );
  assert(
    /expiresAt\s*>\s*now/.test(stateSource) &&
      /expiresAt\s*-\s*issuedAt\s*===\s*RECOVERY_STATE_TTL_MS/.test(stateSource),
    "expired or lifetime-altered recovery state must be rejected"
  );
  const resetAction = /export async function completeRecoveryResetAction[\s\S]*$/.exec(
    actionsSource
  )?.[0];
  assert(resetAction, "completeRecoveryResetAction must exist");
  assert(
    /state\.stage\s*!==\s*["']reset["'][\s\S]*rejectInvalidRecoveryState/.test(
      resetAction
    ),
    "reset must reject an answer-stage state"
  );
  assert(
    /rejectInvalidRecoveryState[\s\S]*clearRecoveryState/.test(actionsSource),
    "invalid recovery state must clear the recovery cookie"
  );
}

async function main(): Promise<void> {
  const clock = { now: Date.now() };
  const originalDateNow = Date.now;
  Date.now = () => clock.now;
  process.env.SESSION_SECRET = ["runtime", "recovery", "verification"].join("-");

  try {
    const correctAnswer = ["Blue", "Harbor"].join(" ");
    const answerHash = await hashSecurityAnswer(correctAnswer);
    const records = [
      credential("eligible-id", "eligible.user", "Active", answerHash),
      credential("inactive-id", "inactive.user", "Inactive", answerHash),
      credential("missing-id", "missing.answer", "Active", null),
    ];
    const subject = createSubject(records, () => clock.now);

    const eligible = await subject.service.getRecoveryChallenge(
      "  ELIGIBLE.USER  ",
      "198.51.100.1"
    );
    assert(eligible.eligible, "eligible lookup must return a challenge");
    assert(
      eligible.securityQuestion === "What is the verification phrase?",
      "eligible lookup must return only the configured question"
    );

    const correct = await subject.service.verifyRecoveryAnswer(
      "eligible.user",
      correctAnswer,
      "198.51.100.2"
    );
    assert(
      correct.verified && correct.userId === "eligible-id" && correct.tokenVersion === 7,
      "the correct normalized answer must return a structurally verified result"
    );

    for (const variant of ["  BLUE   HARBOR  ", "blue harbor"]) {
      const result = await subject.service.verifyRecoveryAnswer(
        "eligible.user",
        variant,
        "198.51.100.3"
      );
      assert(result.verified, "case and whitespace answer variants must verify");
    }

    for (const variant of ["Blue-Harbor", "Blué Harbor", "Wrong response"]) {
      const result = await subject.service.verifyRecoveryAnswer(
        "eligible.user",
        variant,
        "198.51.100.4"
      );
      assert(
        !result.verified && Object.keys(result).length === 1,
        "punctuation, diacritic, and wrong-answer variants must be structurally rejected"
      );
    }

    const unknown = await subject.service.getRecoveryChallenge(
      "unknown.user",
      "198.51.100.5"
    );
    const inactive = await subject.service.getRecoveryChallenge(
      "inactive.user",
      "198.51.100.6"
    );
    const missing = await subject.service.getRecoveryChallenge(
      "missing.answer",
      "198.51.100.7"
    );
    assert(!unknown.eligible, "an unknown username must be ineligible");
    assert(!inactive.eligible, "an Inactive account must be ineligible");
    assert(!missing.eligible, "an account without a recovery answer must be ineligible");
    assert(
      JSON.stringify(unknown) === JSON.stringify(inactive) &&
        JSON.stringify(inactive) === JSON.stringify(missing),
      "unknown, Inactive, and missing-answer results must be byte-identical"
    );
    assert(
      !JSON.stringify([unknown, inactive, missing]).includes("securityQuestion"),
      "ineligible results must not include a question"
    );

    const oldTokenVersion = eligible.tokenVersion;
    const priorSession = await encryptSessionToken({
      userId: eligible.userId,
      tokenVersion: oldTokenVersion,
      mustChangePassword: false,
      mustSetRecovery: false,
      rememberMe: false,
      expiresAt: new Date(clock.now + 60_000).toISOString(),
    });
    const resetValue = ["Runtime", "Reset", "42"].join("-");
    const reset = await subject.service.resetPasswordAfterRecovery(
      eligible.userId,
      oldTokenVersion,
      resetValue
    );
    assert(
      reset.tokenVersion === oldTokenVersion + 1,
      "a successful reset must increment token_version by exactly one"
    );
    const updated = await subject.credentials.findById(eligible.userId);
    assert(
      updated?.tokenVersion === oldTokenVersion + 1,
      "the credential repository must persist exactly one token-version increment"
    );

    const replayError = await captureError(() =>
      subject.service.resetPasswordAfterRecovery(
        eligible.userId,
        oldTokenVersion,
        resetValue
      )
    );
    assert(
      replayError instanceof RecoveryResetConflictError,
      "reusing a reset-stage token version must throw RecoveryResetConflictError"
    );

    const decodedPriorSession = await decryptSessionToken(priorSession);
    assert(decodedPriorSession, "the pre-reset session token must be cryptographically valid");
    assert(
      decodedPriorSession.tokenVersion !== updated.tokenVersion,
      "the pre-reset session token must fail the authoritative token-version guard"
    );
    assert(
      /user\.tokenVersion\s*!==\s*payload\.tokenVersion/.test(
        read("src/lib/session.ts")
      ),
      "the authoritative session reader must enforce the token-version guard"
    );

    const lockClock = { now: clock.now + 1_000_000 };
    const lockSubject = createSubject(
      [credential("lock-id", "lock.user", "Active", answerHash)],
      () => lockClock.now
    );
    const recoveryLimiter = new RecoveryRateLimiter(lockSubject.attempts);
    const cooldowns = [0, 0, 30_000, 60_000, 300_000, 900_000];
    for (let failureNumber = 1; failureNumber <= 6; failureNumber += 1) {
      clock.now = lockClock.now;
      const failed = await lockSubject.service.verifyRecoveryAnswer(
        "lock.user",
        "Incorrect response",
        "203.0.113.10"
      );
      assert(!failed.verified, `recovery failure ${failureNumber} must be rejected`);

      const expectedCooldown = cooldowns[failureNumber - 1];
      if (expectedCooldown === 0) {
        await recoveryLimiter.assertAnswerAllowed("lock.user", "203.0.113.10");
      } else {
        const error = await captureError(() =>
          recoveryLimiter.assertAnswerAllowed("lock.user", "203.0.113.10")
        );
        assert(
          error instanceof RecoveryRateLimitError &&
            error.retryAfterMs === expectedCooldown &&
            error.attemptCount === failureNumber,
          `failure ${failureNumber} must apply the frozen cooldown structurally`
        );
        if (failureNumber < 6) lockClock.now += expectedCooldown;
      }
    }
    assert(
      cooldowns[5] === RECOVERY_RATE_LIMIT_POLICY.answer.lockoutMs,
      "the sixth failure must apply the frozen lockout duration"
    );

    const recoveryQueryCount = lockSubject.attempts.queries.length;
    assert(
      lockSubject.attempts.queries.every(
        (query) => query.attemptKind === "RecoveryAnswer"
      ) &&
        lockSubject.attempts.attempts.every(
          (attempt) => attempt.attemptKind === "RecoveryAnswer"
        ),
      "recovery lockout logic must never query or record Login attempts"
    );
    await new LoginRateLimiter(lockSubject.attempts).assertAllowed(
      "lock.user",
      "203.0.113.10"
    );
    assert(
      lockSubject.attempts.queries
        .slice(recoveryQueryCount)
        .every((query) => query.attemptKind === "Login"),
      "normal login rate limiting must remain permitted after recovery lockout"
    );

    const lookupSubject = createSubject(
      [credential("lookup-id", "lookup.user", "Active", answerHash)],
      () => clock.now
    );
    const lookupIp = "192.0.2.20";
    for (
      let index = 0;
      index < RECOVERY_RATE_LIMIT_POLICY.lookup.maxAttemptsPerIp;
      index += 1
    ) {
      await lookupSubject.service.getRecoveryChallenge(`unknown-${index}`, lookupIp);
    }
    const throttled = await lookupSubject.service.getRecoveryChallenge(
      "lookup.user",
      lookupIp
    );
    assert(!throttled.eligible, "lookup per-IP throttling must return an ineligible result");
    assert(
      lookupSubject.audits.entries.some(
        (entry) => entry.eventType === "RecoveryLookupThrottled"
      ),
      "lookup per-IP throttling must append RecoveryLookupThrottled"
    );

    const repeatedSubject = createSubject(
      [credential("repeat-id", "repeat.user", "Active", answerHash)],
      () => clock.now
    );
    for (let index = 0; index < 25; index += 1) {
      const result = await repeatedSubject.service.getRecoveryChallenge(
        "repeat.user",
        `192.0.2.${index + 30}`
      );
      assert(result.eligible, "repeated username lookups across IPs must stay eligible");
    }
    const afterRepeatedLookups = await repeatedSubject.service.verifyRecoveryAnswer(
      "repeat.user",
      correctAnswer,
      "192.0.2.99"
    );
    assert(
      afterRepeatedLookups.verified,
      "repeated username lookups must not lock the account out of recovery"
    );

    const eventTypes = new Set([
      ...subject.audits.entries,
      ...lookupSubject.audits.entries,
    ].map((entry) => entry.eventType));
    for (const eventType of [
      "RecoveryLookupAttempted",
      "RecoveryLookupThrottled",
      "RecoveryAnswerFailed",
      "RecoveryAnswerVerified",
      "RecoveryPasswordResetCompleted",
    ]) {
      assert(eventTypes.has(eventType), `${eventType} must be appended to the audit repository`);
    }

    const prohibitedDetailKey = /pass(word)?|answer|hash|secret|token(?!Version)|cookie/i;
    const sensitiveValues = [correctAnswer, resetValue];
    for (const entry of [
      ...subject.audits.entries,
      ...lookupSubject.audits.entries,
      ...lockSubject.audits.entries,
    ]) {
      const details = entry.details ?? {};
      assert(
        Object.keys(details).every((key) => !prohibitedDetailKey.test(key)),
        "audit details must contain no credential-material key"
      );
      const serialized = JSON.stringify(details);
      assert(
        sensitiveValues.every((value) => !serialized.includes(value)),
        "audit details must contain no entered credential material"
      );
    }

    verifyRecoveryStateGuards();
    process.stdout.write(
      "Recovery flow verification passed: all frozen recovery, lockout, replay, session, and audit invariants verified.\n"
    );
  } finally {
    Date.now = originalDateNow;
  }
}

void main();
