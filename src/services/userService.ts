import "server-only";

import { randomUUID } from "node:crypto";
import type {
  AuthCredentialRecord,
  ICredentialRepository,
  ILoginAttemptRepository,
} from "@/repositories/interfaces";
import { CreateUserInput, UpdateUserInput, User } from "@/types/user";
import { canonicalizeAndValidateUsername, canonicalizeUsername } from "@/lib/username";
import {
  hashPassword,
  hashSecurityAnswer,
  normalizeSecurityAnswer,
  verifyPassword,
  verifySecurityAnswer,
} from "@/lib/password";
import { LoginRateLimiter } from "@/lib/login-rate-limit";
import {
  RecoveryRateLimitError,
  RecoveryRateLimiter,
} from "@/lib/recovery-rate-limit";
import { AuditService } from "@/services/audit-service";
import {
  CUSTOM_SECURITY_QUESTION,
  PREDEFINED_SECURITY_QUESTIONS,
  resolveSecurityQuestion,
} from "@/config/security-questions";

export class DuplicateUsernameError extends Error {
  constructor(public username: string) {
    super(`Username "${username}" is already in use by another account.`);
    this.name = "DuplicateUsernameError";
  }
}

export class UserNotFoundError extends Error {
  constructor(public userId: string) {
    super(`User with ID "${userId}" was not found.`);
    this.name = "UserNotFoundError";
  }
}

export class LastActiveAdminError extends Error {
  constructor() {
    super("At least one Active Admin account must remain.");
    this.name = "LastActiveAdminError";
  }
}

export class SelfDeactivationError extends Error {
  constructor() {
    super("You cannot deactivate the currently authenticated account.");
    this.name = "SelfDeactivationError";
  }
}

export class SelfDeletionError extends Error {
  constructor() {
    super("You cannot delete the currently authenticated account.");
    this.name = "SelfDeletionError";
  }
}

export class AccountOwnsReportsError extends Error {
  constructor() {
    super("This account owns report sessions and cannot be deleted.");
    this.name = "AccountOwnsReportsError";
  }
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super("Invalid username or password");
    this.name = "InvalidCredentialsError";
  }
}

export class RecoveryResetConflictError extends Error {
  constructor() {
    super("The password recovery state is no longer valid.");
    this.name = "RecoveryResetConflictError";
  }
}

export type RecoveryChallengeResult =
  | {
      eligible: true;
      userId: string;
      username: string;
      securityQuestion: string;
      tokenVersion: number;
    }
  | { eligible: false };

export type RecoveryAnswerResult =
  | { verified: true; userId: string; tokenVersion: number }
  | { verified: false };

export type RecoveryPasswordResetResult = {
  userId: string;
  tokenVersion: number;
};

export interface IUserService {
  getUsers(): Promise<User[]>;
  getUserById(id: string): Promise<User | null>;
  getSecurityQuestionForUser(id: string): Promise<string | null>;
  createUser(input: CreateUserInput): Promise<User>;
  updateUser(id: string, input: UpdateUserInput, currentUserId?: string): Promise<User>;
  toggleUserStatus(id: string, currentUserId?: string): Promise<User>;
  deleteUser(id: string, currentUserId?: string): Promise<void>;
  authenticate(username: string, password: string, clientIp?: string | null): Promise<User>;
  changeFirstLoginPassword(id: string, password: string): Promise<User>;
  setFirstLoginRecoveryAnswer(id: string, answer: string): Promise<User>;
  getRecoveryChallenge(username: string, clientIp: string): Promise<RecoveryChallengeResult>;
  verifyRecoveryAnswer(
    username: string,
    answer: string,
    clientIp: string
  ): Promise<RecoveryAnswerResult>;
  resetPasswordAfterRecovery(
    userId: string,
    expectedTokenVersion: number,
    newPassword: string
  ): Promise<RecoveryPasswordResetResult>;
}

function toUser(record: AuthCredentialRecord): User {
  const {
    passwordHash: _passwordHash,
    securityAnswerHash: _securityAnswerHash,
    securityQuestion: _securityQuestion,
    ...user
  } = record;
  return user;
}

