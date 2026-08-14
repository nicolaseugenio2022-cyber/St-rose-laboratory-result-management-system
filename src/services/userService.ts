import "server-only";

import { randomUUID } from "node:crypto";
import type {
  AuthCredentialRecord,
  AuthRole,
  CredentialDirectorySummary,
  ICredentialDirectoryRepository,
  ICredentialRepository,
  ILoginAttemptRepository,
} from "@/repositories/interfaces";
import {
  CreateDeveloperAccountInput,
  CreateUserInput,
  ResetDeveloperPasswordInput,
  UpdateDeveloperSecurityQuestionInput,
  UpdateDeveloperUsernameInput,
  UpdateUserInput,
  User,
} from "@/types/user";
import {
  canonicalizeAndValidateUsername,
  canonicalizeUsername,
  MAX_USERNAME_LENGTH,
} from "@/lib/username";
import {
  hashPassword,
  hashSecurityAnswer,
  normalizeSecurityAnswer,
  verifyPassword,
  verifySecurityAnswer,
} from "@/lib/password";
import { LoginRateLimiter } from "@/lib/login-rate-limit";
import { PasswordChangeRateLimiter } from "@/lib/password-change-rate-limit";
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

const FIRST_LOGIN_AUDIT_RETRY_DELAYS_MS = [250, 1000];

type InitialAccountLifecycle = { mustChangePassword: boolean };

// An Admin-assigned password IS the account password, so ordinary creation never forces a change.
const ORDINARY_ACCOUNT_LIFECYCLE: InitialAccountLifecycle = { mustChangePassword: false };

// SECURITY_MODEL.md 6.5: the one-time operator bootstrap supplies a TEMPORARY credential that must
// not persist, so the first Developer must change it at first login. This override is deliberately
// a parameter of the private creation helper and never a field of any input type, so it cannot be
// selected through client, form, or caller-supplied account data.
const BOOTSTRAP_ACCOUNT_LIFECYCLE: InitialAccountLifecycle = { mustChangePassword: true };

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

export class LastActiveDeveloperError extends Error {
  constructor() {
    super("At least one Active Developer account must remain.");
    this.name = "LastActiveDeveloperError";
  }
}

