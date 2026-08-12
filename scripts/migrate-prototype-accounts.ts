import { randomUUID } from "node:crypto";
import { PREDEFINED_SECURITY_QUESTIONS } from "../src/config/security-questions";
import { hashPassword } from "../src/lib/password";
import {
  canonicalizeAndValidateUsername,
} from "../src/lib/username";
import { SupabaseCredentialRepository } from "../src/repositories/supabase-credential-repository";
import type {
  AuthCredentialRecord,
  ICredentialRepository,
} from "../src/repositories/interfaces";

const MIGRATION_ENV = "M6B_PROTOTYPE_ACCOUNTS_JSON";

type MigrationAccountInput = {
  id?: string;
  username: string;
  role: "Admin" | "User";
  status: "Active" | "Inactive";
  temporaryPassword: string;
  securityQuestion:
    | { type: "predefined"; value: string }
    | { type: "custom"; value: string };
};

const ACCOUNT_KEYS = new Set([
  "id",
  "username",
  "role",
  "status",
  "temporaryPassword",
  "securityQuestion",
]);

function fail(message: string): never {
  throw new PrototypeAccountMigrationError(`Prototype account migration refused: ${message}`);
}

class PrototypeAccountMigrationError extends Error {}

function parseInputs(): MigrationAccountInput[] {
  const encoded = process.env[MIGRATION_ENV];
  if (!encoded) fail(`${MIGRATION_ENV} is required`);

  let value: unknown;
  try {
    value = JSON.parse(encoded);
  } catch {
    fail(`${MIGRATION_ENV} must contain valid JSON`);
  }

  if (!Array.isArray(value) || value.length === 0) {
    fail(`${MIGRATION_ENV} must contain a non-empty account array`);
  }

  return value.map((candidate, index) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      fail(`account ${index + 1} must be an object`);
    }

    const record = candidate as Record<string, unknown>;
    if (Object.keys(record).some((key) => !ACCOUNT_KEYS.has(key))) {
      fail(`account ${index + 1} contains an unsupported field`);
    }
    if (record.id !== undefined && (typeof record.id !== "string" || !record.id.trim())) {
      fail(`account ${index + 1} has an invalid id`);
    }
    if (typeof record.username !== "string") {
      fail(`account ${index + 1} requires a username`);
    }
    if (record.role === "Developer") {
      fail(
        `account ${index + 1} has role Developer; use the Milestone 6D one-time Developer bootstrap`
      );
    }
    if (!(["Admin", "User"] as unknown[]).includes(record.role)) {
      fail(`account ${index + 1} requires a valid role`);
    }
    if (!(["Active", "Inactive"] as unknown[]).includes(record.status)) {
      fail(`account ${index + 1} requires a valid status`);
    }
    if (
      typeof record.temporaryPassword !== "string" ||
      record.temporaryPassword.length < 6 ||
      record.temporaryPassword.length > 100
    ) {
      fail(`account ${index + 1} requires a fresh temporary password of 6-100 characters`);
    }

    const question = record.securityQuestion;
    if (!question || typeof question !== "object" || Array.isArray(question)) {
      fail(`account ${index + 1} requires an explicit security question`);
    }
    const questionRecord = question as Record<string, unknown>;
    if (
      Object.keys(questionRecord).some((key) => !["type", "value"].includes(key)) ||
      typeof questionRecord.value !== "string"
    ) {
      fail(`account ${index + 1} has an invalid security question`);
    }
    if (questionRecord.type === "predefined") {
      if (
        !PREDEFINED_SECURITY_QUESTIONS.includes(
          questionRecord.value as (typeof PREDEFINED_SECURITY_QUESTIONS)[number]
        )
      ) {
        fail(`account ${index + 1} has an unapproved predefined security question`);
      }
    } else if (questionRecord.type === "custom") {
      if (!questionRecord.value.trim()) {
        fail(`account ${index + 1} requires a non-empty custom security question`);
      }
    } else {
      fail(`account ${index + 1} must explicitly select a predefined or custom question`);
    }

    return record as MigrationAccountInput;
  });
}

async function main(): Promise<void> {
  const inputs = parseInputs();
  const now = new Date().toISOString();
  const ids = new Set<string>();
  const usernames = new Set<string>();
  const accounts: AuthCredentialRecord[] = [];

  for (let index = 0; index < inputs.length; index += 1) {
    const input = inputs[index];
    const id = input.id?.trim() || randomUUID();
    const username = canonicalizeAndValidateUsername(input.username);
    if (!username) fail(`account ${index + 1} has an invalid canonical username`);
    if (ids.has(id) || usernames.has(username)) {
      fail(`account ${index + 1} duplicates another migrated account`);
    }
    ids.add(id);
    usernames.add(username);

    accounts.push({
      id,
      username,
      role: input.role,
      status: input.status,
      passwordHash: await hashPassword(input.temporaryPassword),
      securityQuestion: input.securityQuestion.value.trim(),
      securityAnswerHash: null,
      mustChangePassword: false,
      mustSetRecovery: true,
      tokenVersion: 1,
      passwordUpdatedAt: now,
      createdAt: now,
      updatedAt: now,
    });
  }

  const credentials: ICredentialRepository = new SupabaseCredentialRepository();
  for (const account of accounts) {
    await credentials.create(account);
  }
  process.stdout.write(`Prototype account migration completed for ${accounts.length} account(s).\n`);
}

void main().catch((error: unknown) => {
  const message =
    error instanceof PrototypeAccountMigrationError
      ? error.message
      : "Prototype account migration failed without printing credential details.";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