function validatedSecurityQuestion(input: CreateUserInput): string {
  const selected = input.securityQuestion;
  if (
    selected !== CUSTOM_SECURITY_QUESTION &&
    !PREDEFINED_SECURITY_QUESTIONS.includes(
      selected as (typeof PREDEFINED_SECURITY_QUESTIONS)[number]
    )
  ) {
    throw new Error("A valid security question is required.");
  }
  const question = resolveSecurityQuestion(
    selected as Parameters<typeof resolveSecurityQuestion>[0],
    input.customSecurityQuestion
  );
  if (!question) throw new Error("A custom security question is required.");
  return question;
}

export class UserService implements IUserService {
  private readonly loginRateLimiter: LoginRateLimiter;
  private readonly recoveryRateLimiter: RecoveryRateLimiter;

  constructor(
    private readonly credentials: ICredentialRepository,
    attempts: ILoginAttemptRepository,
    private readonly auditService?: AuditService
  ) {
    this.loginRateLimiter = new LoginRateLimiter(attempts);
    this.recoveryRateLimiter = new RecoveryRateLimiter(attempts);
  }

  private get recoveryAudit(): AuditService {
    if (!this.auditService) {
      throw new Error("Persistent recovery audit service is not configured.");
    }
    return this.auditService;
  }

  private async countOtherActiveAdmins(userId: string): Promise<number> {
    const users = await this.credentials.findAll();
    return users.filter(
      (user) => user.id !== userId && user.role === "Admin" && user.status === "Active"
    ).length;
  }

  async getUsers(): Promise<User[]> {
    return (await this.credentials.findAll()).map(toUser);
  }

  async getUserById(id: string): Promise<User | null> {
    const record = await this.credentials.findById(id);
    return record ? toUser(record) : null;
  }

  async getSecurityQuestionForUser(id: string): Promise<string | null> {
    const record = await this.credentials.findById(id);
    return record?.securityQuestion ?? null;
  }

  async createUser(input: CreateUserInput): Promise<User> {
    const username = canonicalizeAndValidateUsername(input.username);
    if (!username) throw new Error("Username does not match the canonical username rule.");
    if (await this.credentials.findByUsername(username)) throw new DuplicateUsernameError(username);

    const now = new Date().toISOString();
    const record: AuthCredentialRecord = {
      id: randomUUID(),
      username,
      role: input.role,
      status: "Active",
      passwordHash: await hashPassword(input.password),
      securityQuestion: validatedSecurityQuestion(input),
      securityAnswerHash: null,
      mustChangePassword: false,
      mustSetRecovery: true,
      tokenVersion: 1,
      passwordUpdatedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    try {
      return toUser(await this.credentials.create(record));
    } catch (error) {
      if (await this.credentials.findByUsername(username)) throw new DuplicateUsernameError(username);
      throw error;
    }
  }

  async updateUser(
    id: string,
    input: UpdateUserInput,
    currentUserId?: string
  ): Promise<User> {
    const current = await this.credentials.findById(id);
    if (!current) throw new UserNotFoundError(id);

    if (currentUserId === id && input.status === "Inactive") {
      throw new SelfDeactivationError();
    }

    const removesActiveAdmin =
      current.role === "Admin" &&
      current.status === "Active" &&
      (input.status === "Inactive" ||
        (input.role !== undefined && input.role !== "Admin"));
    if (removesActiveAdmin && (await this.countOtherActiveAdmins(id)) === 0) {
      throw new LastActiveAdminError();
    }

    const updates: Partial<Omit<AuthCredentialRecord, "id" | "createdAt">> = {
      updatedAt: new Date().toISOString(),
    };
    if (input.username !== undefined) {
      const username = canonicalizeAndValidateUsername(input.username);
      if (!username) throw new Error("Username does not match the canonical username rule.");
      const duplicate = await this.credentials.findByUsername(username);
      if (duplicate && duplicate.id !== id) throw new DuplicateUsernameError(username);
      updates.username = username;
    }
    if (input.role !== undefined) updates.role = input.role;
    if (input.status !== undefined) updates.status = input.status;
    if (input.password) {
      updates.passwordHash = await hashPassword(input.password);
      updates.passwordUpdatedAt = new Date().toISOString();
      updates.tokenVersion = current.tokenVersion + 1;
    }

    return toUser(await this.credentials.update(id, updates));
  }

  async toggleUserStatus(id: string, currentUserId?: string): Promise<User> {
    const user = await this.credentials.findById(id);
    if (!user) throw new UserNotFoundError(id);
    return this.updateUser(
      id,
      { status: user.status === "Active" ? "Inactive" : "Active" },
      currentUserId
    );
  }

  async deleteUser(id: string, currentUserId?: string): Promise<void> {
    if (currentUserId === id) throw new SelfDeletionError();
    const target = await this.credentials.findById(id);
    if (!target) throw new UserNotFoundError(id);
    if (
      target.role === "Admin" &&
      target.status === "Active" &&
      (await this.countOtherActiveAdmins(id)) === 0
    ) {
      throw new LastActiveAdminError();
    }

    try {
      await this.credentials.delete(id);
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "23503"
      ) {
        throw new AccountOwnsReportsError();
      }
      throw error;
    }
  }