export class DeveloperAlreadyExistsError extends Error {
  constructor() {
    super("A Developer account already exists; the one-time bootstrap is closed.");
    this.name = "DeveloperAlreadyExistsError";
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

export class PasswordChangeConflictError extends Error {
  constructor() {
    super("The password change state is no longer valid.");
    this.name = "PasswordChangeConflictError";
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
  getUsersVisibleTo(callerRole: AuthRole): Promise<User[]>;
  countUsersVisibleTo(callerRole: AuthRole): Promise<number>;
  getUserSummaryVisibleTo(callerRole: AuthRole): Promise<CredentialDirectorySummary>;
  getUserByIdVisibleTo(id: string, callerRole: AuthRole): Promise<User | null>;
  getDeveloperAccounts(callerRole: AuthRole): Promise<User[]>;
  bootstrapFirstDeveloper(input: CreateDeveloperAccountInput): Promise<User>;
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
  changeOwnPassword(
    id: string,
    currentPassword: string,
    newPassword: string,
    clientIp?: string | null
  ): Promise<User>;
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

type SecurityQuestionInput = Pick<
  CreateUserInput | CreateDeveloperAccountInput | UpdateDeveloperSecurityQuestionInput,
  "securityQuestion" | "customSecurityQuestion"
>;

function validatedSecurityQuestion(input: SecurityQuestionInput): string {
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

function visibleRolesFor(callerRole: AuthRole): AuthRole[] {
  return callerRole === "Developer"
    ? ["Admin", "User", "Developer"]
    : ["Admin", "User"];
}

export class UserService implements IUserService {
  private readonly loginRateLimiter: LoginRateLimiter;
  private readonly recoveryRateLimiter: RecoveryRateLimiter;
  private readonly passwordChangeRateLimiter: PasswordChangeRateLimiter;

  constructor(
    private readonly credentials: ICredentialRepository,
    attempts: ILoginAttemptRepository,
    private readonly auditService?: AuditService
  ) {
    this.loginRateLimiter = new LoginRateLimiter(attempts);
    this.recoveryRateLimiter = new RecoveryRateLimiter(attempts);
    this.passwordChangeRateLimiter = new PasswordChangeRateLimiter(attempts);
  }

  private get recoveryAudit(): AuditService {
    if (!this.auditService) {
      throw new Error("Persistent recovery audit service is not configured.");
    }
    return this.auditService;
  }

  private get credentialDirectory(): ICredentialDirectoryRepository {
    const directory = this.credentials as ICredentialRepository &
      Partial<ICredentialDirectoryRepository>;
    if (
      !directory.findVisibleTo ||
      !directory.countVisibleTo ||
      !directory.findByIdVisibleTo ||
      !directory.listDeveloperIdentities
    ) {
      throw new Error("Credential directory repository is not configured.");
    }
    return directory as ICredentialDirectoryRepository;
  }

  private assertDeveloperCaller(callerRole: AuthRole): void {
    if (callerRole !== "Developer") {
      throw new Error("Developer account management requires a Developer account.");
    }
  }

  private async emitPasswordChanged(account: AuthCredentialRecord): Promise<void> {
    try {
      await this.recoveryAudit.emit({
        category: "AuthAccount",
        eventType: "AccountPasswordChanged",
        actorRole: account.role,
        targetRole: account.role,
        performedByUserId: account.id,
        performedByUsername: account.username,
        targetReference: account.username,
        details: null,
      });
    } catch {
      console.error("Account security audit persistence failed.", {
        eventType: "AccountPasswordChanged",
      });
    }
  }

  private async emitPasswordChangeFailed(account: AuthCredentialRecord): Promise<void> {
    try {
      await this.recoveryAudit.emit({
        category: "AuthAccount",
        eventType: "AccountPasswordChangeFailed",
        actorRole: account.role,
        targetRole: account.role,
        performedByUserId: account.id,
        performedByUsername: account.username,
        targetReference: account.username,
        details: null,
      });
    } catch {
      console.error("Account security audit rejection persistence failed.", {
        eventType: "AccountPasswordChangeFailed",
      });
    }
  }

  private async emitAuthenticationSuccess(record: AuthCredentialRecord): Promise<void> {
    try {
      await this.recoveryAudit.emit({
        category: "AuthAccount",
        eventType: "AuthenticationSucceeded",
        actorRole: record.role,
        targetRole: record.role,
        performedByUserId: record.id,
        performedByUsername: record.username,
        targetReference: record.username,
        details: null,
      });
    } catch {
      console.error("Successful-authentication audit persistence failed.", {
        eventType: "AuthenticationSucceeded",
      });
    }
  }

  private async emitAuthenticationFailure(
    username: string,
    record: AuthCredentialRecord | null
  ): Promise<void> {
    let outcome: "unknown_username" | "inactive_account" | "invalid_password";
    if (!record) outcome = "unknown_username";
    else if (record.status !== "Active") outcome = "inactive_account";
    else outcome = "invalid_password";

    try {
      await this.recoveryAudit.emit({
        category: "AuthAccount",
        eventType: "AuthenticationFailed",
        actorRole: null,
        targetRole: record?.role ?? null,
        performedByUserId: null,
        performedByUsername: null,
        targetReference: username.slice(0, MAX_USERNAME_LENGTH),
        details: { outcome },
      });
    } catch {
      console.error("Failed-authentication audit persistence failed.", {
        eventType: "AuthenticationFailed",
        outcome,
      });
    }
  }

  private async emitFirstLoginSecurityEvent(
    eventType: "FirstLoginRecoveryConfigured" | "FirstLoginPasswordChanged",
    account: AuthCredentialRecord
  ): Promise<void> {
    for (let attempt = 0; attempt <= FIRST_LOGIN_AUDIT_RETRY_DELAYS_MS.length; attempt += 1) {
      try {
        await this.recoveryAudit.emit({
          category: "AuthAccount",
          eventType,
          actorRole: account.role,
          targetRole: account.role,
          performedByUserId: account.id,
          performedByUsername: account.username,
          targetReference: account.username,
          details: { targetUserId: account.id, selfService: true },
        });
        return;
      } catch {
        if (attempt === FIRST_LOGIN_AUDIT_RETRY_DELAYS_MS.length) {
          // The credential mutation is already authoritative and is never undone or repeated.
          // This must never rethrow: the caller in authActions.ts has a bare `catch` that would
          // report the completed security operation to the user as a failure. Log sanitized
          // operational metadata only — never the error, the audit payload, the username,
          // credential material, or any database detail.
          console.error(
            "First-login security audit persistence failed after bounded retries.",
            { userId: account.id, eventType, attempts: attempt + 1 }
          );
          return;
        }
        await new Promise<void>((resolve) => {
          setTimeout(resolve, FIRST_LOGIN_AUDIT_RETRY_DELAYS_MS[attempt]);
        });
      }
    }
  }

  private async findOrdinaryMutationTarget(id: string): Promise<AuthCredentialRecord> {
    const target = await this.credentials.findById(id);
    if (!target || target.role === "Developer") throw new UserNotFoundError(id);
    return target;
  }

  private async findDeveloperTarget(id: string): Promise<AuthCredentialRecord> {
    const target = await this.credentialDirectory.findByIdVisibleTo(id, ["Developer"]);
    if (!target) throw new UserNotFoundError(id);
    return target;
  }

  private async createAccount(
    input: CreateUserInput | (CreateDeveloperAccountInput & { role: "Developer" }),
    lifecycle: InitialAccountLifecycle = ORDINARY_ACCOUNT_LIFECYCLE
  ): Promise<User> {
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
      mustChangePassword: lifecycle.mustChangePassword,
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

  private async countOtherActiveAdmins(userId: string): Promise<number> {
    const users = await this.credentials.findAll();
    return users.filter(
      (user) => user.id !== userId && user.role === "Admin" && user.status === "Active"
    ).length;
  }

  async getUsers(): Promise<User[]> {
    return (await this.credentials.findAll()).map(toUser);
  }

  private async countOtherActiveDevelopers(userId: string): Promise<number> {
    const users = await this.credentials.findAll();
    return users.filter(
      (user) => user.id !== userId && user.role === "Developer" && user.status === "Active"
    ).length;
  }

  async getUsersVisibleTo(callerRole: AuthRole): Promise<User[]> {
    return (
      await this.credentialDirectory.findVisibleTo(visibleRolesFor(callerRole))
    ).map(toUser);
  }

  async countUsersVisibleTo(callerRole: AuthRole): Promise<number> {
    return this.credentialDirectory.countVisibleTo(visibleRolesFor(callerRole));
  }

  async getUserSummaryVisibleTo(callerRole: AuthRole): Promise<CredentialDirectorySummary> {
    const directory = this.credentialDirectory;
    if (!directory.summarizeVisibleTo) {
      throw new Error("Credential directory summary repository is not configured.");
    }
    return directory.summarizeVisibleTo(visibleRolesFor(callerRole));
  }

  async getUserByIdVisibleTo(id: string, callerRole: AuthRole): Promise<User | null> {
    const record = await this.credentialDirectory.findByIdVisibleTo(
      id,
      visibleRolesFor(callerRole)
    );
    return record ? toUser(record) : null;
  }

  async getDeveloperAccounts(callerRole: AuthRole): Promise<User[]> {
    this.assertDeveloperCaller(callerRole);
    return (await this.credentialDirectory.findVisibleTo(["Developer"])).map(toUser);
  }

  async getUserById(id: string): Promise<User | null> {
    const record = await this.credentials.findById(id);
    return record ? toUser(record) : null;
  }

  async getSecurityQuestionForUser(id: string): Promise<string | null> {
    const record = await this.credentials.findById(id);
    return record?.securityQuestion ?? null;
  }

  async createDeveloperAccount(
    input: CreateDeveloperAccountInput,
    callerRole: AuthRole
  ): Promise<User> {
    this.assertDeveloperCaller(callerRole);
    return this.createAccount({ ...input, role: "Developer" });
  }

  async bootstrapFirstDeveloper(input: CreateDeveloperAccountInput): Promise<User> {
    if ((await this.credentialDirectory.countVisibleTo(["Developer"])) !== 0) {
      throw new DeveloperAlreadyExistsError();
    }
    return this.createAccount({ ...input, role: "Developer" }, BOOTSTRAP_ACCOUNT_LIFECYCLE);
  }

  async updateDeveloperUsername(
    id: string,
    input: UpdateDeveloperUsernameInput,
    callerRole: AuthRole
  ): Promise<User> {
    this.assertDeveloperCaller(callerRole);
    await this.findDeveloperTarget(id);
    const username = canonicalizeAndValidateUsername(input.username);
    if (!username) throw new Error("Username does not match the canonical username rule.");
    const duplicate = await this.credentials.findByUsername(username);
    if (duplicate && duplicate.id !== id) throw new DuplicateUsernameError(username);
    return toUser(
      await this.credentials.update(id, {
        username,
        updatedAt: new Date().toISOString(),
      })
    );
  }

  async updateDeveloperSecurityQuestion(
    id: string,
    input: UpdateDeveloperSecurityQuestionInput,
    callerRole: AuthRole
  ): Promise<User> {
    this.assertDeveloperCaller(callerRole);
    const current = await this.findDeveloperTarget(id);
    return toUser(
      await this.credentials.update(id, {
        securityQuestion: validatedSecurityQuestion(input),
        securityAnswerHash: null,
        mustSetRecovery: true,
        tokenVersion: current.tokenVersion + 1,
        updatedAt: new Date().toISOString(),
      })
    );
  }

  async resetDeveloperPassword(
    id: string,
    input: ResetDeveloperPasswordInput,
    callerRole: AuthRole
  ): Promise<User> {
    this.assertDeveloperCaller(callerRole);
    const current = await this.findDeveloperTarget(id);
    const now = new Date().toISOString();
    return toUser(
      await this.credentials.update(id, {
        passwordHash: await hashPassword(input.password),
        passwordUpdatedAt: now,
        tokenVersion: current.tokenVersion + 1,
        updatedAt: now,
      })
    );
  }

  async toggleDeveloperStatus(
    id: string,
    currentUserId: string,
    callerRole: AuthRole
  ): Promise<User> {
    this.assertDeveloperCaller(callerRole);
    const current = await this.findDeveloperTarget(id);
    if (currentUserId === id && current.status === "Active") {
      throw new SelfDeactivationError();
    }
    if (
      current.status === "Active" &&
      (await this.countOtherActiveDevelopers(id)) === 0
    ) {
      throw new LastActiveDeveloperError();
    }
    return toUser(
      await this.credentials.update(id, {
        status: current.status === "Active" ? "Inactive" : "Active",
        updatedAt: new Date().toISOString(),
      })
    );
  }

  async deleteDeveloperAccount(
    id: string,
    currentUserId: string,
    callerRole: AuthRole
  ): Promise<void> {
    this.assertDeveloperCaller(callerRole);
    if (currentUserId === id) throw new SelfDeletionError();
    const current = await this.findDeveloperTarget(id);
    if (
      current.status === "Active" &&
      (await this.countOtherActiveDevelopers(id)) === 0
    ) {
      throw new LastActiveDeveloperError();
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

  async createUser(input: CreateUserInput): Promise<User> {
    if (input.role === "Developer") {
      throw new Error("Developer accounts must be created through Developer account management.");
    }

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
    const current = await this.findOrdinaryMutationTarget(id);
    if (input.role === "Developer") {
      throw new Error("Ordinary user management cannot assign the Developer role.");
    }

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
    const user = await this.findOrdinaryMutationTarget(id);
    return this.updateUser(
      id,
      { status: user.status === "Active" ? "Inactive" : "Active" },
      currentUserId
    );
  }

  async deleteUser(id: string, currentUserId?: string): Promise<void> {
    if (currentUserId === id) throw new SelfDeletionError();
    const target = await this.findOrdinaryMutationTarget(id);
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
    if (!authenticated) await this.emitAuthenticationFailure(username, record);
    if (!record || !authenticated) throw new InvalidCredentialsError();
    await this.emitAuthenticationSuccess(record);
    return toUser(record);
  }

  async changeFirstLoginPassword(id: string, password: string): Promise<User> {
    const current = await this.credentials.findById(id);
    if (!current) throw new UserNotFoundError(id);
    const now = new Date().toISOString();
    const updated = await this.credentials.update(id, {
      passwordHash: await hashPassword(password),
      mustChangePassword: false,
      tokenVersion: current.tokenVersion + 1,
      passwordUpdatedAt: now,
      updatedAt: now,
    });
    await this.emitFirstLoginSecurityEvent("FirstLoginPasswordChanged", updated);
    return toUser(updated);
  }

  async setFirstLoginRecoveryAnswer(id: string, answer: string): Promise<User> {
    const current = await this.credentials.findById(id);
    if (!current) throw new UserNotFoundError(id);
    const updated = await this.credentials.update(id, {
      securityAnswerHash: await hashSecurityAnswer(answer),
      mustSetRecovery: false,
      tokenVersion: current.tokenVersion + 1,
      updatedAt: new Date().toISOString(),
    });
    await this.emitFirstLoginSecurityEvent("FirstLoginRecoveryConfigured", updated);
    return toUser(updated);
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
        category: "AuthAccount",
        actorRole: null,
        targetRole: null,
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
        category: "AuthAccount",
        actorRole: null,
        targetRole: null,
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
      category: "AuthAccount",
      actorRole: null,
      targetRole: record?.role ?? null,
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
        category: "AuthAccount",
        actorRole: null,
        targetRole: null,
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
        category: "AuthAccount",
        actorRole: null,
        targetRole: record?.role ?? null,
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
      category: "AuthAccount",
      actorRole: null,
      targetRole: record.role,
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
        category: "AuthAccount",
        actorRole: null,
        targetRole: updated.role,
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

  async changeOwnPassword(
    id: string,
    currentPassword: string,
    newPassword: string,
    clientIp: string | null = null
  ): Promise<User> {
    const current = await this.credentials.findById(id);
    if (!current) throw new UserNotFoundError(id);
    if (current.status !== "Active") throw new InvalidCredentialsError();

    await this.passwordChangeRateLimiter.assertAllowed(current.username, clientIp);
    const verified = await verifyPassword(currentPassword, current.passwordHash);
    try {
      if (!verified) {
        await this.emitPasswordChangeFailed(current);
        throw new InvalidCredentialsError();
      }
      const now = new Date().toISOString();
      const updated = await this.credentials.updateIfTokenVersion(id, current.tokenVersion, {
        passwordHash: await hashPassword(newPassword),
        tokenVersion: current.tokenVersion + 1,
        passwordUpdatedAt: now,
        updatedAt: now,
      });
      if (!updated) throw new PasswordChangeConflictError();
      await this.emitPasswordChanged(updated);
      return toUser(updated);
    } finally {
      await this.passwordChangeRateLimiter.record(current.username, clientIp, verified);
    }
  }
}
