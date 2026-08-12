import "server-only";

import { randomUUID } from "node:crypto";
import type {
  AuthCredentialRecord,
  ICredentialRepository,
  ILoginAttemptRepository,
} from "@/repositories/interfaces";
import { CreateUserInput, UpdateUserInput, User } from "@/types/user";
import { canonicalizeAndValidateUsername, canonicalizeUsername } from "@/lib/username";
import { hashPassword, hashSecurityAnswer, verifyPassword } from "@/lib/password";
import { LoginRateLimiter } from "@/lib/login-rate-limit";
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

export class InvalidCredentialsError extends Error {
  constructor() {
    super("Invalid username or password");
    this.name = "InvalidCredentialsError";
  }
}

export interface IUserService {
  getUsers(): Promise<User[]>;
  getUserById(id: string): Promise<User | null>;
  getSecurityQuestionForUser(id: string): Promise<string | null>;
  createUser(input: CreateUserInput): Promise<User>;
  updateUser(id: string, input: UpdateUserInput): Promise<User>;
  toggleUserStatus(id: string): Promise<User>;
  deleteUser(id: string, currentUserId?: string): Promise<void>;
  authenticate(username: string, password: string, clientIp?: string | null): Promise<User>;
  changeFirstLoginPassword(id: string, password: string): Promise<User>;
  setFirstLoginRecoveryAnswer(id: string, answer: string): Promise<User>;
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

  constructor(
    private readonly credentials: ICredentialRepository,
    attempts: ILoginAttemptRepository
  ) {
    this.loginRateLimiter = new LoginRateLimiter(attempts);
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

  async updateUser(id: string, input: UpdateUserInput): Promise<User> {
    const current = await this.credentials.findById(id);
    if (!current) throw new UserNotFoundError(id);

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

  async toggleUserStatus(id: string): Promise<User> {
    const user = await this.credentials.findById(id);
    if (!user) throw new UserNotFoundError(id);
    return this.updateUser(id, { status: user.status === "Active" ? "Inactive" : "Active" });
  }

  async deleteUser(id: string, currentUserId?: string): Promise<void> {
    if (currentUserId === id) throw new Error("Cannot delete currently authenticated account.");
    if (!(await this.credentials.findById(id))) throw new UserNotFoundError(id);
    await this.credentials.delete(id);
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
}