  async authenticate(usernameInput: string, password: string, clientIp: string | null = null): Promise<User> {
    const username = canonicalizeUsername(usernameInput);
    await this.loginRateLimiter.assertAllowed(username, clientIp);

    const record = await this.credentials.findByUsername(username);
    const authenticated = Boolean(
      record && record.status === "Active" && (await verifyPassword(password, record.passwordHash))
    );
    await this.loginRateLimiter.record(username, clientIp, authenticated);
    if (!record || !authenticated) throw new InvalidCredentialsError();
    return toUser(record);
  }

  async changeFirstLoginPassword(id: string, password: string): Promise<User> {
    const current = await this.credentials.findById(id);
    if (!current) throw new UserNotFoundError(id);
    const now = new Date().toISOString();
    return toUser(
      await this.credentials.update(id, {
        passwordHash: await hashPassword(password),
        mustChangePassword: false,
        tokenVersion: current.tokenVersion + 1,
        passwordUpdatedAt: now,
        updatedAt: now,
      })
    );
  }

  async setFirstLoginRecoveryAnswer(id: string, answer: string): Promise<User> {
    const current = await this.credentials.findById(id);
    if (!current) throw new UserNotFoundError(id);
    return toUser(
      await this.credentials.update(id, {
        securityAnswerHash: await hashSecurityAnswer(answer),
        mustSetRecovery: false,
        tokenVersion: current.tokenVersion + 1,
        updatedAt: new Date().toISOString(),
      })
    );
  }

  async getRecoveryChallenge(
    usernameInput: string,
    clientIp: string
  ): Promise<RecoveryChallengeResult> {
    const username = canonicalizeUsername(usernameInput);
    let attemptCounts: { ipAttemptCount: number; usernameAttemptCount: number };

    try {
      attemptCounts = await this.recoveryRateLimiter.assertLookupAllowed(username, clientIp);
    } catch (error) {
      if (!(error instanceof RecoveryRateLimitError)) throw error;
      await this.recoveryRateLimiter.recordLookup(username, clientIp, false);
      await this.recoveryAudit.emit({
        eventType: "RecoveryLookupAttempted",
        targetReference: username,
        details: {
          outcome: "not_eligible",
          reasonCode: "recovery_lookup_throttled",
          clientIp,
          ipAttemptCount: error.attemptCount + 1,
        },
      });
      await this.recoveryAudit.emit({
        eventType: "RecoveryLookupThrottled",
        targetReference: username,
        details: {
          outcome: "throttled",
          reasonCode: "recovery_lookup_ip_limit",
          clientIp,
          ipAttemptCount: error.attemptCount + 1,
        },
      });
      return { eligible: false };
    }

    const record = await this.credentials.findByUsername(username);
    const reasonCode = !record
      ? "unknown_username"
      : record.status !== "Active"
        ? "account_inactive"
        : record.securityAnswerHash === null
          ? "recovery_not_configured"
          : "eligible";
    const eligible = Boolean(
      record && record.status === "Active" && record.securityAnswerHash !== null
    );

    await this.recoveryRateLimiter.recordLookup(username, clientIp, eligible);
    await this.recoveryAudit.emit({
      eventType: "RecoveryLookupAttempted",
      targetReference: username,
      details: {
        outcome: eligible ? "eligible" : "not_eligible",
        reasonCode,
        clientIp,
        ipAttemptCount: attemptCounts.ipAttemptCount + 1,
        usernameAttemptCount: attemptCounts.usernameAttemptCount + 1,
      },
    });

    if (!record || !eligible) return { eligible: false };
    return {
      eligible: true,
      userId: record.id,
      username: record.username,
      securityQuestion: record.securityQuestion,
      tokenVersion: record.tokenVersion,
    };
  }

