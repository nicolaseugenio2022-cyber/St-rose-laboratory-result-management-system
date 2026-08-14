// This is a one-time operator procedure, not application functionality. Only one invocation may
// run at a time because the zero-Developer guard is check-then-insert and concurrent runs could
// both observe zero.

import {
  CUSTOM_SECURITY_QUESTION,
  PREDEFINED_SECURITY_QUESTIONS,
} from "../src/config/security-questions";
import { SupabaseAuditLogRepository } from "../src/repositories/supabase-audit-log-repository";
import { SupabaseCredentialRepository } from "../src/repositories/supabase-credential-repository";
import { auditService } from "../src/services/audit-service-instance";
import { userService } from "../src/services/user-service-instance";
import { DeveloperAlreadyExistsError } from "../src/services/userService";
import type { CreateDeveloperAccountInput } from "../src/types/user";
import {
  BootstrapRefusedError,
  runBootstrap,
  runBootstrapAuditRepair,
} from "./bootstrap-core";

const BOOTSTRAP_ENV = "DEVELOPER_BOOTSTRAP_JSON";
const REPAIR_ENV = "DEVELOPER_BOOTSTRAP_REPAIR_USERNAME";

type BootstrapAccountInput = {
  username: string;
  temporaryPassword: string;
  securityQuestion:
    | { type: "predefined"; value: string }
    | { type: "custom"; value: string };
};

const ACCOUNT_KEYS = new Set(["username", "temporaryPassword", "securityQuestion"]);

function fail(message: string): never {
  throw new BootstrapRefusedError(`Developer bootstrap refused: ${message}`);
}

function parseInput(): BootstrapAccountInput {
  const encoded = process.env[BOOTSTRAP_ENV];
  if (!encoded) fail(`${BOOTSTRAP_ENV} is required`);

  let value: unknown;
  try {
    value = JSON.parse(encoded);
  } catch {
    fail(`${BOOTSTRAP_ENV} must contain valid JSON`);
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(`${BOOTSTRAP_ENV} must contain an account object`);
  }

  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !ACCOUNT_KEYS.has(key))) {
    fail("the bootstrap account contains an unsupported field");
  }
  if (typeof record.username !== "string") {
    fail("the bootstrap account requires a username");
  }
  if (
    typeof record.temporaryPassword !== "string" ||
    record.temporaryPassword.length < 6 ||
    record.temporaryPassword.length > 100
  ) {
    fail("the bootstrap account requires a temporary password of 6-100 characters");
  }

  const question = record.securityQuestion;
  if (!question || typeof question !== "object" || Array.isArray(question)) {
    fail("the bootstrap account requires an explicit security question");
  }
  const questionRecord = question as Record<string, unknown>;
  if (
    Object.keys(questionRecord).some((key) => !["type", "value"].includes(key)) ||
    typeof questionRecord.value !== "string"
  ) {
    fail("the bootstrap account has an invalid security question");
  }
  if (questionRecord.type === "predefined") {
    if (
      !PREDEFINED_SECURITY_QUESTIONS.includes(
        questionRecord.value as (typeof PREDEFINED_SECURITY_QUESTIONS)[number]
      )
    ) {
      fail("the bootstrap account has an unapproved predefined security question");
    }
  } else if (questionRecord.type === "custom") {
    if (!questionRecord.value.trim()) {
      fail("the bootstrap account requires a non-empty custom security question");
    }
  } else {
    fail("the bootstrap account must explicitly select a predefined or custom question");
  }

  return record as BootstrapAccountInput;
}

function toDeveloperInput(input: BootstrapAccountInput): CreateDeveloperAccountInput {
  if (input.securityQuestion.type === "predefined") {
    return {
      username: input.username,
      password: input.temporaryPassword,
      securityQuestion: input.securityQuestion.value,
    };
  }

  return {
    username: input.username,
    password: input.temporaryPassword,
    securityQuestion: CUSTOM_SECURITY_QUESTION,
    customSecurityQuestion: input.securityQuestion.value.trim(),
  };
}

async function main(): Promise<void> {
  const repairUsername = process.env[REPAIR_ENV]?.trim();
  const credentials = new SupabaseCredentialRepository();
  const auditLogs = new SupabaseAuditLogRepository();
  const deps = {
    userService,
    credentialDirectory: credentials,
    auditLogs,
    auditService,
  };

  if (repairUsername) {
    const outcome = await runBootstrapAuditRepair(deps, repairUsername);
    process.stdout.write(
      `Developer bootstrap audit repair completed for ${outcome.username}.\n`
    );
    return;
  }

  const input = parseInput();
  let outcome;
  try {
    outcome = await runBootstrap(deps, toDeveloperInput(input));
  } catch (error) {
    if (error instanceof DeveloperAlreadyExistsError) {
      throw new BootstrapRefusedError(
        "Developer bootstrap refused: a Developer account already exists and the one-time bootstrap is closed."
      );
    }
    throw error;
  }

  if (outcome.status === "created-audit-failed") {
    process.stderr.write(
      `Developer account ${outcome.username} (ID ${outcome.userId}) WAS created, but the bootstrap audit event was NOT persisted after ${outcome.attempts} attempts. ` +
        "Do NOT rerun the bootstrap—the one-time guard will correctly refuse now that a Developer exists. " +
        `Rerun in repair mode instead: set ${REPAIR_ENV} to the username above, then run exactly "npm run bootstrap:first-developer".\n`
    );
    process.exitCode = 1;
    return;
  }

  process.stdout.write(
    `Developer bootstrap completed. Account ${outcome.username} created and the bootstrap audit event was recorded.\n`
  );
}

void main().catch((error: unknown) => {
  const message =
    error instanceof BootstrapRefusedError
      ? error.message
      : "Developer bootstrap failed without printing credential details.";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