  async verifyRecoveryAnswer(
    usernameInput: string,
    answer: string,
    clientIp: string
  ): Promise<RecoveryAnswerResult> {
    const username = canonicalizeUsername(usernameInput);
    try {
      await this.recoveryRateLimiter.assertAnswerAllowed(username, clientIp);
    } catch (error) {
      if (!(error instanceof RecoveryRateLimitError)) throw error;
      await this.recoveryAudit.emit({
        eventType: "RecoveryAnswerFailed",
        targetReference: username,
        details: {
          outcome: "throttled",
          reasonCode: "recovery_answer_rate_limited",
          clientIp,
          attemptCount: error.attemptCount,
        },
      });
      throw error;
    }

    const record = await this.credentials.findByUsername(username);
    const normalizedAnswer = normalizeSecurityAnswer(answer);
    const verified = Boolean(
      record &&
        record.status === "Active" &&
        record.securityAnswerHash !== null &&
        (await verifySecurityAnswer(normalizedAnswer, record.securityAnswerHash))
    );
    await this.recoveryRateLimiter.recordAnswer(username, clientIp, verified);

    if (!record || !verified) {
      const reasonCode = !record
        ? "unknown_username"
        : record.status !== "Active"
          ? "account_inactive"
          : record.securityAnswerHash === null
            ? "recovery_not_configured"
            : "recovery_answer_mismatch";
      await this.recoveryAudit.emit({
        eventType: "RecoveryAnswerFailed",
        targetReference: username,
        details: {
          outcome: "not_verified",
          reasonCode,
          clientIp,
        },
      });
      return { verified: false };
    }

    await this.recoveryAudit.emit({
      eventType: "RecoveryAnswerVerified",
      targetReference: record.username,
      details: {
        outcome: "verified",
        reasonCode: "recovery_answer_verified",
        clientIp,
        tokenVersion: record.tokenVersion,
      },
    });
    return {
      verified: true,
      userId: record.id,
      tokenVersion: record.tokenVersion,
    };
  }

  async resetPasswordAfterRecovery(
    userId: string,
    expectedTokenVersion: number,
    newPassword: string
  ): Promise<RecoveryPasswordResetResult> {
    const current = await this.credentials.findById(userId);
    if (!current) throw new RecoveryResetConflictError();

    try {
      await this.recoveryRateLimiter.assertPasswordResetAllowed(current.username);
    } catch (error) {
      if (error instanceof RecoveryRateLimitError) {
        await this.recoveryRateLimiter.recordPasswordReset(current.username, false);
      }
      throw error;
    }

    let succeeded = false;
    try {
      const now = new Date().toISOString();
      const updated = await this.credentials.updateIfTokenVersion(
        userId,
        expectedTokenVersion,
        {
          passwordHash: await hashPassword(newPassword),
          tokenVersion: expectedTokenVersion + 1,
          passwordUpdatedAt: now,
          updatedAt: now,
        }
      );
      if (!updated) throw new RecoveryResetConflictError();
      succeeded = true;

      await this.recoveryAudit.emit({
        eventType: "RecoveryPasswordResetCompleted",
        targetReference: updated.username,
        details: {
          outcome: "completed",
          reasonCode: "recovery_password_reset_completed",
          previousTokenVersion: expectedTokenVersion,
          newTokenVersion: updated.tokenVersion,
        },
      });
      return { userId: updated.id, tokenVersion: updated.tokenVersion };
    } finally {
      await this.recoveryRateLimiter.recordPasswordReset(current.username, succeeded);
    }
  }
}
